import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { LayoutAnimation, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type Theme } from '@/lib/theme';
import type { Claim, ClaimCategory, Suggestion } from '@/lib/types';

export type CitationStyle = 'apa' | 'mla';

const CATEGORY_LABELS: Record<ClaimCategory, string> = {
  statistic: 'Statistic',
  fact: 'Fact',
  quotation: 'Quotation',
  research_finding: 'Research finding',
  historical: 'Historical detail',
  paraphrased_idea: "Someone else's idea",
};

const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));

/**
 * One flagged sentence. Collapsed it shows the best source and "Show more";
 * tapping expands it to every source, and the ✕ collapses it again.
 * `onLayoutY` / `onCollapse` let the list scroll back to this card after closing.
 */
export function ClaimCard(props: {
  claim: Claim;
  index: number;
  citationStyle: CitationStyle;
  onLayoutY?: (y: number) => void;
  onCollapse?: () => void;
  /** Whether this result already used Pro advanced (web) search. */
  advanced: boolean;
  isPro: boolean;
}) {
  const { claim, index, citationStyle } = props;
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [expanded, setExpanded] = useState(false);

  const suggestions = [...claim.suggestions].sort(
    (a, b) => Number(b.strength === 'strong') - Number(a.strength === 'strong'),
  );
  const [top, ...rest] = suggestions;

  const expand = () => {
    if (expanded) return;
    animate();
    setExpanded(true);
  };
  const collapse = () => {
    animate();
    setExpanded(false);
    props.onCollapse?.();
  };

  return (
    <Pressable
      style={[styles.card, expanded && styles.cardExpanded]}
      onPress={expand}
      onLayout={(e) => props.onLayoutY?.(e.nativeEvent.layout.y)}
      accessibilityRole={expanded ? undefined : 'button'}
      accessibilityHint={expanded ? undefined : 'Shows all sources for this sentence'}
    >
      <View style={styles.header}>
        <Text style={styles.number}>{index + 1}</Text>
        <Text style={styles.category}>{CATEGORY_LABELS[claim.category]}</Text>
        {expanded && (
          <Pressable onPress={collapse} hitSlop={12} style={styles.close} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={theme.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.quote}>
        <Text style={styles.quoteText} numberOfLines={expanded ? undefined : 4}>
          “{claim.quote}”
        </Text>
      </View>

      {expanded && <Text style={styles.reason}>{claim.reason}</Text>}

      {!top ? (
        <Text style={styles.noSources}>
          {expanded
            ? `We couldn’t find a reliable source for this one. Try searching for “${claim.searchQuery}” in your library database or Google Scholar.`
            : 'No source found yet.'}
        </Text>
      ) : (
        <View style={styles.suggestions}>
          {expanded && <Text style={styles.sectionLabel}>Sources ({suggestions.length})</Text>}
          <SuggestionRow suggestion={top} citationStyle={citationStyle} detailed={expanded} theme={theme} first />
          {expanded &&
            rest.map((s) => (
              <SuggestionRow key={s.source.id} suggestion={s} citationStyle={citationStyle} detailed theme={theme} />
            ))}
        </View>
      )}

      {!props.advanced && !suggestions.some((sg) => sg.strength === 'strong') && (
        <Pressable
          style={styles.upsell}
          onPress={() => (props.isPro ? null : router.push({ pathname: '/paywall', params: { reason: 'advanced' } }))}
          disabled={props.isPro}
        >
          <Ionicons name="globe-outline" size={16} color={theme.accent} />
          <Text style={styles.upsellText}>
            {props.isPro
              ? 'Check this essay again to use Advanced search for a stronger source.'
              : 'Find a stronger source with Advanced search'}
          </Text>
          {!props.isPro && (
            <View style={styles.upsellTag}>
              <Text style={styles.upsellTagText}>PRO</Text>
            </View>
          )}
        </Pressable>
      )}

      {!expanded && (
        <View style={styles.more}>
          <Text style={styles.moreText}>
            {rest.length > 0 ? `Show more · ${rest.length} more source${rest.length === 1 ? '' : 's'}` : 'Show more'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.accent} />
        </View>
      )}
    </Pressable>
  );
}

function SuggestionRow(props: {
  suggestion: Suggestion;
  citationStyle: CitationStyle;
  detailed: boolean;
  first?: boolean;
  theme: Theme;
}) {
  const { suggestion, citationStyle, detailed, theme } = props;
  const styles = makeStyles(theme);
  const [copied, setCopied] = useState(false);
  const { source } = suggestion;
  const citation = citationStyle === 'apa' ? suggestion.apa : suggestion.mla;
  const strong = suggestion.strength === 'strong';
  const authors =
    source.authors.length > 3 ? `${source.authors.slice(0, 3).join(', ')} et al.` : source.authors.join(', ');

  const copy = async () => {
    await Clipboard.setStringAsync(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={[styles.suggestion, !props.first && styles.suggestionDivider]}>
      <View style={styles.badges}>
        <View style={[styles.badge, { backgroundColor: strong ? theme.strongSoft : theme.possibleSoft }]}>
          <Text style={[styles.badgeText, { color: strong ? theme.strong : theme.possible }]}>
            {strong ? 'Strong match' : 'Possible match'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
          <Text style={[styles.badgeText, { color: theme.accent }]}>
            {source.origin === 'web' ? 'Web source' : 'Academic paper'}
          </Text>
        </View>
      </View>
      <Text style={styles.sourceTitle} numberOfLines={detailed ? undefined : 2}>
        {source.title}
      </Text>
      <Text style={styles.sourceMeta} numberOfLines={detailed ? undefined : 1}>
        {[authors, source.year, source.venue].filter(Boolean).join(' · ')}
      </Text>
      {detailed && <Text style={styles.explanation}>{suggestion.explanation}</Text>}

      <View style={styles.citationBox}>
        <Text style={styles.citation} selectable numberOfLines={detailed ? undefined : 3}>
          {citation}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={copy} hitSlop={6}>
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={theme.accent} />
          <Text style={styles.actionText}>{copied ? 'Copied' : `Copy ${citationStyle.toUpperCase()}`}</Text>
        </Pressable>
        {source.url && (
          <Pressable style={styles.action} onPress={() => Linking.openURL(source.url!)} hitSlop={6}>
            <Ionicons name="open-outline" size={16} color={theme.accent} />
            <Text style={styles.actionText}>Open source</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 16, gap: 10 },
    cardExpanded: { borderColor: t.accent, borderWidth: 1.5 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    number: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.primary,
      color: t.primaryText,
      textAlign: 'center',
      lineHeight: 24,
      fontWeight: '700',
      fontSize: 13,
      overflow: 'hidden',
    },
    category: { flex: 1, fontSize: 13, fontWeight: '600', color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quote: { backgroundColor: t.quote, borderLeftWidth: 3, borderLeftColor: t.possible, borderRadius: 6, padding: 12 },
    quoteText: { fontSize: 15, lineHeight: 22, color: t.text, fontStyle: 'italic' },
    reason: { fontSize: 14, color: t.muted, lineHeight: 20 },
    noSources: { fontSize: 14, color: t.muted, lineHeight: 20, fontStyle: 'italic' },
    suggestions: { gap: 10 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: t.text, marginTop: 4 },
    suggestion: { gap: 6 },
    suggestionDivider: { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 12 },
    badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    sourceTitle: { fontSize: 15, fontWeight: '600', color: t.text, lineHeight: 21 },
    sourceMeta: { fontSize: 13, color: t.muted },
    explanation: { fontSize: 14, color: t.text, lineHeight: 20 },
    citationBox: { backgroundColor: t.background, borderRadius: 8, padding: 10 },
    citation: { fontSize: 13, color: t.text, lineHeight: 19 },
    actions: { flexDirection: 'row', gap: 18 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
    actionText: { color: t.accent, fontWeight: '600', fontSize: 14 },
    more: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: t.border,
      paddingTop: 10,
    },
    moreText: { color: t.accent, fontWeight: '700', fontSize: 14 },
    upsell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.primarySoft,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    upsellText: { flex: 1, fontSize: 13, fontWeight: '600', color: t.text },
    upsellTag: { backgroundColor: t.primary, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 },
    upsellTagText: { color: t.primaryText, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  });
