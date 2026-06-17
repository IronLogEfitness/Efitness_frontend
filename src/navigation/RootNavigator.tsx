import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useAuth } from '../services/AuthContext';
import { COLORS, FONT } from '../components/theme';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DayScreen } from '../screens/DayScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import {
  AuthStackParamList,
  CoachStackParamList,
  HomeStackParamList,
  MainTabParamList
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CoachStack = createNativeStackNavigator<CoachStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z" stroke={color} strokeWidth={1.8} />
      <Path d="M9 21V13H15V21" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

function ProgressIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="20" x2="20" y2="20" stroke={color} strokeWidth={1.8} />
      <Path d="M6 16L10 12L13 14L18 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="18" cy="8" r="1.5" fill={color} />
    </Svg>
  );
}

function CoachIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 10C4 6.68629 6.68629 4 10 4H14C17.3137 4 20 6.68629 20 10V14C20 17.3137 17.3137 20 14 20H10L5 22L6.2 18.4C4.82937 17.3042 4 15.6459 4 13.9V10Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx="9" cy="12" r="1" fill={color} />
      <Circle cx="12" cy="12" r="1" fill={color} />
      <Circle cx="15" cy="12" r="1" fill={color} />
    </Svg>
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Calendar" component={CalendarScreen} />
      <HomeStack.Screen name="Profile" component={ProfileScreen} />
      <HomeStack.Screen name="Day" component={DayScreen} />
      <HomeStack.Screen name="Workout" component={WorkoutDetailScreen} />
      <HomeStack.Screen name="Session" component={SessionScreen} />
    </HomeStack.Navigator>
  );
}

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator screenOptions={{ headerShown: false }}>
      <CoachStack.Screen name="Chat" component={ChatScreen} />
      <CoachStack.Screen name="Conversations" component={ConversationsScreen} />
      <CoachStack.Screen name="Goals" component={GoalsScreen} />
    </CoachStack.Navigator>
  );
}

function MainTabsNavigator() {
  // Add the device's bottom inset (gesture bar / nav buttons) so the footer
  // never sits under the system navigation. Edge-to-edge draws behind it.
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          { height: 70 + insets.bottom, paddingBottom: 8 + insets.bottom }
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarIcon: ({ color, focused }) => (
          <View style={styles.tabIconWrap}>
            {focused ? <View style={styles.activeDot} /> : <View style={styles.dotPlaceholder} />}
            {route.name === 'HomeTab' && <HomeIcon color={color} />}
            {route.name === 'Progress' && <ProgressIcon color={color} />}
            {route.name === 'AICoach' && <CoachIcon color={color} />}
          </View>
        ),
        tabBarLabel:
          route.name === 'HomeTab'
            ? 'HOME'
            : route.name === 'AICoach'
              ? 'AI COACH'
              : 'PROGRESS'
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="AICoach" component={CoachStackNavigator} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>RESTORING SESSION</Text>
      </View>
    );
  }

  return user ? <MainTabsNavigator /> : <AuthNavigator />;
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FONT.display,
    color: COLORS.accent,
    letterSpacing: 2,
    fontSize: 22
  },
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: 70,
    paddingTop: 8,
    paddingBottom: 8
  },
  tabBarLabel: {
    fontFamily: FONT.display,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 4
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent
  },
  dotPlaceholder: {
    width: 4,
    height: 4
  }
});
