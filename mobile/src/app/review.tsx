import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressView } from '@/components/ProgressView';
import { findSources } from '@/lib/api';
import { useAppState } from '@/lib/app-state';
import { clearPendingCheck, getPendingCheck } from '@/lib/pending';
import { canAffordAdvanced, getProUsage, recordSpend } from '@/lib/purchases';
import { newId, saveAnalysis } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import type { ClaimCategory } from '@/lib/types';

/** Most sentences one check can find sources for (matches the server's limit). */
const MAX_SELECTED = 10;

const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  statistic: 'Statistic',
  fact: 'Fact',
  quotation: 'Quotation',
  research_finding: 'Research finding',
  historical: 'Historical detail',
  paraphrased_idea: "Someone else's idea",
};

/**
 * Stage 1 results: the sentences that may need citing. The user unticks any they don't need
 * before sources are searched (stage 2), which is the slow, costly step.
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const { access, refreshAccess } = useAppState();
  const [pending] = useState(getPendingCheck);
  // Everything starts ticked, up to the per-check limit.
  const [selected, setSelected] = useState<boolean[]>(() => pending?.claims.map((_, i) => i < MAX_SELECTED) ?? []);
  const [busy, setBusy] = useState(false);

  const isPro = access?.isPro ?? false;
  const plan = access?.plan ?? null;
  const proCheck = pending?.mode === 'pro' && plan !== null;
  // Advanced (web) search only if the worst case still fits in this month's Pro allowance.
  const [advanced] = useState(() => proCheck && canAffordAdvanced(plan));
  const [usage] = useState(() => (plan ? getProUsage(plan) : null));
  const count = selected.filter(Boolean).length;

  if (!pending) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.muted}>Nothing to review. Scan or upload an essay first.</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const toggle = (i: number) =>
    setSelected((s) => {
      if (!s[i] && s.filter(Boolean).length >= MAX_SELECTED) {
        Alert.alert('Up to 10 sentences', 'One check can find sources for up to 10 sentences. Untick one to choose this instead.');
        return s;
      }
      return s.map((v, j) => (j === i ? !v : v));
    });
  const allSelected = count === Math.min(selected.length, MAX_SELECTED);
  const toggleAll = () => setSelected((s) => s.map((_, i) => !allSelected && i < MAX_SELECTED));

  const onFindSources = async () => {
    const chosen = pending.claims.filter((_, i) => selected[i]);
    setBusy(true);
    try {
      const result = await findSources(chosen, { advanced });
      // Pro checks count their real cost against the allowance; credit checks were paid for at the start.
      if (pending.mode === 'pro') recordSpend(result.cost);
      refreshAccess();
      const id = newId();
      saveAnalysis({
        title: pending.title,
        claims: result.claims,
        advanced: result.advanced,
        id,
        createdAt: new Date().toISOString(),
        fileName: pending.fileName,
        sourceKind: pending.sourceKind,
      });
      clearPendingCheck();
      router.replace({ pathname: '/result/[id]', params: { id } });
    } catch (err) {
      setBusy(false);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
    }
  };

  if (busy) {
    return (
      <ProgressView
        messages={[
          'Searching scholarly databases…',
          'Matching papers to your sentences…',
          ...(advanced ? ['Searching the web for reports and news…', 'Checking every source is real…'] : []),
          'Formatting citations…',
        ]}
        intervalMs={8000}
        hint={`Finding sources for ${count} sentence${count === 1 ? '' : 's'}.`}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 140 + insets.bottom }]}>
        <Text style={styles.title}>{pending.title}</Text>
        <Text style={styles.muted}>
          We found {pending.claims.length} sentence{pending.claims.length === 1 ? '' : 's'} that may need a citation.
          Untick any you’ve already cited or don’t need, and we’ll find sources for the rest
          {pending.claims.length > MAX_SELECTED ? ` (up to ${MAX_SELECTED} per check)` : ''}.
        </Text>

        <Pressable onPress={toggleAll} hitSlop={8} style={styles.toggleAll}>
          <Ionicons name={allSelected ? 'remove-circle-outline' : 'checkmark-done-outline'} size={18} color={theme.accent} />
          <Text style={styles.link}>{allSelected ? 'Untick all' : 'Tick all'}</Text>
        </Pressable>

        {pending.claims.map((claim, i) => (
          <Pressable
            key={i}
            style={[styles.card, selected[i] ? styles.cardOn : styles.cardOff]}
            onPress={() => toggle(i)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected[i] }}
          >
            <Ionicons
              name={selected[i] ? 'checkbox' : 'square-outline'}
              size={24}
              color={selected[i] ? theme.accent : theme.muted}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.category}>{CATEGORY_LABELS[claim.category]}</Text>
              <Text style={[styles.quote, !selected[i] && { color: theme.muted }]} numberOfLines={5}>
                “{claim.quote}”
              </Text>
              <Text style={styles.reason}>{claim.reason}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={({ pressed }) => [styles.primary, count === 0 && { opacity: 0.4 }, pressed && { opacity: 0.85 }]}
          disabled={count === 0}
          onPress={onFindSources}
        >
          <Ionicons name="search" size={18} color={theme.primaryText} />
          <Text style={styles.primaryText}>
            {count === 0 ? 'Choose at least one sentence' : `Find sources for ${count} sentence${count === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
        <Text style={styles.footnote}>
          {proCheck && usage
            ? advanced
              ? `Advanced search is on: papers, news, reports and statistics · ${Math.round((usage.remaining / usage.allowance) * 100)}% of this month's allowance left.`
              : "Not enough of this month's allowance left for Advanced search, so this check uses academic papers."
            : isPro
              ? 'Using an Essay Pack check: academic papers only.'
              : 'Academic papers only; Pro adds web sources.'}
          {pending.claims.length > MAX_SELECTED ? ` Up to ${MAX_SELECTED} sentences per check.` : ''}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    content: { padding: 16, gap: 12 },
    title: { fontSize: 22, fontWeight: '700', color: t.text },
    muted: { fontSize: 15, color: t.muted, lineHeight: 21 },
    link: { color: t.accent, fontWeight: '700', fontSize: 15 },
    toggleAll: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
    card: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14 },
    cardOn: { backgroundColor: t.card, borderColor: t.accent },
    cardOff: { backgroundColor: t.background, borderColor: t.border },
    category: { fontSize: 12, fontWeight: '700', color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    quote: { fontSize: 15, lineHeight: 22, color: t.text, fontStyle: 'italic' },
    reason: { fontSize: 13, color: t.muted, lineHeight: 18 },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
      backgroundColor: t.background,
      borderTopWidth: 1,
      borderTopColor: t.border,
    },
    primary: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryText: { color: t.primaryText, fontSize: 17, fontWeight: '700' },
    footnote: { fontSize: 12, color: t.muted, textAlign: 'center', lineHeight: 17 },
  });
