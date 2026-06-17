import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { ScalePressable } from '../components/ScalePressable';
import { imageUrlFor, searchExercises } from '../data/exerciseLibrary';
import { HomeStackParamList } from '../navigation/types';
import {
  addMuscleGroup,
  CoachProgression,
  createExercise,
  deleteExercise,
  getApiErrorMessage,
  getProgression,
  getWorkout,
  ProgressionItem,
  removeMuscleGroup,
  updateWorkout,
  WorkoutDetail
} from '../services/api';

type Props = NativeStackScreenProps<HomeStackParamList, 'Workout'>;

// One-line "next target" phrasing from a deterministic progression suggestion.
function progressionTarget(item: ProgressionItem): string {
  switch (item.action) {
    case 'increase_weight':
      return `↑ ${item.suggested_weight}kg × ${item.target_reps}`;
    case 'add_reps':
      return `↑ ${item.target_reps} reps (bodyweight)`;
    case 'hold':
      return `Hold ${item.current_weight}kg × ${item.target_reps}`;
    default:
      return 'Log a baseline';
  }
}

// Mirrors app.muscles.constants.MUSCLE_GROUPS on the backend.
const MUSCLE_OPTIONS: { muscle: string; emoji: string }[] = [
  { muscle: 'chest', emoji: '🫁' },
  { muscle: 'back', emoji: '🦴' },
  { muscle: 'biceps', emoji: '💪' },
  { muscle: 'triceps', emoji: '🦾' },
  { muscle: 'legs', emoji: '🦵' },
  { muscle: 'shoulders', emoji: '🎯' },
  { muscle: 'abs', emoji: '⚡' },
  { muscle: 'cardio', emoji: '🏃' }
];

const emojiFor = (muscle: string) =>
  MUSCLE_OPTIONS.find((m) => m.muscle === muscle)?.emoji ?? '🏋️';

