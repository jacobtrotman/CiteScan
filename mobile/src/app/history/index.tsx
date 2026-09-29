import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppState } from '@/lib/app-state';
import { deleteAnalysis, listAnalyses, renameAnalysis } from '@/lib/storage';
import { useTheme, type Theme } from '@/lib/theme';
import type { SavedAnalysis } from '@/lib/types';

/** Free users can open essays from the last week; older ones stay saved but need Pro. */
const FREE_HISTORY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function matches(item: SavedAnalysis, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    item.fileName.toLowerCase().includes(q) ||
    item.claims.some((c) => c.quote.toLowerCase().includes(q))
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { access } = useAppState();
  const isPro = access?.isPro ?? false;
  const [items, setItems] = useState<SavedAnalysis[] | null>(null);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<SavedAnalysis | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const load = useCallback(() => {
    listAnalyses()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  useFocusEffect(load);

  const [now] = useState(() => Date.now());
  const isLocked = (item: SavedAnalysis) => !isPro && now - new Date(item.createdAt).getTime() > FREE_HISTORY_DAYS * DAY_MS;

  const filtered = useMemo(() => (items ?? []).filter((i) => matches(i, query)), [items, query]);
  const lockedCount = (items ?? []).filter(isLocked).length;

  const confirmDelete = (item: SavedAnalysis) =>
    Alert.alert('Delete this essay?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteAnalysis(item.id);
          load();
        },
      },
    ]);

  const startRename = (item: SavedAnalysis) => {
    setNewTitle(item.title);
    setRenaming(item);
  };

  const saveRename = async () => {
    if (!renaming) return;
    const title = newTitle.trim();
    if (title) await renameAnalysis(renaming.id, title);
    setRenaming(null);
    load();
  };

  const showOptions = (item: SavedAnalysis) =>
    Alert.alert(item.title, undefined, [
      { text: 'Rename', onPress: () => startRename(item) },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const open = (item: SavedAnalysis) => {
    if (isLocked(item)) router.push({ pathname: '/paywall', params: { reason: 'history' } });
    else router.push({ pathname: '/history/[id]', params: { id: item.id } });
  };

  if (items && items.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="documents-outline" size={48} color={theme.muted} />
        <Text style={styles.emptyTitle}>No previous essays yet</Text>
        <Text style={styles.muted}>Essays you scan or upload will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search titles, files and sentences"
          placeholderTextColor={theme.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {query.length > 0 && Platform.OS !== 'ios' && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={theme.muted} />
          </Pressable>
        )}
      </View>

      <FlatList
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          lockedCount > 0 ? (
            <Pressable
              style={styles.lockedBanner}
              onPress={() => router.push({ pathname: '/paywall', params: { reason: 'history' } })}
            >
              <Ionicons name="lock-closed" size={16} color={theme.accent} />
              <Text style={styles.lockedBannerText}>
                {lockedCount} essay{lockedCount === 1 ? ' is' : 's are'} older than {FREE_HISTORY_DAYS} days. Go Pro to
                open your full history.
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={<Text style={[styles.muted, { marginTop: 24 }]}>No essays match “{query.trim()}”.</Text>}
        renderItem={({ item }) => {
          const locked = isLocked(item);
          const found = item.claims.length;
          const withSources = item.claims.filter((c) => c.suggestions.length > 0).length;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, locked && styles.rowLocked, pressed && { opacity: 0.7 }]}
              onPress={() => open(item)}
              onLongPress={() => showOptions(item)}
            >
              <View style={styles.rowIcon}>
                <Ionicons
                  name={locked ? 'lock-closed' : item.sourceKind === 'scan' ? 'camera-outline' : 'document-text-outline'}
                  size={20}
                  color={theme.accent}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {item.fileName} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
                <Text style={[styles.rowMeta, locked && { color: theme.accent, fontWeight: '600' }]}>
                  {locked
                    ? 'Unlock with Pro'
                    : `${found} statement${found === 1 ? '' : 's'} flagged · ${withSources} with sources`}
                </Text>
              </View>
              <Pressable onPress={() => showOptions(item)} hitSlop={10} accessibilityLabel="Options">
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.muted} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename essay</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              selectTextOnFocus
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveRename}
              placeholder="Essay title"
              placeholderTextColor={theme.muted}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalButton} onPress={() => setRenaming(null)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalSave]} onPress={saveRename}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    list: { flex: 1, backgroundColor: t.background },
    listContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 16,
      marginBottom: 12,
      paddingHorizontal: 12,
      backgroundColor: t.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
    },
    searchInput: { flex: 1, paddingVertical: 11, fontSize: 16, color: t.text },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, backgroundColor: t.background },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: t.text },
    muted: { color: t.muted, textAlign: 'center' },
    lockedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: t.primarySoft,
      borderRadius: 12,
      padding: 12,
      marginBottom: 2,
    },
    lockedBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: t.text, lineHeight: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: t.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
    },
    rowLocked: { opacity: 0.65 },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: t.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 16, fontWeight: '600', color: t.text },
    rowMeta: { fontSize: 13, color: t.muted },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
    modalCard: { backgroundColor: t.background, borderRadius: 18, padding: 20, gap: 14, borderWidth: 1, borderColor: t.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: t.text },
    modalInput: {
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 16,
      color: t.text,
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    modalButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
    modalCancel: { color: t.muted, fontWeight: '600', fontSize: 16 },
    modalSave: { backgroundColor: t.primary },
    modalSaveText: { color: t.primaryText, fontWeight: '700', fontSize: 16 },
  });
