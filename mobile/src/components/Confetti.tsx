import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

const PIECES = 70;
const COLOURS = ['#22D3EE', '#A78BFA', '#FB923C', '#34D399', '#FB7185', '#FACC15', '#60A5FA'];

interface Piece {
  x: number;
  drift: number;
  size: number;
  colour: string;
  delay: number;
  duration: number;
  spin: number;
  round: boolean;
  progress: Animated.Value;
}

/** A one-off burst of confetti falling from the top of the screen. Doesn't block touches. */
export function Confetti({ colours = COLOURS }: { colours?: string[] }) {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: PIECES }, () => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 120,
      size: 7 + Math.random() * 6,
      colour: colours[Math.floor(Math.random() * colours.length)],
      delay: Math.random() * 700,
      duration: 2400 + Math.random() * 1800,
      spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 900),
      round: Math.random() < 0.25,
      progress: new Animated.Value(0),
    })),
  );

  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? p.size / 2 : 2,
            backgroundColor: p.colour,
            opacity: p.progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
              { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
