import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { ScalePressable } from '../components/ScalePressable';
import { CoachStackParamList } from '../navigation/types';
import {
  ConversationMessage,
  ProposedAction,
  confirmChat,
  getApiErrorMessage,
  getBriefing,
  getConversation,
  getConversations,
  sendChat
} from '../services/api';

type Props = NativeStackScreenProps<CoachStackParamList, 'Chat'>;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // Coach-proposed writes shown under an assistant bubble for approval. Live only —
  // not persisted as messages, so resumed conversations never re-show them.
  actions?: ProposedAction[];
  actionsResolved?: boolean;
};

// How many recent messages to load when resuming a conversation.
const PAGE = 50;

function nowStamp() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toUiMessage(m: ConversationMessage): Message {
  return { id: m.id, role: m.role, content: m.content, timestamp: formatTime(m.created_at) };
}

function SendIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M21 3L3 11L10.2 13.8L13 21L21 3Z" stroke="#000" strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M10 14L21 3" stroke="#000" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function TypingDots() {
  const a = useRef(new Animated.Value(0.4)).current;
  const b = useRef(new Animated.Value(0.4)).current;
  const c = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 350,
            useNativeDriver: true
          })
        ])
      ).start();

    pulse(a, 0);
    pulse(b, 120);
    pulse(c, 240);
  }, [a, b, c]);

  return (
    <View style={styles.typingDots}>
      <Animated.View style={[styles.dot, { opacity: a }]} />
      <Animated.View style={[styles.dot, { opacity: b }]} />
      <Animated.View style={[styles.dot, { opacity: c }]} />
    </View>
  );
}

