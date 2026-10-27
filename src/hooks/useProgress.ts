import { useQuery } from '@tanstack/react-query';

import { getExerciseProgress, getProgressOverview } from '../services/api';
import { queryKeys } from './keys';

export function useProgressOverview() {
  return useQuery({
    queryKey: queryKeys.progressOverview,
    queryFn: getProgressOverview
  });
}

// Weight-over-time points for one exercise. Disabled until an exercise is picked.
export function useExerciseProgress(exerciseId: string | null, days = 120) {
  return useQuery({
    queryKey: queryKeys.exerciseProgress(exerciseId ?? '', days),
    queryFn: () => getExerciseProgress(exerciseId as string, days),
    enabled: !!exerciseId
  });
}
