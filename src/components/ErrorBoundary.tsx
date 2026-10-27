import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ScalePressable } from './ScalePressable';
import { COLORS, FONT, RADIUS, SPACING } from './theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. A render crash anywhere below shows a recoverable
 * screen (with a "try again" that re-mounts the tree) instead of a white screen.
 * Error boundaries must be class components — there is no hook equivalent.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface for the console / future crash reporting; the UI stays recoverable.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>🏋️</Text>
        <Text style={styles.title}>SOMETHING BROKE</Text>
        <Text style={styles.message}>
          The app hit an unexpected error. Your data is safe — try again.
        </Text>
        <ScalePressable
          style={styles.button}
          onPress={this.reset}
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>TRY AGAIN</Text>
        </ScalePressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl
  },
  emoji: {
    fontSize: 48,
    marginBottom: SPACING.md
  },
  title: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    fontSize: 32,
    letterSpacing: 2,
    textAlign: 'center'
  },
  message: {
    marginTop: SPACING.sm,
    color: COLORS.muted,
    fontFamily: FONT.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  button: {
    marginTop: SPACING.lg,
    minHeight: 52,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 22,
    letterSpacing: 1.4
  }
});
