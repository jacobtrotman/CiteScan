import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';

/**
 * Where a banner ad will go for free users while they wait. A placeholder until an ad
 * network (AdMob, tracked through RevenueCat) is added; Pro users get the waiting game instead.
 */
export function AdPlaceholder() {
  const theme = useTheme();
  return (
    <View style={[styles.box, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <Text style={[styles.label, { color: theme.muted, borderColor: theme.border }]}>Ad</Text>
      <Text style={[styles.message, { color: theme.text }]}>Advertising helps us keep this a free service</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>CiteScan Pro swaps ads for a mini game.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    height: 250,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  label: {
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.5,
  },
  message: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
});
