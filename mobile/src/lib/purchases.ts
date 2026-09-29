// RevenueCat integration: who is Pro, what they can still use, and buying more.
//
// Every plan is designed to at least break even at full use:
// - Pro (monthly / yearly) gets a monthly AI-cost allowance below what the plan earns after the
//   store's cut. The server reports the real cost of each check, which is counted against it, and a
//   check only starts if its worst-case cost still fits.
// - Everyone gets FREE_CHECKS to try the app; each "essay_pack" consumable adds PACK_CHECKS more.
//   A pack earns more than PACK_CHECKS worst-case checks can cost.
//
// Purchases come from RevenueCat; usage is kept on the device (TODO before launch: server-side).
import { File, Paths } from 'expo-file-system';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

export const FREE_CHECKS = 3;

/**
 * Worst-case API cost (USD) of each part of a check, from the server's hard limits
 * (25k-token essays, 10 sentences, capped output and web searches). See server/src/analyze.ts.
 */
export const WORST_CASE = {
  /** Reading the essay + finding sources in papers. */
  check: 0.25,
  /** Extra for Advanced (web) search on top of that. */
  advanced: 0.24,
};

/**
 * Monthly AI-cost allowance per Pro plan (USD), set below what the plan earns after a 30% store fee:
 * monthly $3.99 → $2.79; yearly $24.99 → $1.46/month.
 */
export const PLAN_ALLOWANCE = { monthly: 2.5, yearly: 1.3 } as const;
export type ProPlan = keyof typeof PLAN_ALLOWANCE;
export const PACK_CHECKS = 3;
export const ESSAY_PACK_ID = 'essay_pack';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

/** RevenueCat's Test Store (development): purchases are simulated and renew every few hours. */
export const IS_TEST_STORE = API_KEY?.startsWith('test_') ?? false;

interface Account {
  userId: string;
  checksUsed: number;
  /** "YYYY-MM" the Pro usage below belongs to. */
  usageMonth?: string;
  /** USD of API cost used this month on the Pro allowance. */
  usageSpent?: number;
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
  plan: ProPlan | null;
  /** Free + Essay Pack checks remaining. */
  checksLeft: number;
}

function accessFrom(info: CustomerInfo): Access {
  const entitlement = Object.values(info.entitlements.active)[0];
  const isPro = !!entitlement;
  const plan: ProPlan | null = entitlement ? (entitlement.productIdentifier.includes('year') ? 'yearly' : 'monthly') : null;
  const packsBought = info.nonSubscriptionTransactions.filter((t) => t.productIdentifier === ESSAY_PACK_ID).length;
  const checksLeft = Math.max(0, FREE_CHECKS + packsBought * PACK_CHECKS - readAccount().checksUsed);
  return { isPro, plan, checksLeft };
}

export async function getAccess(): Promise<Access> {
  ensureConfigured();
  if (!configured) return { isPro: false, plan: null, checksLeft: Math.max(0, FREE_CHECKS - readAccount().checksUsed) };
  return accessFrom(await Purchases.getCustomerInfo());
}

/** Uses one free / Essay Pack check. */
export function recordCheckUsed() {
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

export interface ProUsage {
  spent: number;
  allowance: number;
  remaining: number;
  /** First day of next month, when the allowance resets. */
  resetsOn: Date;
}

export function getProUsage(plan: ProPlan): ProUsage {
  const account = readAccount();
  const spent = account.usageMonth === thisMonth() ? (account.usageSpent ?? 0) : 0;
  const allowance = PLAN_ALLOWANCE[plan];
  const now = new Date();
  return {
    spent,
    allowance,
    remaining: Math.max(0, allowance - spent),
    resetsOn: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/** Counts a check's real API cost (reported by the server) against the Pro allowance. */
export function recordSpend(cost: number) {
  const account = readAccount();
  const month = thisMonth();
  const spent = account.usageMonth === month ? (account.usageSpent ?? 0) : 0;
  writeAccount({ ...account, usageMonth: month, usageSpent: spent + Math.max(0, cost) });
}

/**
 * How a new check is paid for: from the Pro allowance (only if its worst case still fits),
 * otherwise from a free / Essay Pack check, otherwise it can't start.
 */
export type CheckMode = 'pro' | 'credit' | 'none';

export function decideCheckMode(access: Access): CheckMode {
  if (access.isPro && access.plan && getProUsage(access.plan).remaining >= WORST_CASE.check) return 'pro';
  if (access.checksLeft > 0) return 'credit';
  return 'none';
}

/** Whether a Pro check can afford Advanced search in the worst case. */
export function canAffordAdvanced(plan: ProPlan): boolean {
  return getProUsage(plan).remaining >= WORST_CASE.advanced;
}
