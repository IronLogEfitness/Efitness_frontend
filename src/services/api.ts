import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://efitness-backend-2530307.azurewebsites.net';
const TOKEN_KEY = 'ironlog_token';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  name: string;
}

export type Gender = 'male' | 'female' | 'other';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  gender?: Gender | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  created_at?: string;
}

export interface UpdateProfilePayload {
  name?: string;
  username?: string;
  gender?: Gender;
  height_cm?: number;
  weight_kg?: number;
  password?: string;
}

export interface MuscleItem {
  muscle: string;
  exercise_count: number;
  last_trained?: string | null;
}

export interface Exercise {
  id: string;
  muscle: string;
  name: string;
  emoji: string;
  personal_best?: number | null;
  last_session_summary?: string | null;
  set_count?: number | null;
  image_url?: string | null;
}

export interface SessionSet {
  set_number: number;
  weight_kg: number;
  reps: number;
}

export interface ExerciseDetail {
  id: string;
  muscle: string;
  name: string;
  emoji: string;
  personal_best?: number | null;
  last_session?: {
    id: string;
    notes?: string | null;
    sets: SessionSet[];
  } | null;
}

// Per-muscle slice of the overview (matches backend MuscleStats).
export interface MuscleStats {
  muscle: string;
  total_sessions: number;
  total_sets: number;
  last_trained?: string | null;
}

// Matches the backend OverviewResponse exactly (app/progress/schemas.py).
export interface ProgressOverview {
  total_sessions: number;
  total_sets: number;
  total_exercises: number;
  prs_this_month: number;
  current_streak: number; // consecutive days with at least one session
  muscle_breakdown: MuscleStats[];
}

