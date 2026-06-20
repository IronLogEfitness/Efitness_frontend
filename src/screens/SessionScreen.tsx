import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { ScalePressable } from '../components/ScalePressable';
import {
  createSession,
  getApiErrorMessage,
  getExercise,
  SessionSet
} from '../services/api';
import { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'Session'>;

type EditableSet = {
  id: string;
  set_number: number;
  weight_kg: string;
  reps: string;
};

function emptySet(nextNumber: number): EditableSet {
  return {
    id: `${Date.now()}-${Math.random()}`,
    set_number: nextNumber,
    weight_kg: '',
    reps: ''
  };
}

export function SessionScreen({ route, navigation }: Props) {
  const { exerciseId, exerciseName, emoji, workoutId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sets, setSets] = useState<EditableSet[]>([emptySet(1)]);
  const [notes, setNotes] = useState('');
  const [personalBest, setPersonalBest] = useState<number>(0);
  // Read-only "last time" reference, e.g. "15kg×12 · 15kg×12 · 15kg×12". Shown for
  // context only — the inputs always start empty so you log fresh numbers yourself.
  const [lastTimeHint, setLastTimeHint] = useState<string | null>(null);

  useEffect(() => {
    const loadExercise = async () => {
      setLoading(true);
      try {
        const detail = await getExercise(exerciseId);
        setPersonalBest(detail.personal_best || 0);

        // Always start with a single blank set — never pre-fill from history.
        setSets([emptySet(1)]);

        const lastSets = detail.last_session?.sets ?? [];
        setLastTimeHint(
          lastSets.length
            ? lastSets.map((s) => `${s.weight_kg}kg×${s.reps}`).join(' · ')
            : null
        );
      } catch (error) {
        Alert.alert('Could not load exercise', getApiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    loadExercise();
  }, [exerciseId]);

  const liveMaxWeight = useMemo(() => {
    return sets.reduce((max, current) => {
      const parsed = Number(current.weight_kg);
      if (!Number.isFinite(parsed)) {
        return max;
      }
      return parsed > max ? parsed : max;
    }, 0);
  }, [sets]);

  const newPr = liveMaxWeight > personalBest;

  const patchSet = (id: string, key: 'weight_kg' | 'reps', value: string) => {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, [key]: value } : s)));
  };

  const addSet = () => {
    setSets((prev) => [...prev, emptySet(prev.length + 1)]);
  };

  const removeSet = (id: string) => {
    setSets((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev
        .filter((s) => s.id !== id)
        .map((s, index) => ({
          ...s,
          set_number: index + 1
        }));
    });
  };

  const save = async () => {
    const parsed: SessionSet[] = [];

    for (const row of sets) {
      const weight = Number(row.weight_kg);
      const reps = Number(row.reps);
      if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
        Alert.alert('Invalid set', 'Each set needs a valid weight and reps value.');
        return;
      }
      parsed.push({
        set_number: row.set_number,
        weight_kg: Number(weight.toFixed(2)),
        reps: Math.round(reps)
      });
    }

    setSaving(true);
    try {
      await createSession({
        exercise_id: exerciseId,
        workout_id: workoutId,
        sets: parsed,
        notes: notes.trim() || undefined
      });
      Alert.alert('Session saved', 'Great work. Session logged successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Could not save session', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ScalePressable onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹ Back</Text>
          </ScalePressable>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.exerciseEmoji}>{emoji}</Text>
          <View>
            <Text style={styles.title}>{exerciseName}</Text>
            <Text style={styles.subtitle}>Log today's sets</Text>
          </View>
        </View>

        <View style={[styles.banner, newPr ? styles.bannerPr : styles.bannerNeutral]}>
          <Text style={styles.bannerTitle}>
            {newPr ? `🏆 New PR: ${liveMaxWeight}kg 🎉` : `🎯 Personal Best: ${personalBest || '–'}kg`}
          </Text>
          <Text style={styles.bannerText}>
            {newPr ? 'Amazing — keep going!' : 'Keep pushing to beat it'}
          </Text>
        </View>

        {lastTimeHint ? (
          <View style={styles.lastTime}>
            <Text style={styles.lastTimeLabel}>LAST TIME</Text>
            <Text style={styles.lastTimeValue}>{lastTimeHint}</Text>
          </View>
        ) : null}

        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, { flex: 0.9 }]}>SET</Text>
          <Text style={[styles.headerCell, { flex: 1.6 }]}>WEIGHT (kg)</Text>
          <Text style={[styles.headerCell, { flex: 1.2 }]}>REPS</Text>
          <Text style={[styles.headerCell, { flex: 0.5 }]} />
        </View>

        {sets.map((setRow) => (
          <View style={styles.setRow} key={setRow.id}>
            <Text style={styles.setNumber}>{setRow.set_number}</Text>
            <TextInput
              value={setRow.weight_kg}
              onChangeText={(value) => patchSet(setRow.id, 'weight_kg', value.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              style={[styles.input, { flex: 1.6 }]}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              value={setRow.reps}
              onChangeText={(value) => patchSet(setRow.id, 'reps', value.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1.2 }]}
              placeholder="0"
              placeholderTextColor={COLORS.muted}
            />
            <ScalePressable style={styles.removeButton} onPress={() => removeSet(setRow.id)}>
              <Text style={styles.removeText}>×</Text>
            </ScalePressable>
          </View>
        ))}

        <ScalePressable style={styles.addSetButton} onPress={addSet}>
          <Text style={styles.addSetText}>+ Add set</Text>
        </ScalePressable>

        <Text style={styles.notesLabel}>NOTES (OPTIONAL)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="How did this session feel?"
          placeholderTextColor={COLORS.muted}
          multiline
          style={styles.notesInput}
        />

        <ScalePressable style={styles.saveButton} onPress={save} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveText}>SAVE SESSION</Text>
          )}
        </ScalePressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  headerRow: {
    marginBottom: SPACING.sm
  },
  back: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 16
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md
  },
  exerciseEmoji: {
    fontSize: 36
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 38,
    lineHeight: 34,
    letterSpacing: 2,
    textTransform: 'uppercase'
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  },
  banner: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md
  },
  bannerPr: {
    backgroundColor: '#2d3910',
    borderColor: COLORS.accent
  },
  bannerNeutral: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border
  },
  bannerTitle: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 16
  },
  bannerText: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  },
  lastTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm
  },
  lastTimeLabel: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2
  },
  lastTimeValue: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 13
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm
  },
  headerCell: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm
  },
  setNumber: {
    flex: 0.9,
    color: COLORS.accent,
    textAlign: 'center',
    fontFamily: FONT.display,
    fontSize: 28,
    letterSpacing: 1.3
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    textAlign: 'center',
    fontFamily: FONT.bodyBold,
    fontSize: 16,
    paddingVertical: 10
  },
  removeButton: {
    flex: 0.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeText: {
    color: COLORS.danger,
    fontSize: 30,
    lineHeight: 28
  },
  addSetButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: SPACING.sm
  },
  addSetText: {
    color: COLORS.accent,
    fontFamily: FONT.bodyMedium,
    fontSize: 14
  },
  notesLabel: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  notesInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 14,
    textAlignVertical: 'top',
    padding: SPACING.sm
  },
  saveButton: {
    marginTop: SPACING.lg,
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 26,
    letterSpacing: 1.4
  }
});
