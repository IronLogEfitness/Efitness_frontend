import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createGoal,
  deleteGoal,
  getGoals,
  getGoalTrajectory,
  Goal,
  GoalStatus,
  GoalTrajectory,
  updateGoal
} from '../services/api';
import { queryKeys, queryRoots } from './keys';

export type GoalRow = Goal & { trajectory?: GoalTrajectory | null };

// Goals plus each goal's deterministic trajectory, fetched in parallel. Mirrors
// the screen's previous load(): a per-goal trajectory failure degrades to null
// rather than failing the whole list.
export function useGoalsWithTrajectory(status?: GoalStatus) {
  return useQuery({
    queryKey: [...queryKeys.goals(status), 'with-trajectory'],
    queryFn: async (): Promise<GoalRow[]> => {
      const list = await getGoals(status);
      return Promise.all(
        list.map(async (goal) => {
          try {
            return { ...goal, trajectory: await getGoalTrajectory(goal.id) };
          } catch {
            return { ...goal, trajectory: null };
          }
        })
      );
    }
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryRoots.goals })
  });
}

type UpdateGoalVars = {
  id: string;
  payload: { target_value?: number; target_date?: string; status?: GoalStatus };
};

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: UpdateGoalVars) => updateGoal(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryRoots.goals })
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryRoots.goals })
  });
}
