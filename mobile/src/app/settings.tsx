import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/LogoMark';
import { APP_ICONS, canChangeAppIcon } from '@/lib/app-icon';
import { useAppState, type ModePreference } from '@/lib/app-state';
import { ACCENTS, BACKGROUNDS, DEFAULT_ICON } from '@/lib/palette';
import { getAccountDetails, IS_TEST_STORE, resetTestAccount, restore, type AccountDetails } from '@/lib/purchases';
import { useTheme, type Theme } from '@/lib/theme';

const MODES: { id: ModePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const openPaywall = () => router.push({ pathname: '/paywall', params: { reason: 'feature' } });

export default function SettingsScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { prefs, setPrefs, refreshAccess } = useAppState();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [copied, setCopied] = useState(false);
  const isPro = account?.isPro ?? false;
  const mode = theme.mode;

  const load = useCallback(() => {
    getAccountDetails()
      .then(setAccount)
      .catch(() => {});
  }, []);
  useFocusEffect(load);

  // Pro-only choices open the paywall for free users instead of applying.
  const choosePro = (apply: () => void) => (isPro ? apply() : openPaywall());

  const onRestore = async () => {
    try {
      const access = await restore();
      await refreshAccess();
      load();
      Alert.alert(
        access.isPro ? 'Purchases restored' : 'Nothing to restore',
        access.isPro ? 'CiteScan Pro is active.' : "We couldn't find an active subscription for this account.",
      );
    } catch (err) {
      Alert.alert('Restore failed', err instanceof Error ? err.message : String(err));
    }
  };

  const onManage = () => {
    if (account?.managementURL) Linking.openURL(account.managementURL);
    else
      Alert.alert(
        'Manage subscription',
        'Subscriptions are managed in your App Store or Google Play account settings.',
      );
  };

  const copyId = async () => {
    if (!account) return;
    await Clipboard.setStringAsync(account.userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const periodEnds = account?.periodEnds ? new Date(account.periodEnds).toLocaleDateString() : null;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: 16 }]}>
        <Text style={styles.title}>Settings</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Account */}
        <Section title="Account" theme={theme}>
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Ionicons name={isPro ? 'school' : 'person'} size={24} color={theme.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.planName}>{isPro ? (account?.planName ?? 'CiteScan Pro') : 'Free plan'}</Text>
              <Text style={styles.muted}>
                {!account
                  ? 'Loading…'
                  : isPro
                    ? periodEnds
                      ? `${account.willRenew ? 'Renews' : 'Ends'} on ${periodEnds}`
                      : 'Unlimited essay checks'
                    : `${account.checksLeft} essay check${account.checksLeft === 1 ? '' : 's'} left`}
              </Text>
            </View>
            {isPro ? (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PRO</Text>
              </View>
            ) : null}
          </View>

          {isPro ? (
            <Row icon="card-outline" label="Manage subscription" onPress={onManage} theme={theme} />
          ) : (
            <Row icon="sparkles-outline" label="Upgrade to CiteScan Pro" onPress={openPaywall} theme={theme} highlight />
          )}
          <Row icon="refresh-outline" label="Restore purchases" onPress={onRestore} theme={theme} />
          <Row
            icon={copied ? 'checkmark' : 'finger-print-outline'}
            label="Account ID"
            value={copied ? 'Copied' : account ? `${account.userId.slice(0, 18)}…` : ''}
            onPress={copyId}
            theme={theme}
            last
          />
        </Section>
        {isPro && IS_TEST_STORE && (
          <Text style={[styles.footnote, { color: theme.possible }]}>
            Test mode: purchases are simulated, and test subscriptions renew every few hours instead of monthly or
            yearly. Real App Store and Google Play subscriptions show the normal renewal date.
          </Text>
        )}
        <Text style={styles.footnote}>
          No sign-up needed. Purchases are linked to your App Store or Google Play account, so you can restore them
          on a new phone.
        </Text>

        {/* Appearance */}
        <Section title="Appearance" theme={theme}>
          <View style={styles.segment}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                style={[styles.segmentItem, prefs.mode === m.id && styles.segmentActive]}
                onPress={() => setPrefs({ mode: m.id })}
              >
                <Text style={[styles.segmentText, prefs.mode === m.id && styles.segmentTextActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Accent colour" pro={!isPro} theme={theme}>
          <View style={styles.swatches}>
            {ACCENTS.map((a) => {
              const selected = isPro && prefs.accent === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={styles.swatchWrap}
                  onPress={() => choosePro(() => setPrefs({ accent: a.id }))}
                  accessibilityLabel={`${a.name} accent`}
                >
                  <View style={[styles.swatchRing, selected && { borderColor: a[mode].primary }]}>
                    <View style={[styles.swatch, { backgroundColor: a[mode].primary }]}>
                      {!isPro && a.id !== 'classic' && <Ionicons name="lock-closed" size={14} color={a[mode].primaryText} />}
                      {selected && <Ionicons name="checkmark" size={18} color={a[mode].primaryText} />}
                    </View>
                  </View>
                  <Text style={styles.swatchLabel}>{a.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Background" pro={!isPro} theme={theme}>
          <View style={styles.tiles}>
            {BACKGROUNDS.map((b) => {
              const selected = isPro && prefs.background === b.id;
              const v = b[mode];
              return (
                <Pressable
                  key={b.id}
                  style={[styles.bgTile, { backgroundColor: v.background, borderColor: selected ? theme.accent : theme.border }]}
                  onPress={() => choosePro(() => setPrefs({ background: b.id }))}
                >
                  <View style={[styles.bgCard, { backgroundColor: v.card, borderColor: v.border }]} />
                  <View style={[styles.bgLine, { backgroundColor: v.muted }]} />
                  <Text style={[styles.bgLabel, { color: v.text }]}>{b.name}</Text>
                  {!isPro && b.id !== 'classic' && (
                    <Ionicons name="lock-closed" size={12} color={v.muted} style={styles.tileLock} />
                  )}
                  {selected && <Ionicons name="checkmark-circle" size={18} color={theme.accent} style={styles.tileLock} />}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="App icon" pro={!isPro} theme={theme}>
          <View style={styles.tiles}>
            {APP_ICONS.map((icon) => {
              const selected = isPro && prefs.icon === icon.id;
              return (
                <Pressable
                  key={icon.id}
                  style={styles.iconWrap}
                  onPress={() => choosePro(() => setPrefs({ icon: icon.id }))}
                  accessibilityLabel={`${icon.name} app icon`}
                >
                  {!isPro && (
                    <Ionicons name="lock-closed" size={12} color={theme.muted} style={styles.iconLock} />
                  )}
                  <View
                    style={[
                      styles.iconTile,
                      { backgroundColor: mode === 'dark' ? '#000000' : '#FFFFFF' },
                      selected && { borderColor: theme.accent, borderWidth: 2.5 },
                    ]}
                  >
                    <LogoMark size={46} color={icon[mode]} />
                  </View>
                  <Text style={styles.swatchLabel}>{icon.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.iconFooter}>
            <Text style={[styles.note, { flex: 1 }]}>
              {isPro && prefs.icon !== DEFAULT_ICON
                ? 'Your chosen icon stays the same in light and dark mode.'
                : 'Default icon: cyan in light mode, purple in dark mode.'}
            </Text>
            {isPro && prefs.icon !== DEFAULT_ICON && (
              <Pressable onPress={() => setPrefs({ icon: DEFAULT_ICON })} hitSlop={8}>
                <Text style={styles.link}>Use default</Text>
              </Pressable>
            )}
          </View>
          {isPro && !canChangeAppIcon() && (
            <Text style={styles.note}>
              Your choice is saved and will be applied when CiteScan is installed from the App Store or Google Play.
            </Text>
          )}
        </Section>
        {__DEV__ && (
          <Pressable
            onPress={() =>
              Alert.alert('Reset test account?', 'Start again as a new free user with 3 checks. (Development only.)', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetTestAccount();
                    await refreshAccess();
                    load();
                  },
                },
              ])
            }
          >
            <Text style={styles.devReset}>Reset test account (development only)</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Section(props: { title: string; pro?: boolean; theme: Theme; children: ReactNode }) {
  const styles = makeStyles(props.theme);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{props.title}</Text>
        {props.pro && (
          <Pressable style={styles.proTag} onPress={openPaywall}>
            <Ionicons name="lock-closed" size={11} color={props.theme.primaryText} />
            <Text style={styles.proTagText}>PRO</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.card}>{props.children}</View>
    </View>
  );
}

function Row(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  theme: Theme;
  highlight?: boolean;
  last?: boolean;
}) {
  const styles = makeStyles(props.theme);
  return (
    <Pressable style={({ pressed }) => [styles.row, !props.last && styles.rowDivider, pressed && { opacity: 0.6 }]} onPress={props.onPress}>
      <Ionicons name={props.icon} size={20} color={props.theme.accent} />
      <Text style={[styles.rowLabel, props.highlight && { color: props.theme.accent, fontWeight: '700' }]}>{props.label}</Text>
      {props.value ? <Text style={styles.rowValue}>{props.value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={props.theme.muted} />
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
    title: { fontSize: 28, fontWeight: '800', color: t.text },
    close: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.border, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20, gap: 20 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 13, fontWeight: '700', color: t.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    proTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    proTagText: { color: t.primaryText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    card: { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 14, gap: 12 },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
    planName: { fontSize: 17, fontWeight: '700', color: t.text },
    muted: { fontSize: 14, color: t.muted },
    proPill: { backgroundColor: t.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    proPillText: { color: t.primaryText, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: t.border },
    rowLabel: { flex: 1, fontSize: 16, color: t.text },
    rowValue: { fontSize: 14, color: t.muted },
    footnote: { fontSize: 12, color: t.muted, lineHeight: 17, paddingHorizontal: 4, marginTop: -12 },
    segment: { flexDirection: 'row', backgroundColor: t.background, borderRadius: 10, padding: 3 },
    segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    segmentActive: { backgroundColor: t.primary },
    segmentText: { fontWeight: '600', color: t.muted },
    segmentTextActive: { color: t.primaryText },
    swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    swatchWrap: { width: '23%', alignItems: 'center', gap: 4, paddingVertical: 4 },
    swatchRing: { borderWidth: 2.5, borderColor: 'transparent', borderRadius: 26, padding: 3 },
    swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    swatchLabel: { fontSize: 12, color: t.muted, fontWeight: '600' },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    bgTile: { width: '47%', height: 84, borderRadius: 14, borderWidth: 2, padding: 10, gap: 6 },
    bgCard: { height: 22, borderRadius: 6, borderWidth: 1 },
    bgLine: { height: 4, width: '60%', borderRadius: 2, opacity: 0.5 },
    bgLabel: { fontSize: 13, fontWeight: '700', marginTop: 'auto' },
    tileLock: { position: 'absolute', top: 8, right: 8 },
    iconLock: { position: 'absolute', top: 4, right: 6, zIndex: 1 },
    iconWrap: { width: '22%', alignItems: 'center', gap: 4 },
    iconTile: {
      width: 64,
      height: 64,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
    },
    note: { fontSize: 12, color: t.muted, lineHeight: 17 },
    iconFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    link: { color: t.accent, fontWeight: '700', fontSize: 13 },
    devReset: { fontSize: 13, color: t.danger, textAlign: 'center', paddingVertical: 8 },
  });
