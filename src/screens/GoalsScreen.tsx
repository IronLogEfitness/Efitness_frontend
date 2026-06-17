import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { CoachStackParamList } from '../navigation/types';
import {
  Goal,
  GoalTrajectory,
  createGoal,
  deleteGoal,
  getApiErrorMessage,
  getExercisesByMuscle,
  getGoals,
  getGoalTrajectory,
  getMuscles,
  updateGoal
} from '../services/api';

type Props = NativeStackScreenProps<CoachStackParamList, 'Goals'>;

type ExerciseOption = { id: string; name: string };
type GoalRow = Goal & { trajectory?: GoalTrajectory | null };

const DEADLINE_PRESETS: { label: string; months: number }[] = [
  { label: '1 MO', months: 1 },
  { label: '3 MO', months: 3 },
  { label: '6 MO', months: 6 },
  { label: '12 MO', months: 12 }
];

function addMonths(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Colour for a trajectory verdict.
function statusColor(status?: string): string {
  switch (status) {
    case 'achieved':
      return COLORS.accent;
    case 'on_track':
      return COLORS.success;
    case 'off_track':
      return COLORS.accent2;
    default:
      return COLORS.muted;
  }
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'achieved':
      return 'ACHIEVED';
    case 'on_track':
      return 'ON TRACK';
    case 'off_track':
      return 'BEHIND';
    default:
      return 'NO DATA';
  }
}

