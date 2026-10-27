import * as Haptics from 'expo-haptics';

// Fire-and-forget haptics: never block or throw into app flow. No-ops where
// unsupported (e.g. web), so callers don't need to guard the platform.

/** A celebratory tap — used on a new PR and on applied coach actions. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A subtle tap — used to acknowledge a routine save. */
export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
