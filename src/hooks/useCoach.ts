import { useQuery } from '@tanstack/react-query';

import { getBalance, getBriefing, getProgression, getRecap } from '../services/api';
import { queryKeys } from './keys';

export function useRecap(week?: string) {
  return useQuery({ queryKey: queryKeys.recap(week), queryFn: () => getRecap(week) });
}

export function useBalance() {
  return useQuery({ queryKey: queryKeys.balance, queryFn: getBalance });
}

export function useBriefing() {
  return useQuery({ queryKey: queryKeys.briefing, queryFn: getBriefing });
}

export function useProgression(workoutRef: string | null) {
  return useQuery({
    queryKey: queryKeys.progression(workoutRef ?? ''),
    queryFn: () => getProgression(workoutRef as string),
    enabled: !!workoutRef
  });
}
