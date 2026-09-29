import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/LogoMark';
import { ProgressView } from '@/components/ProgressView';
import { findClaims } from '@/lib/api';
import { pickDocument, pickPagePhotos, scanPage, type Page } from '@/lib/pickers';
import { useAppState } from '@/lib/app-state';
import { setPendingCheck } from '@/lib/pending';
import { getAccess } from '@/lib/purchases';
import { listAnalyses, newId, saveAnalysis } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import type { UploadFile } from '@/lib/types';


const NOTCH_HEIGHT = 64;

const openHistory = () => router.push('/history');
const openPaywall = (reason?: 'out') => router.push({ pathname: '/paywall', params: reason ? { reason } : {} });

export default function HomeScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const insets = useSafeAreaInsets();
  const [pages, setPages] = useState<Page[]>([]);
  const [document, setDocument] = useState<UploadFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);
  const { access, refreshAccess } = useAppState();

  useFocusEffect(
    useCallback(() => {
      listAnalyses()
        .then((all) => setHistoryCount(all.length))
        .catch(() => {});
      refreshAccess();
    }, [refreshAccess]),
  );

  // Swiping up on the notch opens History, like pulling up a drawer.
  const [notchPan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -8,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -24) openHistory();
      },
    }),
  );

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : String(err));
    }
  };

  const onScan = () =>
    run(async () => {
      const page = await scanPage(pages.length + 1);
      if (page) {
        setDocument(null);
        setPages((p) => [...p, page]);
      }
    });

  const onPickPhotos = () =>
    run(async () => {
      const picked = await pickPagePhotos(pages.length);
      if (picked.length) {
        setDocument(null);
        setPages((p) => [...p, ...picked]);
      }
    });

  const onPickFile = () =>
    run(async () => {
      const file = await pickDocument();
      if (file) {
        setPages([]);
        setDocument(file);
      }
    });

  const clear = () => {
    setPages([]);
    setDocument(null);
  };

  const onAnalyze = () =>
    run(async () => {
      // If the purchase check itself fails (e.g. offline), let the scan through rather than block the user.
      const current = await getAccess().catch(() => null);
      if (current && !current.isPro && current.checksLeft <= 0) {
        openPaywall('out');
        return;
      }
      const files: UploadFile[] = document ? [document] : pages.map(({ name, mimeType, data }) => ({ name, mimeType, data }));
      const fileName = document ? document.name : `${pages.length} scanned page${pages.length === 1 ? '' : 's'}`;
      const sourceKind = document ? 'file' : 'scan';
      setBusy(true);
      try {
        // Stage 1 only: find the sentences. Sources are searched after the user reviews them,
        // and an essay check is only used at that point.
        const { title, claims } = await findClaims(files);
        clear();
        if (claims.length === 0) {
          const id = newId();
          saveAnalysis({ title, claims: [], id, createdAt: new Date().toISOString(), fileName, sourceKind });
          router.push({ pathname: '/result/[id]', params: { id } });
        } else {
          setPendingCheck({ title, claims, fileName, sourceKind });
          router.push('/review');
        }
      } finally {
        setBusy(false);
      }
    });

  const hasInput = pages.length > 0 || document !== null;

  if (busy) {
    return (
      <ProgressView
        messages={['Reading your essay…', 'Finding sentences that need a source…', 'Almost there…']}
        intervalMs={5000}
        hint="This usually takes about 10 seconds."
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: NOTCH_HEIGHT + insets.bottom + 24 }]}
      >
        <View style={styles.topRow}>
          <Logo theme={theme} />
          <View style={styles.topActions}>
            <Pressable
              style={[styles.proButton, access?.isPro && styles.proButtonActive]}
              onPress={() => (access?.isPro ? router.push('/pro') : openPaywall())}
              hitSlop={6}
              accessibilityLabel={access?.isPro ? 'Your Pro features' : 'Go Pro'}
            >
              <Text style={[styles.proButtonText, access?.isPro && styles.proButtonTextActive]}>PRO</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={24} color={theme.text} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.tagline}>Scan or upload your essay. We’ll show which statements need a source and suggest real papers, reports and articles to cite.</Text>

        {access && !access.isPro && (
          <Pressable style={({ pressed }) => [styles.plan, pressed && { opacity: 0.8 }]} onPress={() => openPaywall()}>
            <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
            <Text style={styles.planText}>
              {access.checksLeft === 0
                ? 'No essay checks left'
                : `${access.checksLeft} essay check${access.checksLeft === 1 ? '' : 's'} left`}
            </Text>
            <Text style={styles.planLink}>Go Pro</Text>
          </Pressable>
        )}

        <View style={styles.options}>
          <OptionRow icon="camera-outline" label="Scan pages" hint="Photograph printed or handwritten pages" onPress={onScan} theme={theme} />
          <OptionRow icon="images-outline" label="Choose photos" hint="Pick pictures of your essay" onPress={onPickPhotos} theme={theme} />
          <OptionRow icon="document-text-outline" label="Upload a file" hint="PDF, Word or text file" onPress={onPickFile} theme={theme} />
        </View>

        {pages.length > 0 && (
          <View style={styles.selection}>
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionTitle}>
                {pages.length} page{pages.length === 1 ? '' : 's'}
              </Text>
              <Pressable onPress={clear} hitSlop={8}>
                <Text style={styles.link}>Clear</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {pages.map((page, i) => (
                <View key={page.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: page.uri }} style={styles.thumb} />
                  <Text style={styles.thumbLabel}>{i + 1}</Text>
                  <Pressable
                    style={styles.thumbRemove}
                    hitSlop={8}
                    onPress={() => setPages((p) => p.filter((_, j) => j !== i))}
                    accessibilityLabel={`Remove page ${i + 1}`}
                  >
                    <Ionicons name="close-circle" size={22} color={theme.danger} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={[styles.thumb, styles.addPage]} onPress={onScan} accessibilityLabel="Scan another page">
                <Ionicons name="add" size={28} color={theme.accent} />
              </Pressable>
            </ScrollView>
          </View>
        )}

        {document && (
          <View style={[styles.selection, styles.fileRow]}>
            <Ionicons name="document-text" size={28} color={theme.accent} />
            <Text style={[styles.selectionTitle, styles.fileName]} numberOfLines={1}>
              {document.name}
            </Text>
            <Pressable onPress={clear} hitSlop={8} accessibilityLabel="Remove file">
              <Ionicons name="close-circle" size={22} color={theme.muted} />
            </Pressable>
          </View>
        )}

        {hasInput && (
          <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} onPress={onAnalyze}>
            <Ionicons name="search" size={18} color={theme.primaryText} />
            <Text style={styles.primaryText}>Find citations</Text>
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          Suggestions come from scholarly databases and trusted websites, and are a starting point. Always open and read a source before citing
          it.
        </Text>
      </ScrollView>

      <View style={[styles.notchWrap, { paddingBottom: insets.bottom }]} {...notchPan.panHandlers}>
        <Pressable
          style={({ pressed }) => [styles.notch, pressed && { opacity: 0.8 }]}
          onPress={openHistory}
          accessibilityRole="button"
          accessibilityLabel="Open history"
        >
          <View style={styles.grabber} />
          <View style={styles.notchRow}>
            <Ionicons name="time-outline" size={16} color={theme.accent} />
            <Text style={styles.notchText}>History</Text>
            {historyCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{historyCount}</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function Logo({ theme }: { theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <LogoMark size={40} color={theme.accent} />
      <Text style={{ fontSize: 29, fontWeight: '800', color: theme.accent, letterSpacing: -0.5 }}>CiteScan</Text>
    </View>
  );
}

function OptionRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  theme: Theme;
}) {
  const styles = makeStyles(props.theme);
  return (
    <Pressable style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]} onPress={props.onPress}>
      <View style={styles.optionIcon}>
        <Ionicons name={props.icon} size={26} color={props.theme.accent} />
      </View>
      <View style={styles.optionBody}>
        <Text style={styles.optionLabel}>{props.label}</Text>
        <Text style={styles.optionHint}>{props.hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={props.theme.muted} />
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.background },
    content: { paddingHorizontal: 20, gap: 18 },
    center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    proButton: { borderWidth: 1.5, borderColor: t.primary, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
    proButtonActive: { backgroundColor: t.primary },
    proButtonText: { color: t.accent, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
    proButtonTextActive: { color: t.primaryText },
    plan: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.primarySoft,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    planText: { flex: 1, fontSize: 14, fontWeight: '600', color: t.text },
    planLink: { fontSize: 14, fontWeight: '700', color: t.accent },
    tagline: { fontSize: 16, color: t.muted, lineHeight: 23 },
    muted: { fontSize: 15, color: t.muted, lineHeight: 21 },
    options: { gap: 12 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: t.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 18,
      paddingHorizontal: 16,
    },
    optionIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBody: { flex: 1, gap: 2 },
    optionLabel: { fontSize: 17, fontWeight: '700', color: t.text },
    optionHint: { fontSize: 14, color: t.muted },
    selection: { backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: t.border, padding: 14, gap: 10 },
    selectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectionTitle: { fontSize: 16, fontWeight: '600', color: t.text },
    link: { color: t.accent, fontWeight: '600' },
    thumbs: { gap: 10, paddingTop: 6 },
    thumbWrap: { position: 'relative' },
    thumb: { width: 72, height: 96, borderRadius: 8, backgroundColor: t.border },
    thumbLabel: {
      position: 'absolute',
      bottom: 4,
      left: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      color: '#fff',
      fontSize: 11,
      paddingHorizontal: 5,
      borderRadius: 4,
      overflow: 'hidden',
    },
    thumbRemove: { position: 'absolute', top: -8, right: -8, backgroundColor: t.card, borderRadius: 11 },
    addPage: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: t.accent, backgroundColor: t.primarySoft },
    fileRow: { flexDirection: 'row', alignItems: 'center' },
    fileName: { flex: 1 },
    primary: {
      backgroundColor: t.primary,
      borderRadius: 16,
      paddingVertical: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    primaryText: { color: t.primaryText, fontSize: 17, fontWeight: '700' },
    disclaimer: { fontSize: 13, color: t.muted, textAlign: 'center', lineHeight: 19 },
    notchWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
    notch: {
      width: 170,
      height: NOTCH_HEIGHT,
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: t.border,
      alignItems: 'center',
      paddingTop: 8,
      gap: 10,
    },
    grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: t.border },
    notchRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    notchText: { fontSize: 15, fontWeight: '700', color: t.text },
    countBadge: { backgroundColor: t.primary, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
    countText: { color: t.primaryText, fontSize: 12, fontWeight: '700' },
  });
