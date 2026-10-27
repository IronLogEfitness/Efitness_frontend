import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addMuscleGroup,
  addWorkoutExercise,
  createSession,
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

// Workouts and their sets feed the agenda list, the workout detail, and the
// progress stats. The detail-returning writes below prime the specific workout's
// cache with the server response (no refetch, matching the previous setDetail),
// and invalidate the lists + progress so those refresh.
function invalidateListsAndProgress(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [...queryRoots.workouts, 'list'] });
  qc.invalidateQueries({ queryKey: queryRoots.progress });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkout,
    onSuccess: () => invalidateListsAndProgress(qc)
  });
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string }) => updateWorkout(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(id), data);
      invalidateListsAndProgress(qc);
    }
  });
}

export function useMoveWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => moveWorkout(id, date),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(id), data);
      invalidateListsAndProgress(qc);
    }
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkout,
    onSuccess: () => invalidateListsAndProgress(qc)
  });
}

export function useAddMuscleGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muscle: string) => addMuscleGroup(id, muscle),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(id), data);
      invalidateListsAndProgress(qc);
    }
  });
}

export function useRemoveMuscleGroup(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (muscle: string) => removeMuscleGroup(id, muscle),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(id), data);
      invalidateListsAndProgress(qc);
    }
  });
}

export function useAddWorkoutExercise(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { muscle: string; name: string; emoji: string; image_url?: string }) =>
      addWorkoutExercise(workoutId, payload),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(workoutId), data);
      invalidateListsAndProgress(qc);
      qc.invalidateQueries({ queryKey: queryRoots.exercises });
    }
  });
}

export function useRemoveWorkoutExercise(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => removeWorkoutExercise(workoutId, exerciseId),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.workout(workoutId), data);
      invalidateListsAndProgress(qc);
    }
  });
}

// Logging sets changes the workout detail, personal bests, and progress stats,
// so a new session invalidates all of workouts (detail included), progress, and
// exercises.
export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryRoots.workouts });
      qc.invalidateQueries({ queryKey: queryRoots.progress });
      qc.invalidateQueries({ queryKey: queryRoots.exercises });
    }
  });
}
