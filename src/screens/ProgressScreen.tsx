import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryTheme } from 'victory-native';
import { Avatar } from '../components/Avatar';
import { ScalePressable } from '../components/ScalePressable';
import { Skeleton } from '../components/Skeleton';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { useAuth } from '../services/AuthContext';
import { getApiErrorMessage } from '../services/api';
import { ExerciseOption, useExerciseOptions } from '../hooks/useExercises';
import { useBalance, useRecap } from '../hooks/useCoach';
import { useExerciseProgress, useProgressOverview } from '../hooks/useProgress';
import { useWorkouts } from '../hooks/useWorkouts';

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function monthShort(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString(undefined, { month: 'short' });
}

function dateLine(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    return date;
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

export function ProgressScreen() {
  const { user } = useAuth();

  // Range for the "recent sessions" list: workouts in the last 60 days. Computed
  // once per mount so the query key stays stable across renders.
  const range = useMemo(() => {
    const today = new Date();
    const since = new Date();
    since.setDate(since.getDate() - 60);
    return { start: ymd(since), end: ymd(today) };
  }, []);

  const overviewQuery = useProgressOverview();
  const optionsQuery = useExerciseOptions();
  const recapQuery = useRecap();
  const balanceQuery = useBalance();
  const workoutsQuery = useWorkouts(range);

  const overview = overviewQuery.data ?? null;
  const exerciseOptions = optionsQuery.data ?? [];
  // Coach cards are a bonus layer: a failure just hides the card (the query error
  // is swallowed here exactly as the previous .catch(() => null) did).
  const recap = recapQuery.data ?? null;
  const balance = balanceQuery.data ?? null;
  // Recent sessions: the last 60 days of workouts, most recent first, capped at 15.
  const recentWorkouts = useMemo(
    () => (workoutsQuery.data ? [...workoutsQuery.data].reverse().slice(0, 15) : []),
    [workoutsQuery.data]
  );

  // The core load is the stats + the exercise picker; everything else loads in
  // parallel without blocking or failing it.
  const loading = overviewQuery.isPending || optionsQuery.isPending;

  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null);
  // Default to the first exercise once the options arrive.
  useEffect(() => {
    if (!selectedExercise && exerciseOptions.length > 0) {
      setSelectedExercise(exerciseOptions[0]);
    }
  }, [exerciseOptions, selectedExercise]);

  const progressQuery = useExerciseProgress(selectedExercise?.id ?? null);
  const chartData = progressQuery.data ?? [];

  const pickExercise = (exercise: ExerciseOption) => setSelectedExercise(exercise);

  useEffect(() => {
    if (overviewQuery.isError || optionsQuery.isError) {
      Alert.alert(
        'Could not load progress',
        getApiErrorMessage(overviewQuery.error ?? optionsQuery.error)
      );
    }
  }, [overviewQuery.isError, optionsQuery.isError, overviewQuery.error, optionsQuery.error]);

  useEffect(() => {
    if (progressQuery.isError) {
      Alert.alert('Could not load chart', getApiErrorMessage(progressQuery.error));
    }
  }, [progressQuery.isError, progressQuery.error]);

  const chartPoints = useMemo(() => {
    if (!Array.isArray(chartData)) {
      return [];
    }
    return chartData.map((point) => ({
      x: monthShort(point.date) || point.date,
      y: point.max_weight
    }));
  }, [chartData]);

  if (loading) {
    return (
      <View style={styles.content}>
        <Skeleton width="45%" height={34} />
        <Skeleton width="70%" height={14} style={styles.skeletonSubtitle} />
        <View style={styles.skeletonStatsRow}>
          <Skeleton height={90} radius={RADIUS.md} style={styles.skeletonStat} />
          <Skeleton height={90} radius={RADIUS.md} style={styles.skeletonStat} />
          <Skeleton height={90} radius={RADIUS.md} style={styles.skeletonStat} />
        </View>
        <Skeleton height={260} radius={RADIUS.lg} style={styles.skeletonChart} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={recentWorkouts}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.title}>PROGRESS</Text>
              <Text style={styles.subtitle}>Your journey so far</Text>
            </View>
            <Avatar name={user?.name || 'User'} />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview?.total_sessions || 0}</Text>
              <Text style={styles.statLabel}>SESSIONS</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview?.prs_this_month || 0}</Text>
              <Text style={styles.statLabel}>PRS THIS MONTH</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{overview?.current_streak || 0}</Text>
              <Text style={styles.statLabel}>DAY STREAK</Text>
            </View>
          </View>

          {recap ? (
            <View style={styles.coachCard}>
              <Text style={styles.coachLabel}>THIS WEEK · {recap.week}</Text>
              <Text style={styles.coachText}>{recap.text}</Text>
              <View style={styles.recapStatsRow}>
                <Text style={styles.recapStat}>{recap.total_sessions} sessions</Text>
                <Text style={styles.recapStat}>{recap.total_sets} sets</Text>
                <Text style={styles.recapStat}>{recap.prs} PRs</Text>
                <Text style={styles.recapStat}>{recap.streak}d streak</Text>
              </View>
              {recap.best_lift ? (
                <Text style={styles.recapBest}>🏆 Best lift: {recap.best_lift}</Text>
              ) : null}
            </View>
          ) : null}

          {balance ? (
            <View style={styles.coachCard}>
              <Text style={styles.coachLabel}>PUSH · PULL · LEGS BALANCE</Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceValue}>{balance.push_sets}</Text>
                  <Text style={styles.balanceColLabel}>PUSH</Text>
                </View>
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceValue}>{balance.pull_sets}</Text>
                  <Text style={styles.balanceColLabel}>PULL</Text>
                </View>
                <View style={styles.balanceCol}>
                  <Text style={styles.balanceValue}>{balance.legs_sets}</Text>
                  <Text style={styles.balanceColLabel}>LEGS</Text>
                </View>
              </View>
              {balance.balanced ? (
                <Text style={styles.balanceOk}>✓ Well balanced — keep it up.</Text>
              ) : (
                balance.imbalances.map((im) => (
                  <Text key={im.type} style={styles.balanceWarn}>
                    ⚠ {im.message}
                  </Text>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {selectedExercise ? `${selectedExercise.name} – weight over time` : 'No exercise data yet'}
            </Text>

            <FlatList
              horizontal
              data={exerciseOptions}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              style={styles.exercisePills}
              renderItem={({ item }) => (
                <ScalePressable
                  style={[
                    styles.pill,
                    selectedExercise?.id === item.id && styles.pillActive
                  ]}
                  onPress={() => pickExercise(item)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedExercise?.id === item.id && styles.pillTextActive
                    ]}
                  >
                    {item.name}
                  </Text>
                </ScalePressable>
              )}
            />

            {chartPoints.length > 0 ? (
              <VictoryChart
                height={220}
                theme={VictoryTheme.material}
                domainPadding={{ x: 16, y: 20 }}
                padding={{ top: 20, left: 40, right: 20, bottom: 36 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: COLORS.border },
                    tickLabels: { fill: COLORS.muted, fontSize: 10, fontFamily: FONT.body }
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: COLORS.border },
                    grid: { stroke: '#1f1f1f' },
                    tickLabels: { fill: COLORS.muted, fontSize: 10, fontFamily: FONT.body }
                  }}
                />
                <VictoryArea
                  interpolation="monotoneX"
                  data={chartPoints}
                  style={{
                    data: {
                      fill: 'rgba(232,255,71,0.2)',
                      stroke: COLORS.accent,
                      strokeWidth: 2
                    }
                  }}
                />
              </VictoryChart>
            ) : (
              <View style={styles.chartEmpty}>
                <Text style={styles.chartEmptyText}>No chart points yet</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionHeading}>Recent sessions</Text>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryText}>No sessions logged yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.historyCard}>
          <Text style={styles.historyDate}>{dateLine(item.date)}</Text>
          <Text style={styles.historyMuscles}>{item.title}</Text>
          <Text style={styles.historySummary}>
            {item.muscle_groups.length > 0
              ? item.muscle_groups.join(', ')
              : 'No muscle groups'}
            {` · ${item.exercise_count} exercise${item.exercise_count === 1 ? '' : 's'}`}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: SPACING.md,
    paddingBottom: 110
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  skeletonSubtitle: {
    marginTop: SPACING.sm
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg
  },
  skeletonStat: {
    flex: 1
  },
  skeletonChart: {
    marginTop: SPACING.md
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 2,
    fontSize: 36,
    lineHeight: 34
  },
  subtitle: {
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  },
  statsRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.sm
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center'
  },
  statValue: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    letterSpacing: 1.3,
    fontSize: 32
  },
  statLabel: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
    textAlign: 'center'
  },
  coachCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md
  },
  coachLabel: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 14,
    letterSpacing: 1.4
  },
  coachText: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    fontFamily: FONT.body,
    fontSize: 14,
    lineHeight: 20
  },
  recapStatsRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm
  },
  recapStat: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  recapBest: {
    marginTop: SPACING.sm,
    color: COLORS.accent,
    fontFamily: FONT.bodyBold,
    fontSize: 13
  },
  balanceRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm
  },
  balanceCol: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm
  },
  balanceValue: {
    color: COLORS.text,
    fontFamily: FONT.display,
    fontSize: 28,
    letterSpacing: 1
  },
  balanceColLabel: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  balanceOk: {
    marginTop: SPACING.sm,
    color: COLORS.success,
    fontFamily: FONT.bodyMedium,
    fontSize: 13
  },
  balanceWarn: {
    marginTop: SPACING.sm,
    color: COLORS.accent2,
    fontFamily: FONT.bodyMedium,
    fontSize: 13,
    lineHeight: 18
  },
  chartCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md
  },
  chartTitle: {
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 16
  },
  exercisePills: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    maxHeight: 34
  },
  pill: {
    marginRight: SPACING.sm,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  pillActive: {
    borderColor: COLORS.accent,
    backgroundColor: '#2d3910'
  },
  pillText: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    fontSize: 12
  },
  pillTextActive: {
    color: COLORS.accent
  },
  chartEmpty: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chartEmptyText: {
    color: COLORS.muted,
    fontFamily: FONT.body
  },
  sectionHeading: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    color: COLORS.text,
    fontFamily: FONT.display,
    fontSize: 28,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl
  },
  emptyHistoryText: {
    color: COLORS.muted,
    fontFamily: FONT.body
  },
  historyCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm
  },
  historyDate: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.1
  },
  historyMuscles: {
    marginTop: SPACING.xs,
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 16
  },
  historySummary: {
    marginTop: 2,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 13
  }
});
