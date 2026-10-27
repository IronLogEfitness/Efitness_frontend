// Centralised React Query key factory. Keeping every key in one place makes
// cache invalidation after mutations explicit and collision-free. Keys are
// hierarchical (`['workouts', 'detail', id]`) so a broad prefix invalidation
// (`['workouts']`) cascades to the specific entries.

export const queryKeys = {
  muscles: ['muscles'] as const,
  exerciseOptions: ['exercises', 'options'] as const,
  exercisesByMuscle: (muscle: string) => ['exercises', 'muscle', muscle] as const,
  exercise: (id: string) => ['exercises', 'detail', id] as const,

  progressOverview: ['progress', 'overview'] as const,
  exerciseProgress: (id: string, days: number) =>
    ['progress', 'exercise', id, days] as const,

  workouts: (params: Record<string, unknown>) => ['workouts', 'list', params] as const,
  workout: (id: string) => ['workouts', 'detail', id] as const,

  goals: (status?: string) => ['goals', 'list', status ?? 'all'] as const,
  goal: (id: string) => ['goals', 'detail', id] as const,
  goalTrajectory: (id: string) => ['goals', 'trajectory', id] as const,

  conversations: (params?: Record<string, unknown>) =>
    ['conversations', 'list', params ?? {}] as const,
  conversation: (id: string, params?: Record<string, unknown>) =>
    ['conversations', 'detail', id, params ?? {}] as const,

  recap: (week?: string) => ['coach', 'recap', week ?? 'current'] as const,
  balance: ['coach', 'balance'] as const,
  briefing: ['coach', 'briefing'] as const,
  progression: (ref: string) => ['coach', 'progression', ref] as const,

  library: (query: string, muscle: string | null, limit: number) =>
    ['library', query, muscle ?? 'all', limit] as const
} as const;

// Broad prefixes for invalidating a whole domain after a write.
export const queryRoots = {
  exercises: ['exercises'] as const,
  progress: ['progress'] as const,
  workouts: ['workouts'] as const,
  goals: ['goals'] as const,
  conversations: ['conversations'] as const,
  coach: ['coach'] as const
} as const;
