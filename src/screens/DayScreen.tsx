import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { SkeletonList } from '../components/Skeleton';
import { HomeStackParamList } from '../navigation/types';
import { getApiErrorMessage, Workout } from '../services/api';
import { useCreateWorkout, useDeleteWorkout, useWorkouts } from '../hooks/useWorkouts';

type Props = NativeStackScreenProps<HomeStackParamList, 'Day'>;

function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

export function DayScreen({ route, navigation }: Props) {
  const { date } = route.params;
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');

  const workoutsQuery = useWorkouts({ date });
  const items = workoutsQuery.data ?? [];
  const loading = workoutsQuery.isPending;
  const { refetch } = workoutsQuery;

  const createWorkoutMutation = useCreateWorkout();
  const deleteWorkoutMutation = useDeleteWorkout();
  const saving = createWorkoutMutation.isPending;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (workoutsQuery.isError) {
      Alert.alert('Could not load sessions', getApiErrorMessage(workoutsQuery.error));
    }
  }, [workoutsQuery.isError, workoutsQuery.error]);

  const createSession = async () => {
    if (!title.trim()) {
      Alert.alert('Missing title', 'Give your session a name.');
      return;
    }
    try {
      const workout = await createWorkoutMutation.mutateAsync({ date, title: title.trim() });
      setTitle('');
      setShowModal(false);
      navigation.navigate('Workout', {
        workoutId: workout.id,
        title: workout.title,
        date
      });
    } catch (error) {
      Alert.alert('Could not create session', getApiErrorMessage(error));
    }
  };

  // Deletion invalidates the workouts cache (see useDeleteWorkout), so the list
  // refreshes on its own.
  const confirmDelete = (workout: Workout) => {
    Alert.alert('Delete session?', `"${workout.title}" and its logged sets will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkoutMutation.mutateAsync(workout.id);
          } catch (error) {
            Alert.alert('Delete failed', getApiErrorMessage(error));
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScalePressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Calendar</Text>
        </ScalePressable>
        <Text style={styles.title}>{formatDay(date)}</Text>
        <Text style={styles.subtitle}>
          {items.length === 0
            ? 'No sessions yet'
            : `${items.length} session${items.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      {loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No sessions logged</Text>
              <Text style={styles.emptyText}>Tap “+ New Session” to start one</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ScalePressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('Workout', {
                  workoutId: item.id,
                  title: item.title,
                  date
                })
              }
              onLongPress={() => confirmDelete(item)}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.muscle_groups.length > 0 ? (
                <View style={styles.chipRow}>
                  {item.muscle_groups.map((m) => (
                    <View key={m} style={styles.chip}>
                      <Text style={styles.chipText}>{m}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.cardMeta}>No muscle groups yet</Text>
              )}
            </ScalePressable>
          )}
        />
      )}

      <ScalePressable style={styles.newButton} onPress={() => setShowModal(true)}>
        <Text style={styles.newButtonText}>+ New Session</Text>
      </ScalePressable>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>New session</Text>

                <Text style={styles.label}>SESSION TITLE</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                  placeholder="Morning Push"
                  placeholderTextColor={COLORS.muted}
                  autoFocus
                />

                <View style={styles.modalButtons}>
                  <ScalePressable style={styles.cancelButton} onPress={() => setShowModal(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </ScalePressable>
                  <ScalePressable style={styles.addButton} onPress={createSession} disabled={saving}>
                    {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.addText}>CREATE</Text>}
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
  header: {
    paddingTop: 56,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md
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
    letterSpacing: 1.5,
    fontSize: 34,
    textTransform: 'uppercase'
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13,
    marginTop: -2
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
    flexGrow: 1
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm
  },
  cardTitle: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 19
  },
  cardMeta: {
    marginTop: SPACING.xs,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm
  },
  chip: {
    backgroundColor: COLORS.surface2,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  chipText: {
    color: COLORS.accent,
    fontFamily: FONT.bodyMedium,
    fontSize: 12,
    textTransform: 'capitalize'
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl
  },
  emptyEmoji: {
    fontSize: 42
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
  newButton: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.xl,
    minHeight: 56,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5
  },
  newButtonText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 26,
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
    textTransform: 'uppercase',
    marginBottom: SPACING.sm
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
