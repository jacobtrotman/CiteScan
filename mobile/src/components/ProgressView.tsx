import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LogoMark } from '@/components/LogoMark';
import { useTheme } from '@/lib/theme';

/** Full-screen "working on it" view that steps through status messages. */
export function ProgressView({ messages, intervalMs, hint }: { messages: string[]; intervalMs: number; hint: string }) {
  const theme = useTheme();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, messages.length - 1)), intervalMs);
    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LogoMark size={72} color={theme.accent} />
      <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 16 }} />
      <Text style={[styles.message, { color: theme.text }]}>{messages[step]}</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  message: { fontSize: 17, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  hint: { fontSize: 15, textAlign: 'center' },
});
