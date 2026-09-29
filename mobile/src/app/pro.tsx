import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Confetti } from '@/components/Confetti';
import { LogoMark } from '@/components/LogoMark';
import { PRO_FEATURES } from '@/lib/pro-features';
import { getAccountDetails } from '@/lib/purchases';
import { useTheme, type Theme } from '@/lib/theme';

/** Shown when a Pro user taps the PRO button: what they've got, with a little celebration. */
export default function ProScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    getAccountDetails()
      .then((a) => setPlanName(a.planName))
      .catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={styles.close} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={20} color={theme.text} />
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <LogoMark size={60} color={theme.accent} />
          </View>
          <Text style={styles.title}>You’re Pro!</Text>
          <Text style={styles.subtitle}>
            {planName ? `${planName} is active. ` : ''}Here’s everything you’ve unlocked.
          </Text>
        </View>

        <View style={styles.features}>
          {PRO_FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDetail}>{f.detail}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={theme.strong} />
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          onPress={() => {
            router.back();
            router.push('/settings');
          }}
        >
          <Ionicons name="color-palette-outline" size={18} color={theme.primaryText} />
          <Text style={styles.primaryText}>Customise colours & icon</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.secondary}>Back to scanning</Text>
        </Pressable>
      </ScrollView>

      <Confetti colours={[theme.accent, theme.primary, '#FB923C', '#34D399', '#FB7185', '#FACC15', '#60A5FA']} />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { padding: 20, gap: 22 },
    close: {
      alignSelf: 'flex-end',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: { alignItems: 'center', gap: 10 },
    heroIcon: {
      width: 92,
      height: 92,
      borderRadius: 28,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 32, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 16, color: t.muted, textAlign: 'center', lineHeight: 23 },
    features: { gap: 14, backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 16 },
    feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: { fontSize: 16, fontWeight: '700', color: t.text },
    featureDetail: { fontSize: 13, color: t.muted, lineHeight: 18 },
    primary: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryText: { color: t.primaryText, fontSize: 16, fontWeight: '700' },
    secondary: { color: t.accent, fontWeight: '600', textAlign: 'center', fontSize: 15 },
  });
