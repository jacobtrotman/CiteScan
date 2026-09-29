import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AdPlaceholder } from '@/components/AdPlaceholder';
import { LogoMark } from '@/components/LogoMark';
import { ScrollGame } from '@/components/ScrollGame';
import { useAppState } from '@/lib/app-state';
import { useTheme } from '@/lib/theme';

/**
 * Full-screen "working on it" view that steps through status messages. Underneath, free
 * users see the ad space and Pro users get the waiting game.
 */
export function ProgressView({ messages, intervalMs, hint }: { messages: string[]; intervalMs: number; hint: string }) {
  const theme = useTheme();
  const { access } = useAppState();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, messages.length - 1)), intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.status}>
        <LogoMark size={48} color={theme.accent} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.message, { color: theme.text }]}>{messages[step]}</Text>
          <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
        </View>
        <ActivityIndicator color={theme.accent} />
      </View>

      {access && (access.isPro ? <ScrollGame /> : <AdPlaceholder />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 24, padding: 20 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  message: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 14 },
});
