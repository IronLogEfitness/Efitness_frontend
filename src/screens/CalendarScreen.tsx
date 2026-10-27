import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { ScalePressable } from '../components/ScalePressable';
import { MonthCalendar, todayKey, ymd } from '../components/MonthCalendar';
import { COLORS, FONT, SPACING } from '../components/theme';
import { HomeStackParamList } from '../navigation/types';
import { useAuth } from '../services/AuthContext';
import { getApiErrorMessage } from '../services/api';
import { useWorkouts } from '../hooks/useWorkouts';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Calendar'>;

function monthRange(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return { start: ymd(year, month, 1), end: ymd(year, month, lastDay) };
}

export function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [viewDate, setViewDate] = useState(() => new Date());

  // The query key carries the month range, so changing month refetches on its
  // own. Switching month = just updating viewDate.
  const range = useMemo(() => monthRange(viewDate), [viewDate]);
  const workoutsQuery = useWorkouts(range);
  const { refetch } = workoutsQuery;

  const markedKeys = useMemo(
    () => new Set((workoutsQuery.data ?? []).map((w) => w.date.slice(0, 10))),
    [workoutsQuery.data]
  );

  // Preserve the original refetch-on-focus so a session logged elsewhere shows up.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (workoutsQuery.isError) {
      Alert.alert('Could not load calendar', getApiErrorMessage(workoutsQuery.error));
    }
  }, [workoutsQuery.isError, workoutsQuery.error]);

  const changeMonth = (next: Date) => setViewDate(next);

  const openDay = (key: string) => navigation.navigate('Day', { date: key });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>TRAINING</Text>
          <Text style={styles.subtitle}>Your training journal</Text>
        </View>
        <ScalePressable onPress={() => navigation.navigate('Profile')}>
          <Avatar name={user?.name ?? 'User'} />
        </ScalePressable>
      </View>

      <MonthCalendar
        viewDate={viewDate}
        selectedKey={todayKey()}
        markedKeys={markedKeys}
        onChangeMonth={changeMonth}
        onSelectDay={openDay}
      />

      <ScalePressable style={styles.todayButton} onPress={() => openDay(todayKey())}>
        <Text style={styles.todayButtonText}>OPEN TODAY</Text>
      </ScalePressable>

      <View style={styles.legendRow}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Days with a logged session</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  content: {
    paddingTop: SPACING.xl + 4,
    paddingHorizontal: SPACING.md,
    paddingBottom: 120
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 32
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 14,
    marginTop: -4
  },
  todayButton: {
    marginTop: SPACING.md,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  todayButtonText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 24,
    letterSpacing: 1.4
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent2
  },
  legendText: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  }
});
