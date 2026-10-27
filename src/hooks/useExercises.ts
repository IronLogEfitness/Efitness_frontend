import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createExercise,
  deleteExercise,
  getExercise,
  getExercisesByMuscle,
  getMuscles
} from '../services/api';
import { queryKeys, queryRoots } from './keys';

export type ExerciseOption = { id: string; name: string };

export function useMuscles() {
  return useQuery({ queryKey: queryKeys.muscles, queryFn: getMuscles });
}

export function useExercisesByMuscle(muscle: string | null) {
  return useQuery({
    queryKey: queryKeys.exercisesByMuscle(muscle ?? ''),
    queryFn: () => getExercisesByMuscle(muscle as string),
    enabled: !!muscle
  });
}

export function useExercise(id: string | null) {
  return useQuery({
    queryKey: queryKeys.exercise(id ?? ''),
    queryFn: () => getExercise(id as string),
    enabled: !!id
  });
}

// Every exercise the user has, across all muscle groups that have any,
// de-duplicated. Mirrors the progress screen's previous imperative loadOptions.
// `enabled` lets callers defer the fetch (e.g. until a picker modal opens).
export function useExerciseOptions(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.exerciseOptions,
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<ExerciseOption[]> => {
      const muscles = await getMuscles();
      const withExercises = muscles.filter((m) => m.exercise_count > 0);
      const lists = await Promise.all(
        withExercises.map((m) => getExercisesByMuscle(m.muscle))
      );
      return lists
        .flat()
        .map((ex) => ({ id: ex.id, name: ex.name }))
        .filter((item, index, self) => self.findIndex((e) => e.id === item.id) === index);
    }
  });
}

// A created/deleted exercise changes muscle counts, progress stats, and the
// per-muscle exercise lists, so invalidate all three domains.
function invalidateExerciseData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryRoots.exercises });
  qc.invalidateQueries({ queryKey: queryRoots.progress });
  qc.invalidateQueries({ queryKey: queryKeys.muscles });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createExercise,
    onSuccess: () => invalidateExerciseData(qc)
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteExercise,
    onSuccess: () => invalidateExerciseData(qc)
  });
}
