import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { CoachStackParamList } from '../navigation/types';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { ScalePressable } from '../components/ScalePressable';
import { ChatMessagePayload, Conversation, getApiErrorMessage } from '../services/api';
import {
  useConversations,
  useImportConversation,
  useUpdateConversation
} from '../hooks/useConversations';
import { GeminiScrapeResult, GeminiShareWebView } from '../components/GeminiShareWebView';

type Props = NativeStackScreenProps<CoachStackParamList, 'Conversations'>;

const isGeminiShareUrl = (u: string) =>
  /^https?:\/\/gemini\.google\.com\/share\/[\w-]+/i.test(u.trim());

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const isImport = (c: Conversation) => c.source === 'gemini_import';

export function ConversationsScreen({ navigation }: Props) {
  const conversationsQuery = useConversations({ limit: 50 });
  const items = conversationsQuery.data ?? [];
  const loading = conversationsQuery.isPending;

  const importMutation = useImportConversation();
  const updateMutation = useUpdateConversation();

  // Import sheet
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'text' | 'link'>('text');
  const [importUrl, setImportUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState<string | null>(null);
  const [scrapeNote, setScrapeNote] = useState<string | null>(null);

  // Edit (publish / label / rename) sheet
  const [editing, setEditing] = useState<Conversation | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [editPublished, setEditPublished] = useState(false);

  const { refetch } = conversationsQuery;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (conversationsQuery.isError) {
      Alert.alert('Could not load conversations', getApiErrorMessage(conversationsQuery.error));
    }
  }, [conversationsQuery.isError, conversationsQuery.error]);

  const finishImport = async (created: Conversation) => {
    setShowImport(false);
    setImportText('');
    setImportTitle('');
    setImportUrl('');
    setImportMode('text');
    setScrapeNote(null);
    // The import mutation's onSuccess invalidates the conversations cache, so the
    // list refreshes on its own.
    Alert.alert('Imported', `Saved "${created.title ?? 'conversation'}" with ${created.message_count} messages.`);
  };

  const runTextImport = async () => {
    if (!importText.trim()) {
      Alert.alert('Nothing to import', 'Paste the conversation text first.');
      return;
    }
    setImporting(true);
    try {
      const created = await importMutation.mutateAsync({
        raw_text: importText.trim(),
        title: importTitle.trim() || undefined
      });
      await finishImport(created);
    } catch (error) {
      Alert.alert('Import failed', getApiErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  // Link mode just mounts the hidden WebView scraper; the result arrives async.
  const runLinkImport = () => {
    const url = importUrl.trim();
    if (!isGeminiShareUrl(url)) {
      Alert.alert('Invalid link', 'Paste a Gemini share link like https://gemini.google.com/share/…');
      return;
    }
    setScrapeNote(null);
    setImporting(true);
    setScraping(true);
    setScrapeUrl(url);
  };

  const doImport = () => (importMode === 'link' ? runLinkImport() : runTextImport());

  const handleScrapeResult = async (result: GeminiScrapeResult) => {
    setScrapeUrl(null);
    setScraping(false);

    if (result.ok && result.messages.length > 0) {
      try {
        const messages: ChatMessagePayload[] = result.messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
        const created = await importMutation.mutateAsync({
          messages,
          title: importTitle.trim() || undefined
        });
        await finishImport(created);
      } catch (error) {
        Alert.alert('Import failed', getApiErrorMessage(error));
      } finally {
        setImporting(false);
      }
      return;
    }

    // Couldn't read the chat — fall back to paste, pre-filling whatever we grabbed.
    setImporting(false);
    setImportMode('text');
    if (!result.ok) {
      if (result.rawText) {
        setImportText(result.rawText);
      }
      setScrapeNote(
        result.debug && Object.keys(result.debug).length
          ? `Elements seen: ${JSON.stringify(result.debug)}`
          : 'No conversation elements were found on the page.'
      );
    }
    Alert.alert(
      "Couldn't read the link",
      'Gemini didn\'t expose the chat to the importer. I pasted what I could grab below — add "User:" / "Gemini:" markers (or "---" between turns) and import as text.'
    );
  };

  const handleScrapeError = (message: string) => {
    setScrapeUrl(null);
    setScraping(false);
    setImporting(false);
    Alert.alert(
      "Couldn't read the link",
      `${message} Open the conversation, copy it, and paste it here as text instead.`
    );
  };

  const openEdit = (conv: Conversation) => {
    setEditing(conv);
    setEditTitle(conv.title ?? '');
    setEditLabel(conv.label ?? '');
    setEditPublished(conv.is_published);
  };

  const saveEdit = async () => {
    if (!editing) {
      return;
    }
    if (editPublished && !editLabel.trim()) {
      Alert.alert('Add a label', 'Published references need a label so the coach can match them.');
      return;
    }

    setSavingEdit(true);
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        payload: {
          title: editTitle.trim() || undefined,
          label: editLabel.trim(),
          is_published: editPublished
        }
      });
      setEditing(null);
    } catch (error) {
      Alert.alert('Could not save', getApiErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </ScalePressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>HISTORY</Text>
          <Text style={styles.subtitle}>
            {items.length === 0 ? 'No conversations' : `${items.length} conversations`}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Chat with the coach, or tap + to import a Gemini conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <ScalePressable
              style={styles.card}
              onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
              onLongPress={() => openEdit(item)}
            >
              <View style={styles.iconBox}>
                <Text style={styles.iconEmoji}>{isImport(item) ? '📥' : '🤖'}</Text>
              </View>

              <View style={styles.cardMain}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.title || 'Untitled chat'}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.message_count} messages · {isImport(item) ? 'Imported' : 'Chat'} ·{' '}
                  {relativeTime(item.updated_at)}
                </Text>
              </View>

              {item.is_published ? (
                <View style={styles.publishedPill}>
                  <Text style={styles.publishedText} numberOfLines={1}>
                    {item.label || 'PUBLISHED'}
                  </Text>
                </View>
              ) : null}
            </ScalePressable>
          )}
          ListHeaderComponent={
            <Text style={styles.hint}>Tap to open · long-press to publish or rename</Text>
          }
        />
      )}

      <ScalePressable
        style={styles.fab}
        onPress={() => setShowImport(true)}
        accessibilityLabel="Import conversation"
      >
        <Text style={styles.fabText}>+</Text>
      </ScalePressable>

      {/* ── Import sheet ── */}
      <Modal
        visible={showImport}
        animationType="slide"
        transparent
        onRequestClose={() => setShowImport(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowImport(false)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Import conversation</Text>

                <View style={styles.segment}>
                  <ScalePressable
                    style={[styles.segmentBtn, importMode === 'text' && styles.segmentBtnActive]}
                    onPress={() => setImportMode('text')}
                  >
                    <Text style={[styles.segmentText, importMode === 'text' && styles.segmentTextActive]}>
                      PASTE TEXT
                    </Text>
                  </ScalePressable>
                  <ScalePressable
                    style={[styles.segmentBtn, importMode === 'link' && styles.segmentBtnActive]}
                    onPress={() => setImportMode('link')}
                  >
                    <Text style={[styles.segmentText, importMode === 'link' && styles.segmentTextActive]}>
                      SHARE LINK
                    </Text>
                  </ScalePressable>
                </View>

                <Text style={styles.label}>TITLE (OPTIONAL)</Text>
                <TextInput
                  value={importTitle}
                  onChangeText={setImportTitle}
                  style={styles.input}
                  placeholder="e.g. Cutting nutrition plan"
                  placeholderTextColor={COLORS.muted}
                />

                {importMode === 'text' ? (
                  <>
                    <Text style={styles.label}>PASTE CONVERSATION</Text>
                    <TextInput
                      value={importText}
                      onChangeText={setImportText}
                      style={styles.pasteInput}
                      multiline
                      textAlignVertical="top"
                      placeholder={'Paste here. Mark turns with "User:" / "Gemini:", or\nseparate them with a line of "---" (your prompt first).'}
                      placeholderTextColor={COLORS.muted}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>GEMINI SHARE LINK</Text>
                    <TextInput
                      value={importUrl}
                      onChangeText={setImportUrl}
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      placeholder="https://gemini.google.com/share/…"
                      placeholderTextColor={COLORS.muted}
                    />
                    <Text style={styles.helperText}>
                      Best-effort: opens the link on-device and reads the chat. If it can&apos;t,
                      you&apos;ll get the text to paste instead. Native app only.
                    </Text>
                  </>
                )}

                <View style={styles.modalButtons}>
                  <ScalePressable
                    style={styles.cancelButton}
                    onPress={() => setShowImport(false)}
                    disabled={scraping}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </ScalePressable>

                  <ScalePressable style={styles.addButton} onPress={doImport} disabled={importing}>
                    {importing ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.addText}>{importMode === 'link' ? 'READ LINK' : 'IMPORT'}</Text>
                    )}
                  </ScalePressable>
                </View>

                {scraping ? (
                  <Text style={styles.helperText}>Reading from Gemini… this can take a few seconds.</Text>
                ) : null}

                {scrapeNote ? (
                  <Text style={styles.debugNote} selectable>
                    {scrapeNote}
                  </Text>
                ) : null}
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Edit (publish / label / rename) sheet ── */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <TouchableWithoutFeedback onPress={() => setEditing(null)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Edit conversation</Text>

                <Text style={styles.label}>TITLE</Text>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  style={styles.input}
                  placeholder="Conversation title"
                  placeholderTextColor={COLORS.muted}
                />

                <View style={styles.publishRow}>
                  <View style={styles.publishCopy}>
                    <Text style={styles.publishTitle}>Publish as reference</Text>
                    <Text style={styles.publishHint}>
                      Let the coach pull this conversation into future answers.
                    </Text>
                  </View>
                  <Switch
                    value={editPublished}
                    onValueChange={setEditPublished}
                    trackColor={{ true: COLORS.accent, false: COLORS.border }}
                    thumbColor={editPublished ? '#000' : COLORS.muted}
                  />
                </View>

                <Text style={styles.label}>LABEL{editPublished ? '' : ' (OPTIONAL)'}</Text>
                <TextInput
                  value={editLabel}
                  onChangeText={setEditLabel}
                  style={styles.input}
                  autoCapitalize="none"
                  placeholder="e.g. nutrition"
                  placeholderTextColor={COLORS.muted}
                />

                <View style={styles.modalButtons}>
                  <ScalePressable style={styles.cancelButton} onPress={() => setEditing(null)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </ScalePressable>

                  <ScalePressable style={styles.addButton} onPress={saveEdit} disabled={savingEdit}>
                    {savingEdit ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.addText}>SAVE</Text>
                    )}
                  </ScalePressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Hidden scraper: renders the share page on-device to read the chat. */}
      {scrapeUrl ? (
        <GeminiShareWebView
          url={scrapeUrl}
          onResult={handleScrapeResult}
          onError={handleScrapeError}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  back: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 16,
    width: 60
  },
  headerCenter: {
    alignItems: 'center'
  },
  headerSpacer: {
    width: 60
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 40,
    lineHeight: 38,
    textTransform: 'uppercase'
  },
  subtitle: {
    marginTop: -4,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100
  },
  hint: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginBottom: SPACING.sm
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconEmoji: {
    fontSize: 22
  },
  cardMain: {
    flex: 1,
    marginHorizontal: SPACING.md
  },
  cardName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 16
  },
  cardMeta: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    marginTop: 4,
    fontSize: 12
  },
  publishedPill: {
    maxWidth: 96,
    borderRadius: RADIUS.sm,
    backgroundColor: '#2d3910',
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4
  },
  publishedText: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.xl,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5
  },
  fabText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 44,
    lineHeight: 42
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl
  },
  emptyEmoji: {
    fontSize: 46
  },
  emptyTitle: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 20
  },
  emptyText: {
    marginTop: SPACING.sm,
    color: COLORS.muted,
    fontFamily: FONT.body,
    textAlign: 'center'
  },
  overlay: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    paddingBottom: SPACING.xl
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md
  },
  sheetTitle: {
    color: COLORS.text,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 30,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm
  },
  segment: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs
  },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
    paddingVertical: SPACING.sm
  },
  segmentBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  segmentText: {
    color: COLORS.muted,
    fontFamily: FONT.display,
    fontSize: 16,
    letterSpacing: 1
  },
  segmentTextActive: {
    color: '#000'
  },
  helperText: {
    marginTop: SPACING.sm,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    lineHeight: 17
  },
  debugNote: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 11,
    lineHeight: 15
  },
  label: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: SPACING.sm
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2
  },
  pasteInput: {
    minHeight: 160,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 14,
    padding: SPACING.sm
  },
  publishRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md
  },
  publishCopy: {
    flex: 1
  },
  publishTitle: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 15
  },
  publishHint: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelText: {
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 15
  },
  addButton: {
    flex: 2,
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  addText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 24,
    letterSpacing: 1.3
  }
});
