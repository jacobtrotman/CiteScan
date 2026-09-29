import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClaimCard, type CitationStyle } from '@/components/ClaimCard';
import { useAppState } from '@/lib/app-state';
import { getAnalysis } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import type { SavedAnalysis } from '@/lib/types';

/** A saved analysis, shown both after a new scan and when opened from History. */
export function ResultView({ id }: { id: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [analysis, setAnalysis] = useState<SavedAnalysis | null | undefined>(undefined);
  const [style, setStyle] = useState<CitationStyle>('apa');
  const scrollRef = useRef<ScrollView>(null);
  const { access } = useAppState();
  const cardY = useRef<number[]>([]);

  useEffect(() => {
    getAnalysis(id)
      .then(setAnalysis)
      .catch(() => setAnalysis(null));
  }, [id]);

  if (analysis === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (analysis === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>This analysis could not be found.</Text>
      </View>
    );
  }

  const withSources = analysis.claims.filter((c) => c.suggestions.length > 0).length;

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: analysis.title }} />
      <Text style={styles.title}>{analysis.title}</Text>
      <Text style={styles.muted}>
        {analysis.claims.length === 0
          ? "We didn't find any statements that clearly need a citation."
          : `${analysis.claims.length} statement${analysis.claims.length === 1 ? '' : 's'} may need a citation. ` +
            `We found possible sources for ${withSources}.`}
      </Text>

      {analysis.claims.length > 0 && (
        <View style={styles.segment}>
          {(['apa', 'mla'] as const).map((s) => (
            <Pressable key={s} style={[styles.segmentItem, style === s && styles.segmentActive]} onPress={() => setStyle(s)}>
              <Text style={[styles.segmentText, style === s && styles.segmentTextActive]}>{s.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {analysis.claims.map((claim, i) => (
        <ClaimCard
          key={i}
          index={i}
          claim={claim}
          citationStyle={style}
          advanced={analysis.advanced ?? false}
          isPro={access?.isPro ?? false}
          onLayoutY={(y) => (cardY.current[i] = y)}
          // After closing, bring the card back to where it started on screen.
          onCollapse={() => scrollRef.current?.scrollTo({ y: Math.max(0, (cardY.current[i] ?? 0) - 12), animated: true })}
        />
      ))}
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: 16, gap: 14, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background, padding: 24 },
    title: { fontSize: 22, fontWeight: '700', color: t.text },
    muted: { fontSize: 15, color: t.muted, lineHeight: 21 },
    segment: { flexDirection: 'row', backgroundColor: t.card, borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 3, alignSelf: 'flex-start' },
    segmentItem: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 8 },
    segmentActive: { backgroundColor: t.primary },
    segmentText: { fontWeight: '600', color: t.muted },
    segmentTextActive: { color: t.primaryText },
  });
