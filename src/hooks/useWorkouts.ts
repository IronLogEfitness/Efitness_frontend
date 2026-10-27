import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addMuscleGroup,
  addWorkoutExercise,
  createWorkout,
  deleteWorkout,
  getWorkout,
  getWorkouts,
  moveWorkout,
  removeMuscleGroup,
  removeWorkoutExercise,
  updateWorkout
} from '../services/api';
import { queryKeys, queryRoots } from './keys';

type WorkoutRange = { start?: string; end?: string; date?: string };

export function useWorkouts(params: WorkoutRange, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.workouts(params),
    queryFn: () => getWorkouts(params),
    enabled: options?.enabled ?? true
  });
}

export function useWorkout(id: string | null) {
  return useQuery({
    queryKey: queryKeys.workout(id ?? ''),
    queryFn: () => getWorkout(id as string),
    enabled: !!id
  });
}

// Workouts and their sets feed the agenda, the workout detail, and the progress
// stats, so every workout write invalidates both domains.
function invalidateWorkoutData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryRoots.workouts });
  qc.invalidateQueries({ queryKey: queryRoots.progress });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkout,
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string }) => updateWorkout(id, payload),
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useMoveWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => moveWorkout(id, date),
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useAddMuscleGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muscle: string) => addMuscleGroup(id, muscle),
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useRemoveMuscleGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muscle: string) => removeMuscleGroup(id, muscle),
    onSuccess: () => invalidateWorkoutData(qc)
  });
}

export function useAddWorkoutExercise(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { muscle: string; name: string; emoji: string; image_url?: string }) =>
      addWorkoutExercise(workoutId, payload),
    onSuccess: () => {
      invalidateWorkoutData(qc);
      qc.invalidateQueries({ queryKey: queryRoots.exercises });
    }
  });
}

export function useRemoveWorkoutExercise(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => removeWorkoutExercise(workoutId, exerciseId),
    onSuccess: () => invalidateWorkoutData(qc)
  });
}
