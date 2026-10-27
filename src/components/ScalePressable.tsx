import React, { useRef } from 'react';
import {
  AccessibilityRole,
  AccessibilityState,
  Animated,
  GestureResponderEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle
} from 'react-native';

interface ScalePressableProps extends Omit<PressableProps, 'style'> {
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export function ScalePressable({
  children,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  style,
  accessibilityRole,
  accessibilityState,
  disabled,
  ...rest
}: ScalePressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  // Default to button semantics for screen readers (callers can override), and
  // always reflect the disabled state so assistive tech announces it.
  const role: AccessibilityRole = accessibilityRole ?? 'button';
  const a11yState: AccessibilityState = { disabled: !!disabled, ...accessibilityState };

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 7,
      tension: 120
    }).start();
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    animateTo(scaleTo);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    animateTo(1);
    onPressOut?.(event);
  };

  // The wrapper owns the layout footprint (width/margins) so percentage widths
  // and flex sizing resolve against the parent. The Pressable just fills it.
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole={role}
        accessibilityState={a11yState}
        disabled={disabled}
        {...rest}
        style={styles.fill}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Fill the wrapper's width so tap targets span the cell/button. Height stays
  // content-driven — a percentage height against an auto-height parent is 0.
  fill: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