export function ChatScreen({ navigation, route }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [publishedLabels, setPublishedLabels] = useState<string[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  // Which proposed actions are ticked for approval (by action_id), and whether a
  // confirm call is in flight.
  const [selectedActions, setSelectedActions] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  // Today's one-line pre-workout briefing (server-cached per day). Dismissable.
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(0.5)).current;
  // Tracks what is currently loaded so we don't reload/wipe an active thread.
  // null = nothing loaded yet, 'new' = a fresh unsaved chat, otherwise an id.
  const loadedIdRef = useRef<string | 'new' | null>(null);

  const openConversation = useCallback(async (id: string) => {
    if (loadedIdRef.current === id) {
      return;
    }
    loadedIdRef.current = id;
    setLoadingHistory(true);
    try {
      // Load the most recent PAGE messages (the first call also tells us the total).
      let detail = await getConversation(id, { limit: PAGE });
      if (detail.message_count > PAGE) {
        detail = await getConversation(id, { limit: PAGE, skip: detail.message_count - PAGE });
      }
      setConversationId(id);
      setMessages(detail.messages.map(toUiMessage));
    } catch (error) {
      loadedIdRef.current = null; // allow a retry
      Alert.alert('Could not load conversation', getApiErrorMessage(error));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const startNewChat = useCallback(() => {
    loadedIdRef.current = 'new';
    setConversationId(null);
    setMessages([]);
    setText('');
    navigation.setParams({ conversationId: undefined });
  }, [navigation]);

  const resumeLast = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const recent = await getConversations({ source: 'chat', limit: 1 });
      const last = recent[0];
      if (last && last.message_count > 0) {
        await openConversation(last.id);
      } else {
        loadedIdRef.current = 'new';
      }
    } catch {
      loadedIdRef.current = 'new';
    } finally {
      setLoadingHistory(false);
    }
  }, [openConversation]);

  // Open the requested conversation (from History), or resume the latest on first mount.
  useEffect(() => {
    const target = route.params?.conversationId;
    if (target) {
      openConversation(target);
    } else if (loadedIdRef.current === null) {
      resumeLast();
    }
  }, [route.params?.conversationId, openConversation, resumeLast]);

  // Keep the published-reference labels fresh (a user may publish from History).
  const refreshLabels = useCallback(async () => {
    try {
      const pubs = await getConversations({ is_published: true, limit: 50 });
      const labels = Array.from(
        new Set(
          pubs
            .map((c) => c.label)
            .filter((l): l is string => !!l && l.trim().length > 0)
        )
      );
      setPublishedLabels(labels);
      setActiveLabels((prev) => prev.filter((l) => labels.includes(l)));
    } catch {
      // non-fatal — references are optional
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshLabels();
    }, [refreshLabels])
  );

  // Pull today's briefing once on mount (server caches it per day, so this is cheap).
  useEffect(() => {
    let active = true;
    getBriefing()
      .then((b) => {
        if (active && b?.text) {
          setBriefing(b.text);
        }
      })
      .catch(() => {
        // non-fatal — the briefing is a nicety, not required
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulse]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages, sending]);

  // Opening the keyboard shrinks the chat viewport (the input bar is padded up),
  // but doesn't change content size — so re-pin to the latest message here.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);

  const toggleLabel = (label: string) => {
    setActiveLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const onSend = async () => {
    const value = text.trim();
    if (!value || sending) {
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-u`,
      role: 'user',
      content: value,
      timestamp: nowStamp()
    };

    setMessages((prev) => [...prev, userMessage]);
    setText('');
    setSending(true);

    try {
      const response = await sendChat({
        message: value,
        conversation_id: conversationId ?? undefined,
        reference_labels: activeLabels.length ? activeLabels : undefined
      });

      // First turn of a new chat: adopt the conversation the server just created.
      if (!conversationId) {
        setConversationId(response.conversation_id);
        loadedIdRef.current = response.conversation_id;
        navigation.setParams({ conversationId: response.conversation_id });
      }

      const proposals = response.proposed_actions ?? [];
      const botMessage: Message = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: response.reply,
        timestamp: nowStamp(),
        actions: proposals.length ? proposals : undefined
      };

      // Pre-tick every actionable proposal (clarification-only ones aren't selectable).
      if (proposals.length) {
        setSelectedActions((prev) => {
          const next = { ...prev };
          proposals.forEach((a) => {
            if (!a.needs_clarification) {
              next[a.action_id] = true;
            }
          });
          return next;
        });
      }

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errMsg = getApiErrorMessage(error, 'Coach unavailable right now.');
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-err`,
          role: 'assistant',
          content: errMsg,
          timestamp: nowStamp()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const toggleAction = (actionId: string) => {
    setSelectedActions((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  // Apply (or dismiss) the proposed actions under one assistant message.
  const reviewActions = async (message: Message, mode: 'apply' | 'dismiss') => {
    if (!conversationId || !message.actions || confirming) {
      return;
    }
    const selectable = message.actions.filter((a) => !a.needs_clarification);
    const accepted =
      mode === 'apply'
        ? selectable.filter((a) => selectedActions[a.action_id]).map((a) => a.action_id)
        : [];
    const rejected = selectable
      .filter((a) => !accepted.includes(a.action_id))
      .map((a) => a.action_id);

    setConfirming(true);
    try {
      const res = await confirmChat({
        conversation_id: conversationId,
        accepted_ids: accepted,
        rejected_ids: rejected
      });
      // Hide the approval card and append the coach's confirmation reply.
      setMessages((prev) => [
        ...prev.map((m) => (m.id === message.id ? { ...m, actionsResolved: true } : m)),
        {
          id: `${Date.now()}-c`,
          role: 'assistant',
          content: res.reply,
          timestamp: nowStamp()
        }
      ]);
    } catch (error) {
      Alert.alert('Could not apply', getApiErrorMessage(error));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // 'padding' is driven by keyboard events (not window resize), so it lifts
      // the input reliably under Android edge-to-edge — where adjustResize is a
      // no-op (Expo SDK 53+/Android 15). The tab bar is hidden while typing via
      // tabBarHideOnKeyboard, so the input sits flush above the keyboard.
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarMain}>
          <Text style={styles.title} numberOfLines={1}>AI COACH</Text>
          <View style={styles.subtitleRow}>
            <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
            <Text style={styles.subtitle}>{sending ? 'Thinking…' : 'Remembers your chats'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <ScalePressable style={styles.actionBtn} onPress={() => navigation.navigate('Goals')}>
            <Text style={styles.actionText}>GOALS</Text>
          </ScalePressable>
          <ScalePressable style={styles.actionBtn} onPress={() => navigation.navigate('Conversations')}>
            <Text style={styles.actionText}>HISTORY</Text>
          </ScalePressable>
          <ScalePressable style={[styles.actionBtn, styles.actionBtnAccent]} onPress={startNewChat}>
            <Text style={[styles.actionText, styles.actionTextAccent]}>+ NEW</Text>
          </ScalePressable>
        </View>
      </View>

      {publishedLabels.length > 0 ? (
        <View style={styles.refRow}>
          <Text style={styles.refCaption}>REFERENCES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.refChips}
          >
            {publishedLabels.map((label) => {
              const active = activeLabels.includes(label);
              return (
                <ScalePressable
                  key={label}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleLabel(label)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </ScalePressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {briefing && !briefingDismissed ? (
        <View style={styles.briefingCard}>
          <View style={styles.briefingMain}>
            <Text style={styles.briefingLabel}>TODAY</Text>
            <Text style={styles.briefingText}>{briefing}</Text>
          </View>
          <ScalePressable style={styles.briefingClose} onPress={() => setBriefingDismissed(true)}>
            <Text style={styles.briefingCloseText}>✕</Text>
          </ScalePressable>
        </View>
      ) : null}

      {loadingHistory && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.chatWrap}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          // Fires after the content is measured, so opening a conversation lands
          // on the latest message (and new messages keep it pinned to the bottom).
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={[styles.bubbleWrap, styles.botWrap]}>
              <Text style={styles.botLabel}>IRONLOG AI</Text>
              <View style={[styles.bubble, styles.botBubble]}>
                <Text style={styles.bubbleText}>
                  Welcome to IRONLOG AI. I remember our past chats and your sessions — ask about
                  progression, volume, or recovery. You can also import a Gemini conversation from
                  History.
                </Text>
              </View>
            </View>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === 'user';
            const hasActions = !!message.actions?.length;
            const showActions = hasActions && !message.actionsResolved;
            const selectable = message.actions?.filter((a) => !a.needs_clarification) ?? [];
            return (
              <View
                key={message.id}
                style={[
                  styles.bubbleWrap,
                  isUser ? styles.userWrap : styles.botWrap,
                  showActions && styles.wideWrap
                ]}
              >
                {!isUser ? <Text style={styles.botLabel}>IRONLOG AI</Text> : null}
                <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
                  <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.content}</Text>
                </View>

                {showActions ? (
                  <View style={styles.actionsCard}>
                    <Text style={styles.actionsTitle}>PROPOSED ACTIONS</Text>
                    {message.actions!.map((a) =>
                      a.needs_clarification ? (
                        <View key={a.action_id} style={styles.actionRow}>
                          <Text style={styles.actionClarify}>❓ {a.clarification ?? a.summary}</Text>
                        </View>
                      ) : (
                        <ScalePressable
                          key={a.action_id}
                          style={styles.actionRow}
                          onPress={() => toggleAction(a.action_id)}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              selectedActions[a.action_id] && styles.checkboxOn
                            ]}
                          >
                            {selectedActions[a.action_id] ? (
                              <Text style={styles.checkMark}>✓</Text>
                            ) : null}
                          </View>
                          <Text style={styles.actionSummary}>{a.summary}</Text>
                        </ScalePressable>
                      )
                    )}
                    {selectable.length ? (
                      <View style={styles.actionButtons}>
                        <ScalePressable
                          style={[styles.confirmBtn, styles.confirmBtnGhost]}
                          onPress={() => reviewActions(message, 'dismiss')}
                        >
                          <Text style={styles.confirmGhostText}>DISMISS</Text>
                        </ScalePressable>
                        <ScalePressable
                          style={styles.confirmBtn}
                          onPress={() => reviewActions(message, 'apply')}
                        >
                          {confirming ? (
                            <ActivityIndicator color="#000" />
                          ) : (
                            <Text style={styles.confirmText}>APPROVE</Text>
                          )}
                        </ScalePressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {hasActions && message.actionsResolved ? (
                  <Text style={styles.actionsReviewed}>✓ Reviewed</Text>
                ) : null}

                <Text style={styles.timestamp}>{message.timestamp}</Text>
              </View>
            );
          })}

          {sending ? (
            <View style={[styles.bubbleWrap, styles.botWrap]}>
              <Text style={styles.botLabel}>IRONLOG AI</Text>
              <View style={[styles.bubble, styles.botBubble]}>
                <TypingDots />
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          style={styles.input}
          placeholder="Ask about progression, volume, recovery..."
          placeholderTextColor={COLORS.muted}
          onSubmitEditing={(event) => {
            if (Platform.OS === 'web' && (event.nativeEvent as { shiftKey?: boolean }).shiftKey) {
              return;
            }
            onSend();
          }}
        />

        <ScalePressable style={styles.sendButton} onPress={onSend}>
          {sending ? <ActivityIndicator color="#000" /> : <SendIcon />}
        </ScalePressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 56
  },
  topBar: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  topBarMain: {
    flex: 1
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 36,
    lineHeight: 34
  },
  subtitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface2,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7
  },
  actionBtnAccent: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  actionText: {
    color: COLORS.text,
    fontFamily: FONT.display,
    fontSize: 14,
    letterSpacing: 1
  },
  actionTextAccent: {
    color: '#000'
  },
  refRow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm
  },
  refCaption: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2
  },
  refChips: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
    alignItems: 'center'
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface2,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  chipText: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 13
  },
  chipTextActive: {
    color: '#000'
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chatWrap: {
    flex: 1
  },
  chatContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md
  },
  bubbleWrap: {
    marginVertical: SPACING.sm,
    maxWidth: '82%'
  },
  botWrap: {
    alignSelf: 'flex-start'
  },
  userWrap: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end'
  },
  botLabel: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: 4
  },
  bubble: {
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2
  },
  botBubble: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 6
  },
  userBubble: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 6
  },
  bubbleText: {
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 15
  },
  userBubbleText: {
    color: '#000',
    fontFamily: FONT.bodyMedium
  },
  timestamp: {
    marginTop: 4,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 10
  },
  briefingCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#2d3910',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2
  },
  briefingMain: {
    flex: 1
  },
  briefingLabel: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 12,
    letterSpacing: 1.5
  },
  briefingText: {
    marginTop: 2,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 14,
    lineHeight: 19
  },
  briefingClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  briefingCloseText: {
    color: COLORS.accent,
    fontFamily: FONT.bodyBold,
    fontSize: 14
  },
  wideWrap: {
    maxWidth: '94%'
  },
  actionsCard: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface2,
    padding: SPACING.md,
    gap: SPACING.sm
  },
  actionsTitle: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 1,
    fontSize: 12
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  checkboxOn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent
  },
  checkMark: {
    color: '#000',
    fontSize: 13,
    fontFamily: FONT.bodyBold,
    lineHeight: 16
  },
  actionSummary: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 14
  },
  actionClarify: {
    flex: 1,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13,
    fontStyle: 'italic'
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 2
  },
  confirmBtn: {
    flex: 1,
    height: 42,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmBtnGhost: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  confirmText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 14,
    letterSpacing: 1
  },
  confirmGhostText: {
    color: COLORS.muted,
    fontFamily: FONT.display,
    fontSize: 14,
    letterSpacing: 1
  },
  actionsReviewed: {
    marginTop: 4,
    color: COLORS.success,
    fontFamily: FONT.bodyMedium,
    fontSize: 11
  },
  inputBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.muted
  }
});
