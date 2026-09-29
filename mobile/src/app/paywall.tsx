import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/LogoMark';
import { buy, ESSAY_PACK_ID, getPackages, PACK_CHECKS, restore } from '@/lib/purchases';
import { useAppState } from '@/lib/app-state';
import { PRO_FEATURES } from '@/lib/pro-features';
import { useTheme, type Theme } from '@/lib/theme';

const ORDER = [PACKAGE_TYPE.ANNUAL, PACKAGE_TYPE.MONTHLY];


function sortPackages(packages: PurchasesPackage[]) {
  const rank = (p: PurchasesPackage) => {
    const i = ORDER.indexOf(p.packageType);
    return i === -1 ? ORDER.length : i;
  };
  return [...packages].sort((a, b) => rank(a) - rank(b));
}

export default function PaywallScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const { refreshAccess } = useAppState();

  useEffect(() => {
    getPackages()
      .then((pkgs) => {
        const sorted = sortPackages(pkgs);
        setPackages(sorted);
        setSelected(sorted[0]?.identifier ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const monthly = packages?.find((p) => p.packageType === PACKAGE_TYPE.MONTHLY);
  const chosen = packages?.find((p) => p.identifier === selected);
  const isPack = chosen?.product.identifier === ESSAY_PACK_ID;

  const onBuy = async () => {
    if (!chosen) return;
    setPurchasing(true);
    try {
      const access = await buy(chosen);
      if (!access) return;
      await refreshAccess();
      Alert.alert(
        access.isPro && !isPack ? 'Welcome to CiteScan Pro!' : 'Essay Pack added',
        access.isPro && !isPack ? 'Your monthly Pro allowance and all Pro features are unlocked.' : `You have ${access.checksLeft} essay checks left.`,
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Purchase failed', err instanceof Error ? err.message : String(err));
    } finally {
      setPurchasing(false);
    }
  };

  const onRestore = async () => {
    try {
      const access = await restore();
      await refreshAccess();
      Alert.alert(
        access.isPro ? 'Purchases restored' : 'Nothing to restore',
        access.isPro ? 'CiteScan Pro is active again.' : "We couldn't find an active subscription for this account.",
      );
      if (access.isPro) router.back();
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={styles.close} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={theme.muted} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <LogoMark size={56} color={theme.accent} />
          </View>
          <Text style={styles.title}>
            CiteScan <Text style={{ color: theme.accent }}>Pro</Text>
          </Text>
          <Text style={styles.subtitle}>
            {reason === 'out'
              ? "You've used all your essay checks. Go Pro for a monthly allowance, or grab a few more."
              : reason === 'advanced'
                ? 'Advanced search looks beyond academic papers to find the news article, report or statistic behind your claim.'
                : reason === 'history'
                  ? 'Free accounts can open essays from the last 7 days. Go Pro to open and search your full history.'
                  : reason === 'feature'
                  ? 'Make CiteScan yours with custom colours and app icons, plus every other Pro feature.'
                  : 'Every essay, fully cited, whenever a deadline hits.'}
          </Text>
        </View>

        <View style={styles.benefits}>
          {PRO_FEATURES.map((f) => (
            <View key={f.title} style={styles.benefit}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={styles.benefitText}>{f.title}</Text>
                <Text style={styles.featureDetail}>{f.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {error ? (
          <Text style={styles.error}>Couldn’t load plans: {error}</Text>
        ) : !packages ? (
          <ActivityIndicator color={theme.accent} style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.plans}>
            {packages.map((pkg) => (
              <PlanCard
                key={pkg.identifier}
                pkg={pkg}
                monthly={monthly}
                selected={pkg.identifier === selected}
                onPress={() => setSelected(pkg.identifier)}
                theme={theme}
              />
            ))}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.cta, (!chosen || purchasing) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          disabled={!chosen || purchasing}
          onPress={onBuy}
        >
          {purchasing ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Text style={styles.ctaText}>{isPack ? 'Buy Essay Pack' : 'Start CiteScan Pro'}</Text>
          )}
        </Pressable>

        <Pressable onPress={onRestore} hitSlop={8}>
          <Text style={styles.restore}>Restore purchases</Text>
        </Pressable>
        <Text style={styles.fine}>
          Subscriptions renew automatically until cancelled. Cancel anytime in your device settings.
        </Text>
      </ScrollView>
    </View>
  );
}

function PlanCard(props: {
  pkg: PurchasesPackage;
  monthly?: PurchasesPackage;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const { pkg, monthly, selected, theme } = props;
  const styles = makeStyles(theme);
  const product = pkg.product;

  let name = product.title;
  let detail = product.priceString;
  let badge: string | null = null;
  let allowance: string | null = null;

  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) {
    allowance = 'About 13 essays a month with Advanced search';
    name = 'Yearly';
    detail = `${product.priceString} / year`;
    if (product.pricePerMonthString) detail += ` · ${product.pricePerMonthString}/mo`;
    if (monthly && monthly.product.price > 0) {
      const saving = Math.round((1 - product.price / (monthly.product.price * 12)) * 100);
      if (saving > 0) badge = `Save ${saving}%`;
    }
  } else if (pkg.packageType === PACKAGE_TYPE.MONTHLY) {
    name = 'Monthly';
    detail = `${product.priceString} / month`;
    allowance = 'About 25 essays a month with Advanced search';
  } else if (product.identifier === ESSAY_PACK_ID) {
    name = 'Essay Pack';
    detail = `${product.priceString} · ${PACK_CHECKS} more checks, one-off`;
  }

  return (
    <Pressable style={[styles.plan, selected && styles.planSelected]} onPress={props.onPress}>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? theme.accent : theme.muted}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.planName}>{name}</Text>
        <Text style={styles.planDetail}>{detail}</Text>
        {allowance && <Text style={styles.planAllowance}>{allowance}</Text>}
      </View>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: 20, gap: 20 },
    close: { alignSelf: 'flex-end', padding: 4 },
    hero: { alignItems: 'center', gap: 10 },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 16, color: t.muted, textAlign: 'center', lineHeight: 23, paddingHorizontal: 8 },
    benefits: { gap: 12, backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 16 },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    benefitText: { fontSize: 15, fontWeight: '700', color: t.text },
    featureDetail: { fontSize: 13, color: t.muted, lineHeight: 18 },
    featureIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plans: { gap: 10 },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.border,
      padding: 16,
      backgroundColor: t.background,
    },
    planSelected: { borderColor: t.accent, backgroundColor: t.primarySoft },
    planName: { fontSize: 17, fontWeight: '700', color: t.text },
    planDetail: { fontSize: 14, color: t.muted },
    planAllowance: { fontSize: 12, color: t.accent, fontWeight: '600' },
    badge: { backgroundColor: t.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { color: t.primaryText, fontSize: 12, fontWeight: '700' },
    cta: { backgroundColor: t.primary, borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
    ctaText: { color: t.primaryText, fontSize: 17, fontWeight: '700' },
    restore: { color: t.accent, fontWeight: '600', textAlign: 'center' },
    fine: { fontSize: 12, color: t.muted, textAlign: 'center', lineHeight: 17 },
    error: { color: t.danger, textAlign: 'center' },
  });