export interface ExerciseProgressPoint {
  date: string;
  max_weight: number;
  is_pr: boolean;
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export const tokenStorage = {
  key: TOKEN_KEY,
  save: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  get: () => SecureStore.getItemAsync(TOKEN_KEY)
};

export const register = async (name: string, email: string, password: string) => {
  const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
  return data;
};

export const login = async (email: string, password: string) => {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
};

export const me = async () => {
  const { data } = await api.get<UserProfile>('/auth/me');
  return data;
};

export const updateProfile = async (payload: UpdateProfilePayload) => {
  const { data } = await api.put<UserProfile>('/auth/me', payload);
  return data;
};

export const getMuscles = async () => {
  const { data } = await api.get<MuscleItem[]>('/muscles');
  return data;
};

export const getExercisesByMuscle = async (muscle: string) => {
  const { data } = await api.get<Exercise[]>('/exercises', { params: { muscle } });
  return data;
};

export const getExercise = async (id: string) => {
  const { data } = await api.get<ExerciseDetail>(`/exercises/${id}`);
  return data;
};

export const createExercise = async (payload: {
  muscle: string;
  name: string;
  emoji: string;
  image_url?: string;
}) => {
  const { data } = await api.post<Exercise>('/exercises', payload);
  return data;
};

export const deleteExercise = async (id: string) => {
  await api.delete(`/exercises/${id}`);
};

// ── Exercise library (read-only catalog for the add-exercise picker) ──
// Mirrors one entry of the backend's bundled free-exercise-db dataset. The same
// shape is produced by the local offline fallback (src/data/exerciseLibrary.ts),
// so callers can swap between them transparently.
export interface LibraryExercise {
  id: string;
  name: string;
  equipment: string | null;
  category: string | null;
  muscles: string[];
  img: string | null;
}

// Search the catalog, filtered/ranked by muscle group (the backend is the source
// of truth). An empty query returns the muscle's exercises as defaults. Callers
// should fall back to the bundled library if this fails (e.g. offline).
export const searchLibrary = async (
  query: string,
  muscle: string | null,
  limit = 30
) => {
  const { data } = await api.get<LibraryExercise[]>('/exercise-library', {
    params: { q: query, muscle: muscle ?? undefined, limit }
  });
  return data;
};

export const createSession = async (payload: {
  exercise_id: string;
  workout_id?: string;
  sets: SessionSet[];
  notes?: string;
}) => {
  const { data } = await api.post('/sessions', payload);
  return data;
};

// ── Workouts (training sessions: a titled, day-level container of muscle groups) ──
export interface Workout {
  id: string;
  date: string;
  title: string;
  muscle_groups: string[];
  exercise_count: number;
}

export interface ExerciseInWorkout {
  id: string;
  name: string;
  emoji: string;
  muscle: string;
  logged_set_count: number;
  last_summary?: string | null;
  image_url?: string | null;
}

export interface MuscleGroupBlock {
  muscle: string;
  exercises: ExerciseInWorkout[];
}

export interface WorkoutDetail {
  id: string;
  date: string;
  title: string;
  muscle_groups: MuscleGroupBlock[];
}

export const getWorkouts = async (params: {
  start?: string;
  end?: string;
  date?: string;
}) => {
  const { data } = await api.get<Workout[]>('/workouts', { params });
  return data;
};

export const createWorkout = async (payload: { date: string; title: string }) => {
  const { data } = await api.post<Workout>('/workouts', payload);
  return data;
};

export const getWorkout = async (id: string) => {
  const { data } = await api.get<WorkoutDetail>(`/workouts/${id}`);
  return data;
};

export const updateWorkout = async (id: string, payload: { title: string }) => {
  const { data } = await api.put<WorkoutDetail>(`/workouts/${id}`, payload);
  return data;
};

export const addMuscleGroup = async (id: string, muscle: string) => {
  const { data } = await api.post<WorkoutDetail>(`/workouts/${id}/muscle-groups`, {
    muscle
  });
  return data;
};

export const removeMuscleGroup = async (id: string, muscle: string) => {
  const { data } = await api.delete<WorkoutDetail>(
    `/workouts/${id}/muscle-groups/${muscle}`
  );
  return data;
};

// Add an exercise to ONE workout. The backend finds-or-creates it in the shared
// catalog (so its tracking history is preserved) and links it to this workout only.
export const addWorkoutExercise = async (
  workoutId: string,
  payload: { muscle: string; name: string; emoji: string; image_url?: string }
) => {
  const { data } = await api.post<WorkoutDetail>(
    `/workouts/${workoutId}/exercises`,
    payload
  );
  return data;
};

// Remove an exercise from this workout only (its history in other sessions stays).
export const removeWorkoutExercise = async (workoutId: string, exerciseId: string) => {
  const { data } = await api.delete<WorkoutDetail>(
    `/workouts/${workoutId}/exercises/${exerciseId}`
  );
  return data;
};

export const deleteWorkout = async (id: string) => {
  await api.delete(`/workouts/${id}`);
};

// Reschedule a workout to another day (PATCH). Its logged sets move with it.
export const moveWorkout = async (id: string, date: string) => {
  const { data } = await api.patch<WorkoutDetail>(`/workouts/${id}`, { date });
  return data;
};

export const getProgressOverview = async () => {
  const { data } = await api.get<ProgressOverview>('/progress/overview');
  return data;
};

export interface ExerciseProgress {
  exercise_id: string;
  exercise_name: string;
  emoji: string;
  personal_best: number;
  history: ExerciseProgressPoint[];
}

export const getExerciseProgress = async (exerciseId: string, days = 120) => {
  const { data } = await api.get<ExerciseProgress | ExerciseProgressPoint[]>(
    `/progress/exercise/${exerciseId}`,
    { params: { days } }
  );
  // Backend returns an object wrapping the points under `history`.
  if (Array.isArray(data)) {
    return data;
  }
  return data?.history ?? [];
};

// ── Agentic coach: propose → confirm (human-in-the-loop) ──
export interface PRBadge {
  is_pr: boolean;
  value: number;
  prev_best?: number | null;
}

// A write the coach wants to make, awaiting the user's approval. `args` use human
// references (exercise name, a date/"today", a workout title) — never raw IDs.
export interface ProposedAction {
  action_id: string;
  type: string;
  summary: string;
  args: Record<string, unknown>;
  status: string;
  needs_clarification: boolean;
  clarification?: string | null;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  proposed_actions: ProposedAction[];
}

export interface ActionResult {
  action_id: string;
  // executed | failed | rejected | needs_clarification | not_found | already_executed
  status: string;
  created_id?: string | null;
  detail?: string | null;
  pr?: PRBadge | null;
}

export interface ChatConfirmResponse {
  reply: string;
  results: ActionResult[];
}

export const sendChat = async (payload: {
  message: string;
  conversation_id?: string;
  reference_labels?: string[];
}) => {
  const { data } = await api.post<ChatResponse>('/chat', payload);
  return data;
};

// Apply the proposed actions the user accepted (and record any they rejected).
// Idempotent on the server: re-sending the same accepted_ids never double-writes.
export const confirmChat = async (payload: {
  conversation_id: string;
  accepted_ids: string[];
  rejected_ids?: string[];
}) => {
  const { data } = await api.post<ChatConfirmResponse>('/chat/confirm', payload);
  return data;
};

// ── Conversations (persistent chat memory, import, published references) ──
export interface Conversation {
  id: string;
  title?: string | null;
  source: string; // 'chat' | 'gemini_import'
  is_published: boolean;
  label?: string | null;
  message_count: number;
  has_summary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  token_count: number;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  summary?: string | null;
  messages: ConversationMessage[];
}

export const getConversations = async (params?: {
  source?: string;
  is_published?: boolean;
  limit?: number;
  skip?: number;
}) => {
  const { data } = await api.get<Conversation[]>('/conversations', { params });
  return data;
};

export const getConversation = async (
  id: string,
  params?: { limit?: number; skip?: number }
) => {
  const { data } = await api.get<ConversationDetail>(`/conversations/${id}`, { params });
  return data;
};

export const importConversation = async (payload: {
  title?: string;
  raw_text?: string;
  messages?: ChatMessagePayload[];
}) => {
  const { data } = await api.post<Conversation>('/conversations/import', payload);
  return data;
};

export const updateConversation = async (
  id: string,
  payload: { title?: string; is_published?: boolean; label?: string }
) => {
  const { data } = await api.put<Conversation>(`/conversations/${id}`, payload);
  return data;
};

// ── Coach namespace (read-only, deterministic, cached on the server) ──
export interface CoachBriefing {
  date: string;
  has_workout: boolean;
  title?: string | null;
  text: string;
  cached: boolean;
}

export const getBriefing = async () => {
  const { data } = await api.get<CoachBriefing>('/coach/briefing');
  return data;
};

export interface CoachRecap {
  week: string;
  total_sessions: number;
  total_sets: number;
  prs: number;
  streak: number;
  best_lift?: string | null;
  text: string;
  cached: boolean;
}

export const getRecap = async (week?: string) => {
  const { data } = await api.get<CoachRecap>('/coach/recap', {
    params: week ? { week } : undefined
  });
  return data;
};

export interface ProgressionItem {
  exercise_id: string;
  exercise_name: string;
  action: string; // increase_weight | add_reps | hold | baseline
  current_weight?: number | null;
  suggested_weight?: number | null;
  target_reps?: number | null;
  reason: string;
}

export interface CoachProgression {
  workout_id: string;
  items: ProgressionItem[];
}

// workoutRef may be 'today', a YYYY-MM-DD date, or the workout's title.
export const getProgression = async (workoutRef: string) => {
  const { data } = await api.get<CoachProgression>('/coach/progression', {
    params: { workout_ref: workoutRef }
  });
  return data;
};

export interface BalanceImbalance {
  type: string;
  message: string;
  suggest_muscles: string[];
}

export interface CoachBalance {
  push_sets: number;
  pull_sets: number;
  legs_sets: number;
  push_pull_ratio?: number | null;
  imbalances: BalanceImbalance[];
  balanced: boolean;
}

export const getBalance = async () => {
  const { data } = await api.get<CoachBalance>('/coach/balance');
  return data;
};

// ── Goals (CRUD + deterministic trajectory) ──
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface Goal {
  id: string;
  metric: string;
  exercise_id?: string | null;
  exercise_name?: string | null;
  target_value: number;
  target_date: string;
  status: GoalStatus;
  created_at: string;
}

export interface GoalTrajectory {
  goal_id: string;
  status: string; // no_data | on_track | off_track | achieved
  on_track: boolean;
  current_best?: number | null;
  current?: number | null;
  slope_per_week: number;
  projected_value?: number | null;
  days_remaining: number;
  target_value: number;
  verdict: string;
}

export const getGoals = async (status?: GoalStatus) => {
  const { data } = await api.get<Goal[]>('/goals', {
    params: status ? { status } : undefined
  });
  return data;
};

export const createGoal = async (payload: {
  metric?: string;
  exercise_id?: string;
  target_value: number;
  target_date: string; // YYYY-MM-DD
}) => {
  const { data } = await api.post<Goal>('/goals', payload);
  return data;
};

export const getGoal = async (id: string) => {
  const { data } = await api.get<Goal>(`/goals/${id}`);
  return data;
};

export const getGoalTrajectory = async (id: string) => {
  const { data } = await api.get<GoalTrajectory>(`/goals/${id}/trajectory`);
  return data;
};

export const updateGoal = async (
  id: string,
  payload: { target_value?: number; target_date?: string; status?: GoalStatus }
) => {
  const { data } = await api.put<Goal>(`/goals/${id}`, payload);
  return data;
};

export const deleteGoal = async (id: string) => {
  await api.delete(`/goals/${id}`);
};

export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong') => {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }
  }
  return fallback;
};