export function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId, date } = route.params;
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  // Coach's deterministic next-session targets for this workout (Feature 2).
  const [progression, setProgression] = useState<CoachProgression | null>(null);
  const [showProgression, setShowProgression] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showMusclePicker, setShowMusclePicker] = useState(false);

  // Add-exercise modal targets one muscle group at a time.
  const [addMuscle, setAddMuscle] = useState<string | null>(null);
  const [exName, setExName] = useState('');
  const [exEmoji, setExEmoji] = useState('🏋️');
  // Image URL chosen from the exercise library (null until one is picked).
  const [exImage, setExImage] = useState<string | null>(null);
  const [savingExercise, setSavingExercise] = useState(false);

  // Library suggestions for the add-exercise search. Hidden once an exercise is
  // picked (its image is set); reappears when the name is edited again.
  const libraryResults = useMemo(() => {
    if (!addMuscle || exImage) return [];
    return searchExercises(exName, addMuscle, 8);
  }, [addMuscle, exName, exImage]);

  const load = useCallback(async () => {
    try {
      const data = await getWorkout(workoutId);
      setDetail(data);
      setTitleDraft(data.title);

      // Coach next-session targets — resolve the workout by its date. Non-fatal:
      // a missing/empty result just hides the card.
      getProgression(date.slice(0, 10))
        .then((prog) =>
          setProgression(prog.items.length ? prog : null)
        )
        .catch(() => setProgression(null));
    } catch (error) {
      Alert.alert('Could not load session', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [workoutId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (!next || next === detail?.title) {
      setEditingTitle(false);
      setTitleDraft(detail?.title ?? '');
      return;
    }
    try {
      const updated = await updateWorkout(workoutId, { title: next });
      setDetail(updated);
      setEditingTitle(false);
    } catch (error) {
      Alert.alert('Could not rename', getApiErrorMessage(error));
    }
  };

  const toggle = (muscle: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(muscle)) {
        next.delete(muscle);
      } else {
        next.add(muscle);
      }
      return next;
    });
  };

  const pickMuscle = async (muscle: string) => {
    setShowMusclePicker(false);
    try {
      const updated = await addMuscleGroup(workoutId, muscle);
      setDetail(updated);
      setExpanded((prev) => new Set(prev).add(muscle));
    } catch (error) {
      Alert.alert('Could not add muscle group', getApiErrorMessage(error));
    }
  };

  const confirmRemoveMuscle = (muscle: string) => {
    Alert.alert('Remove muscle group?', `Remove "${muscle}" from this session?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await removeMuscleGroup(workoutId, muscle);
            setDetail(updated);
          } catch (error) {
            Alert.alert('Could not remove', getApiErrorMessage(error));
          }
        }
      }
    ]);
  };

  const openAddExercise = (muscle: string) => {
    setAddMuscle(muscle);
    setExName('');
    setExEmoji('🏋️');
    setExImage(null);
  };

  // Editing the name invalidates a previously picked library image.
  const onChangeExName = (text: string) => {
    setExName(text);
    if (exImage) setExImage(null);
  };

  const pickLibraryExercise = (name: string, image: string | null) => {
    setExName(name);
    setExImage(image);
  };

  const saveExercise = async () => {
    if (!addMuscle || !exName.trim()) {
      Alert.alert('Missing name', 'Please enter an exercise name.');
      return;
    }
    setSavingExercise(true);
    try {
      await createExercise({
        muscle: addMuscle,
        name: exName.trim(),
        emoji: exEmoji.trim() || '🏋️',
        image_url: exImage ?? undefined
      });
      setAddMuscle(null);
      await load();
    } catch (error) {
      Alert.alert('Could not add exercise', getApiErrorMessage(error));
    } finally {
      setSavingExercise(false);
    }
  };

  const confirmDeleteExercise = (exerciseId: string, name: string) => {
    Alert.alert('Delete exercise?', `${name} and all its logged sets will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExercise(exerciseId);
            await load();
          } catch (error) {
            Alert.alert('Delete failed', getApiErrorMessage(error));
          }
        }
      }
    ]);
  };

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const usedMuscles = new Set(detail.muscle_groups.map((b) => b.muscle));
  const availableMuscles = MUSCLE_OPTIONS.filter((m) => !usedMuscles.has(m.muscle));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScalePressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </ScalePressable>

        {editingTitle ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={saveTitle}
            onSubmitEditing={saveTitle}
            style={styles.titleInput}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <ScalePressable onPress={() => setEditingTitle(true)}>
            <Text style={styles.title}>{detail.title}</Text>
            <Text style={styles.editHint}>Tap title to rename</Text>
          </ScalePressable>
        )}

        {progression && progression.items.length > 0 ? (
          <View style={styles.coachCard}>
            <ScalePressable
              style={styles.coachHeader}
              onPress={() => setShowProgression((v) => !v)}
            >
              <Text style={styles.coachTitle}>🏋️ COACH — NEXT TARGETS</Text>
              <Text style={styles.coachChevron}>{showProgression ? '▾' : '▸'}</Text>
            </ScalePressable>
            {showProgression ? (
              <View style={styles.coachBody}>
                {progression.items.map((item) => (
                  <View key={item.exercise_id} style={styles.coachItem}>
                    <View style={styles.coachItemMain}>
                      <Text style={styles.coachItemName}>{item.exercise_name}</Text>
                      <Text style={styles.coachItemReason}>{item.reason}</Text>
                    </View>
                    <Text style={styles.coachItemTarget}>{progressionTarget(item)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Muscle groups</Text>

        {detail.muscle_groups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No muscle groups yet. Add one to start logging.</Text>
          </View>
        ) : (
          detail.muscle_groups.map((block) => {
            const isOpen = expanded.has(block.muscle);
            return (
              <View key={block.muscle} style={styles.groupCard}>
                <ScalePressable
                  style={styles.groupHeader}
                  onPress={() => toggle(block.muscle)}
                  onLongPress={() => confirmRemoveMuscle(block.muscle)}
                >
                  <Text style={styles.groupEmoji}>{emojiFor(block.muscle)}</Text>
                  <View style={styles.groupHeaderMain}>
                    <Text style={styles.groupName}>{block.muscle}</Text>
                    <Text style={styles.groupMeta}>
                      {block.exercises.length} exercise{block.exercises.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{isOpen ? '▾' : '▸'}</Text>
                </ScalePressable>

                {isOpen ? (
                  <View style={styles.groupBody}>
                    {block.exercises.map((ex) => (
                      <ScalePressable
                        key={ex.id}
                        style={styles.exerciseRow}
                        onPress={() =>
                          navigation.navigate('Session', {
                            exerciseId: ex.id,
                            exerciseName: ex.name,
                            emoji: ex.emoji || '🏋️',
                            workoutId
                          })
                        }
                        onLongPress={() => confirmDeleteExercise(ex.id, ex.name)}
                      >
                        {ex.image_url ? (
                          <Image source={{ uri: ex.image_url }} style={styles.exerciseThumb} />
                        ) : (
                          <Text style={styles.exerciseEmoji}>{ex.emoji || '🏋️'}</Text>
                        )}
                        <View style={styles.exerciseMain}>
                          <Text style={styles.exerciseName}>{ex.name}</Text>
                          <Text style={styles.exerciseMeta}>
                            {ex.logged_set_count > 0
                              ? ex.last_summary || `${ex.logged_set_count} sets logged`
                              : 'Not logged this session'}
                          </Text>
                        </View>
                        {ex.logged_set_count > 0 ? <View style={styles.loggedDot} /> : null}
                      </ScalePressable>
                    ))}

                    <ScalePressable
                      style={styles.addExerciseButton}
                      onPress={() => openAddExercise(block.muscle)}
                    >
                      <Text style={styles.addExerciseText}>+ Add exercise</Text>
                    </ScalePressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <ScalePressable style={styles.addMuscleButton} onPress={() => setShowMusclePicker(true)}>
          <Text style={styles.addMuscleText}>+ Add Muscle Group</Text>
        </ScalePressable>
      </ScrollView>

      {/* Muscle-group picker */}
      <Modal
        visible={showMusclePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMusclePicker(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMusclePicker(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Add muscle group</Text>
                {availableMuscles.length === 0 ? (
                  <Text style={styles.emptyText}>All muscle groups already added.</Text>
                ) : (
                  <View style={styles.pickerGrid}>
                    {availableMuscles.map((m) => (
                      <ScalePressable
                        key={m.muscle}
                        style={styles.pickerItem}
                        onPress={() => pickMuscle(m.muscle)}
                      >
                        <Text style={styles.pickerEmoji}>{m.emoji}</Text>
                        <Text style={styles.pickerLabel}>{m.muscle}</Text>
                      </ScalePressable>
                    ))}
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add-exercise modal */}
      <Modal
        visible={addMuscle !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setAddMuscle(null)}
      >
        <TouchableWithoutFeedback onPress={() => setAddMuscle(null)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Add exercise</Text>
                <Text style={styles.sheetSub}>{addMuscle}</Text>

                <Text style={styles.label}>EXERCISE NAME</Text>
                <TextInput
                  value={exName}
                  onChangeText={onChangeExName}
                  style={styles.input}
                  placeholder="Search e.g. Incline Dumbbell Press"
                  placeholderTextColor={COLORS.muted}
                  autoFocus
                />

                {exImage ? (
                  // A library exercise is selected — show its illustration.
                  <View style={styles.selectedPreview}>
                    <Image source={{ uri: exImage }} style={styles.previewImage} />
                    <View style={styles.previewMain}>
                      <Text style={styles.previewName} numberOfLines={2}>
                        {exName}
                      </Text>
                      <Text style={styles.previewHint}>Illustrated exercise</Text>
                    </View>
                    <ScalePressable
                      style={styles.previewClear}
                      onPress={() => setExImage(null)}
                    >
                      <Text style={styles.previewClearText}>✕</Text>
                    </ScalePressable>
                  </View>
                ) : libraryResults.length > 0 ? (
                  <ScrollView
                    style={styles.results}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                  >
                    {libraryResults.map((item) => {
                      const uri = imageUrlFor(item.img);
                      return (
                        <ScalePressable
                          key={item.id}
                          style={styles.resultRow}
                          onPress={() => pickLibraryExercise(item.name, uri)}
                        >
                          {uri ? (
                            <Image source={{ uri }} style={styles.resultThumb} />
                          ) : (
                            <View style={styles.resultThumb} />
                          )}
                          <View style={styles.resultMain}>
                            <Text style={styles.resultName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.equipment ? (
                              <Text style={styles.resultMeta} numberOfLines={1}>
                                {item.equipment}
                              </Text>
                            ) : null}
                          </View>
                        </ScalePressable>
                      );
                    })}
                  </ScrollView>
                ) : (
                  // No library match — fall back to a manual emoji for a custom name.
                  <>
                    <Text style={styles.label}>EMOJI ICON</Text>
                    <TextInput
                      value={exEmoji}
                      onChangeText={setExEmoji}
                      style={[styles.input, styles.emojiInput]}
                      placeholder="🏋️"
                      placeholderTextColor={COLORS.muted}
                    />
                  </>
                )}

                <View style={styles.modalButtons}>
                  <ScalePressable style={styles.cancelButton} onPress={() => setAddMuscle(null)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </ScalePressable>
                  <ScalePressable style={styles.addButton} onPress={saveExercise} disabled={savingExercise}>
                    {savingExercise ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.addText}>ADD</Text>
                    )}
                  </ScalePressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  back: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 16,
    marginBottom: SPACING.sm
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 40,
    lineHeight: 38,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  titleInput: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 36,
    letterSpacing: 1.5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4
  },
  editHint: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 2
  },
  sectionLabel: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 16
  },
  coachCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden'
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md
  },
  coachTitle: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 16,
    letterSpacing: 1.2
  },
  coachChevron: {
    color: COLORS.accent,
    fontSize: 18,
    fontFamily: FONT.bodyBold
  },
  coachBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.sm
  },
  coachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs
  },
  coachItemMain: {
    flex: 1
  },
  coachItemName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 15
  },
  coachItemReason: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 2
  },
  coachItemTarget: {
    color: COLORS.accent,
    fontFamily: FONT.bodyBold,
    fontSize: 14,
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: 120
  },
  emptyWrap: {
    paddingVertical: SPACING.lg,
    alignItems: 'center'
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 14,
    textAlign: 'center'
  },
  groupCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: 'hidden'
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md
  },
  groupEmoji: {
    fontSize: 24,
    marginRight: SPACING.sm
  },
  groupHeaderMain: {
    flex: 1
  },
  groupName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 17,
    textTransform: 'capitalize'
  },
  groupMeta: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 2
  },
  chevron: {
    color: COLORS.accent,
    fontSize: 18,
    fontFamily: FONT.bodyBold
  },
  groupBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: SPACING.sm,
    paddingTop: SPACING.xs
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs
  },
  exerciseEmoji: {
    fontSize: 22,
    marginRight: SPACING.sm
  },
  exerciseThumb: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface
  },
  exerciseMain: {
    flex: 1
  },
  exerciseName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 15
  },
  exerciseMeta: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 2
  },
  loggedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent
  },
  addExerciseButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    marginTop: SPACING.sm
  },
  addExerciseText: {
    color: COLORS.accent,
    fontFamily: FONT.bodyMedium,
    fontSize: 14
  },
  addMuscleButton: {
    marginTop: SPACING.md,
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: '#2d3910',
    alignItems: 'center',
    justifyContent: 'center'
  },
  addMuscleText: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 22,
    letterSpacing: 1.2
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
    textTransform: 'uppercase'
  },
  sheetSub: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: SPACING.sm
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm
  },
  pickerItem: {
    width: '30%',
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    paddingVertical: SPACING.md
  },
  pickerEmoji: {
    fontSize: 28
  },
  pickerLabel: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 13,
    textTransform: 'capitalize'
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
  emojiInput: {
    textAlign: 'center',
    fontSize: 28
  },
  results: {
    maxHeight: 260,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface
  },
  resultMain: {
    flex: 1
  },
  resultName: {
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 15
  },
  resultMeta: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 1
  },
  selectedPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface
  },
  previewMain: {
    flex: 1
  },
  previewName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 15
  },
  previewHint: {
    color: COLORS.accent,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 2
  },
  previewClear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface
  },
  previewClearText: {
    color: COLORS.muted,
    fontSize: 16,
    fontFamily: FONT.bodyBold
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
