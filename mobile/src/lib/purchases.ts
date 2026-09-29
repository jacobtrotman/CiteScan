// RevenueCat integration: who is Pro, how many essay checks are left, and buying more.
//
// - "CiteScan Pro" (monthly / yearly subscription) unlocks unlimited checks.
// - Everyone gets FREE_CHECKS to try the app.
// - Each "essay_pack" consumable adds PACK_CHECKS more.
//
// Purchases come from RevenueCat; the number of checks used is kept on the device.
import { File, Paths } from 'expo-file-system';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

export const FREE_CHECKS = 3;
/** Fair use: Pro Advanced (web) searches per calendar month. After this, checks use papers only. */
export const ADVANCED_MONTHLY_LIMIT = 30;
export const PACK_CHECKS = 3;
export const ESSAY_PACK_ID = 'essay_pack';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

/** RevenueCat's Test Store (development): purchases are simulated and renew every few hours. */
export const IS_TEST_STORE = API_KEY?.startsWith('test_') ?? false;

interface Account {
  userId: string;
  checksUsed: number;
  /** "YYYY-MM" the advanced count belongs to. */
  advancedMonth?: string;
  advancedUsed?: number;
}

const accountFile = new File(Paths.document, 'account.json');

// A stable user ID stored on the device, so purchases survive app restarts
// (RevenueCat's own anonymous ID isn't persisted in Expo Go).
function readAccount(): Account {
  if (accountFile.exists) {
    try {
      return JSON.parse(accountFile.textSync()) as Account;
    } catch {
      // fall through and recreate
    }
  }
  const account: Account = {
    userId: `citescan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    checksUsed: 0,
  };
  writeAccount(account);
  return account;
}

function writeAccount(account: Account) {
  if (!accountFile.exists) accountFile.create();
  accountFile.write(JSON.stringify(account));
}

let configured = false;

function ensureConfigured() {
  if (configured || !API_KEY) return;
  Purchases.configure({ apiKey: API_KEY, appUserID: readAccount().userId });
  configured = true;
}

export interface Access {
  isPro: boolean;
  checksLeft: number;
}

function accessFrom(info: CustomerInfo): Access {
  const isPro = Object.keys(info.entitlements.active).length > 0;
  const packsBought = info.nonSubscriptionTransactions.filter((t) => t.productIdentifier === ESSAY_PACK_ID).length;
  const checksLeft = Math.max(0, FREE_CHECKS + packsBought * PACK_CHECKS - readAccount().checksUsed);
  return { isPro, checksLeft };
}

export async function getAccess(): Promise<Access> {
  ensureConfigured();
  if (!configured) return { isPro: false, checksLeft: Math.max(0, FREE_CHECKS - readAccount().checksUsed) };
  return accessFrom(await Purchases.getCustomerInfo());
}

/** Call after a successful analysis. Pro users have unlimited checks. */
export async function recordCheckUsed() {
  const { isPro } = await getAccess();
  if (isPro) return;
  const account = readAccount();
  writeAccount({ ...account, checksUsed: account.checksUsed + 1 });
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  ensureConfigured();
  if (!configured) throw new Error('Purchases are not set up yet.');
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/** Returns the new access level, or null if the user cancelled. */
export async function buy(pkg: PurchasesPackage): Promise<Access | null> {
  ensureConfigured();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return accessFrom(customerInfo);
  } catch (err: any) {
    if (err?.userCancelled) return null;
    throw new Error(err?.message ?? 'The purchase could not be completed.');
  }
}

export async function restore(): Promise<Access> {
  ensureConfigured();
  return accessFrom(await Purchases.restorePurchases());
}

export interface AccountDetails extends Access {
  userId: string;
  /** e.g. "Pro yearly" */
  planName: string | null;
  /** ISO date the current period ends. */
  periodEnds: string | null;
  willRenew: boolean;
  managementURL: string | null;
}

export async function getAccountDetails(): Promise<AccountDetails> {
  const userId = readAccount().userId;
  ensureConfigured();
  if (!configured) {
    return { ...(await getAccess()), userId, planName: null, periodEnds: null, willRenew: false, managementURL: null };
  }
  const info = await Purchases.getCustomerInfo();
  const entitlement = Object.values(info.entitlements.active)[0];
  const planName = entitlement
    ? entitlement.productIdentifier.includes('year')
      ? 'Pro yearly'
      : entitlement.productIdentifier.includes('month')
        ? 'Pro monthly'
        : 'Pro'
    : null;
  return {
    ...accessFrom(info),
    userId,
    planName,
    periodEnds: entitlement?.expirationDate ?? null,
    willRenew: entitlement?.willRenew ?? false,
    managementURL: info.managementURL,
  };
}

/** Development only: start over as a brand-new free user (used for testing and demo videos). */
export async function resetTestAccount() {
  const account: Account = {
    userId: `citescan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    checksUsed: 0,
  };
  writeAccount(account);
  ensureConfigured();
  if (configured) await Purchases.logIn(account.userId);
}

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** How many Advanced searches a Pro user has left this month. */
export function getAdvancedLeft(): number {
  const account = readAccount();
  const used = account.advancedMonth === thisMonth() ? (account.advancedUsed ?? 0) : 0;
  return Math.max(0, ADVANCED_MONTHLY_LIMIT - used);
}

export function recordAdvancedUsed() {
  const account = readAccount();
  const month = thisMonth();
  const used = account.advancedMonth === month ? (account.advancedUsed ?? 0) : 0;
  writeAccount({ ...account, advancedMonth: month, advancedUsed: used + 1 });
}
