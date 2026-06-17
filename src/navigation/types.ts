export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type HomeStackParamList = {
  Calendar: undefined;
  Profile: undefined;
  Day: { date: string }; // YYYY-MM-DD
  Workout: { workoutId: string; title: string; date: string };
  Session: {
    exerciseId: string;
    exerciseName: string;
    emoji: string;
    workoutId: string;
  };
};

export type MainTabParamList = {
  HomeTab: undefined;
  Progress: undefined;
  AICoach: undefined;
};

export type CoachStackParamList = {
  Chat: { conversationId?: string } | undefined;
  Conversations: undefined;
  Goals: undefined;
};