export function GoalsScreen({ navigation }: Props) {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState('');
  const [deadlineMonths, setDeadlineMonths] = useState(3);
  const [saving, setSaving] = useState(false);

  const deadlineDate = useMemo(() => addMonths(deadlineMonths), [deadlineMonths]);

  const load = useCallback(async () => {
    try {
      const list = await getGoals();
      // Fetch each goal's trajectory in parallel (deterministic + cheap server-side).
      const withTrajectory = await Promise.all(
        list.map(async (g) => {
          try {
            const trajectory = await getGoalTrajectory(g.id);
            return { ...g, trajectory };
          } catch {
            return { ...g, trajectory: null };
          }
        })
      );
      setGoals(withTrajectory);
    } catch (error) {
      Alert.alert('Could not load goals', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadExerciseOptions = useCallback(async () => {
    try {
      const muscles = await getMuscles();
      const withExercises = muscles.filter((m) => m.exercise_count > 0);
      const lists = await Promise.all(withExercises.map((m) => getExercisesByMuscle(m.muscle)));
      const options = lists
        .flat()
        .map((ex) => ({ id: ex.id, name: ex.name }))
        .filter((item, i, self) => self.findIndex((e) => e.id === item.id) === i);
      setExerciseOptions(options);
      if (options[0]) {
        setExerciseId(options[0].id);
      }
    } catch {
      // non-fatal — a goal can be created without an exercise
    }
  }, []);

  const openCreate = () => {
    setTargetValue('');
    setDeadlineMonths(3);
    setShowCreate(true);
    if (exerciseOptions.length === 0) {
      loadExerciseOptions();
    }
  };

  const save = async () => {
    const value = parseFloat(targetValue.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      Alert.alert('Invalid target', 'Enter a target weight greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await createGoal({
        exercise_id: exerciseId ?? undefined,
        target_value: value,
        target_date: toYMD(deadlineDate)
      });
      setShowCreate(false);
      setLoading(true);
      await load();
    } catch (error) {
      Alert.alert('Could not create goal', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const markAchieved = async (goal: Goal) => {
    try {
      await updateGoal(goal.id, { status: 'achieved' });
      await load();
    } catch (error) {
      Alert.alert('Could not update', getApiErrorMessage(error));
    }
  };

  const confirmDelete = (goal: Goal) => {
    Alert.alert('Delete goal?', 'This removes the goal permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(goal.id);
            await load();
          } catch (error) {
            Alert.alert('Delete failed', getApiErrorMessage(error));
          }
        }
      }
    ]);
  };

  const renderGoal = ({ item }: { item: GoalRow }) => {
    const t = item.trajectory;
    const color = statusColor(t?.status);
    const best = t?.current_best ?? null;
    const pct =
      best != null && item.target_value > 0
        ? Math.max(0, Math.min(1, best / item.target_value))
        : 0;
    const label = item.exercise_name || item.metric || 'Goal';

    return (
      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalHeaderMain}>
            <Text style={styles.goalName}>{label}</Text>
            <Text style={styles.goalTarget}>
              {item.target_value}kg by {fmtDate(item.target_date)}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: color }]}>
            <Text style={[styles.statusPillText, { color }]}>
              {item.status === 'achieved' ? 'ACHIEVED' : statusLabel(t?.status)}
            </Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressMetaText}>
            {best != null ? `${best}kg best` : 'no lifts yet'}
          </Text>
          <Text style={styles.progressMetaText}>
            {t && t.days_remaining >= 0 ? `${t.days_remaining}d left` : 'past due'}
          </Text>
        </View>

        {t?.verdict ? <Text style={styles.verdict}>{t.verdict}</Text> : null}

        <View style={styles.goalActions}>
          {item.status !== 'achieved' ? (
            <ScalePressable
              style={[styles.smallBtn, styles.smallBtnGhost]}
              onPress={() => markAchieved(item)}
            >
              <Text style={styles.smallBtnGhostText}>MARK DONE</Text>
            </ScalePressable>
          ) : null}
          <ScalePressable
            style={[styles.smallBtn, styles.smallBtnGhost]}
            onPress={() => confirmDelete(item)}
          >
            <Text style={styles.smallBtnDangerText}>DELETE</Text>
          </ScalePressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Back</Text>
        </ScalePressable>
        <ScalePressable style={styles.newBtn} onPress={openCreate}>
          <Text style={styles.newBtnText}>+ NEW</Text>
        </ScalePressable>
      </View>

      <Text style={styles.title}>GOALS</Text>
      <Text style={styles.subtitle}>Set a target, track the pace</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderGoal}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No goals yet. Tap + NEW — or just ask the coach: “bench 80kg by August”.
              </Text>
            </View>
          }
        />
      )}

      {/* Create-goal modal */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <TouchableWithoutFeedback onPress={() => setShowCreate(false)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>New goal</Text>

                <Text style={styles.label}>EXERCISE</Text>
                {exerciseOptions.length === 0 ? (
                  <Text style={styles.hint}>
                    No exercises found — add some first to track a lift, or create a generic goal.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.pillRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {exerciseOptions.map((ex) => (
                      <ScalePressable
                        key={ex.id}
                        style={[styles.pill, exerciseId === ex.id && styles.pillActive]}
                        onPress={() => setExerciseId(ex.id)}
                      >
                        <Text style={[styles.pillText, exerciseId === ex.id && styles.pillTextActive]}>
                          {ex.name}
                        </Text>
                      </ScalePressable>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.label}>TARGET WEIGHT (KG)</Text>
                <TextInput
                  value={targetValue}
                  onChangeText={setTargetValue}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="e.g. 80"
                  placeholderTextColor={COLORS.muted}
                />

                <Text style={styles.label}>DEADLINE</Text>
                <View style={styles.deadlineRow}>
                  {DEADLINE_PRESETS.map((preset) => (
                    <ScalePressable
                      key={preset.months}
                      style={[
                        styles.deadlineChip,
                        deadlineMonths === preset.months && styles.deadlineChipActive
                      ]}
                      onPress={() => setDeadlineMonths(preset.months)}
                    >
                      <Text
                        style={[
                          styles.deadlineChipText,
                          deadlineMonths === preset.months && styles.deadlineChipTextActive
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </ScalePressable>
                  ))}
                </View>
                <Text style={styles.hint}>Target date: {fmtDate(deadlineDate.toISOString())}</Text>

                <View style={styles.modalButtons}>
                  <ScalePressable style={styles.cancelButton} onPress={() => setShowCreate(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </ScalePressable>
                  <ScalePressable style={styles.addButton} onPress={save} disabled={saving}>
                    {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.addText}>SAVE</Text>}
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
    backgroundColor: COLORS.bg,
    paddingTop: 56,
    paddingHorizontal: SPACING.md
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  back: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 16
  },
  newBtn: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 7
  },
  newBtnText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 14,
    letterSpacing: 1
  },
  title: {
    marginTop: SPACING.sm,
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 36,
    lineHeight: 34
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13,
    marginBottom: SPACING.md
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingBottom: 110
  },
  empty: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center'
  },
  emptyText: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: SPACING.md
  },
  goalCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm
  },
  goalHeaderMain: {
    flex: 1
  },
  goalName: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 17
  },
  goalTarget: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusPillText: {
    fontFamily: FONT.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  progressTrack: {
    marginTop: SPACING.md,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface2,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 4
  },
  progressMeta: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  progressMetaText: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 11
  },
  verdict: {
    marginTop: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 13,
    lineHeight: 18
  },
  goalActions: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm
  },
  smallBtn: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8
  },
  smallBtnGhost: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  smallBtnGhostText: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1
  },
  smallBtnDangerText: {
    color: COLORS.danger,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1
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
    marginBottom: SPACING.xs
  },
  label: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: SPACING.md
  },
  hint: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 12,
    marginTop: 6
  },
  pillRow: {
    maxHeight: 38
  },
  pill: {
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#2d3910'
  },
  pillText: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 12
  },
  pillTextActive: {
    color: COLORS.accent
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
  deadlineRow: {
    flexDirection: 'row',
    gap: SPACING.sm
  },
  deadlineChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.sm,
    paddingVertical: 10
  },
  deadlineChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#2d3910'
  },
  deadlineChipText: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    letterSpacing: 1
  },
  deadlineChipTextActive: {
    color: COLORS.accent
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
