import { File, Paths } from 'expo-file-system';
import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogoMark } from '@/components/LogoMark';
import { useTheme, type Theme } from '@/lib/theme';

// A tiny "flappy" game for Pro users while they wait: tap to fly the CiteScan logo
// through the gaps between scrolls. Physics run in refs; positions are pushed straight into
// Animated values each frame, so React only re-renders when a scroll appears or the score changes.
const HEIGHT = 320;
const BIRD_SIZE = 34;
const BIRD_RADIUS = 13;
const GRAVITY = 1500; // px/s²
const FLAP = -430; // px/s
const SPEED = 150; // px/s
const SCROLL_WIDTH = 52;
const GAP = 135;
const SPACING = 210;
const ROLL = 16;

interface Scroll {
  id: number;
  /** World position where the scroll starts; on screen it sits at x0 - distance travelled. */
  x0: number;
  gapY: number;
  scored: boolean;
}

type Status = 'ready' | 'playing' | 'over';

const bestFile = new File(Paths.document, 'game.json');

function loadBest(): number {
  try {
    return bestFile.exists ? (JSON.parse(bestFile.textSync()).best ?? 0) : 0;
  } catch {
    return 0;
  }
}

function saveBest(best: number) {
  try {
    if (!bestFile.exists) bestFile.create();
    bestFile.write(JSON.stringify({ best }));
  } catch {
    // not worth interrupting the game for
  }
}

export function ScrollGame() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [width, setWidth] = useState(0);
  const [status, setStatus] = useState<Status>('ready');
  const [best, setBest] = useState(loadBest);
  const [score, setScore] = useState(0);
  const [scrolls, setScrolls] = useState<Scroll[]>([]);

  const [birdY] = useState(() => new Animated.Value(HEIGHT / 2));
  const [tilt] = useState(() => new Animated.Value(0));
  const [distance] = useState(() => new Animated.Value(0));

  const statusRef = useRef<Status>('ready');
  const physics = useRef({ y: HEIGHT / 2, v: 0, distance: 0, scrolls: [] as Scroll[], score: 0, nextId: 0, overAt: 0 });

  useEffect(() => {
    if (!width) return;
    let raf = 0;
    let last: number | null = null;
    const birdX = width * 0.25;

    const endGame = () => {
      statusRef.current = 'over';
      physics.current.overAt = performance.now();
      setStatus('over');
      const final = physics.current.score;
      setBest((b) => {
        if (final > b) {
          saveBest(final);
          return final;
        }
        return b;
      });
    };

    const loop = (now: number) => {
      const dt = last === null ? 0 : Math.min((now - last) / 1000, 0.033);
      last = now;
      const p = physics.current;

      if (statusRef.current === 'playing') {
        p.v += GRAVITY * dt;
        p.y += p.v * dt;
        p.distance += SPEED * dt;

        let listChanged = false;
        const newest = p.scrolls[p.scrolls.length - 1];
        if (!newest || newest.x0 - p.distance < width - SPACING) {
          const margin = GAP / 2 + 30;
          p.scrolls.push({
            id: p.nextId++,
            x0: p.distance + width,
            gapY: margin + Math.random() * (HEIGHT - 2 * margin),
            scored: false,
          });
          listChanged = true;
        }
        const visible = p.scrolls.filter((s) => s.x0 - p.distance > -SCROLL_WIDTH - ROLL);
        if (visible.length !== p.scrolls.length) {
          p.scrolls = visible;
          listChanged = true;
        }

        for (const s of p.scrolls) {
          const x = s.x0 - p.distance;
          if (!s.scored && x + SCROLL_WIDTH < birdX - BIRD_RADIUS) {
            s.scored = true;
            p.score += 1;
            setScore(p.score);
          }
        }
        if (listChanged) setScrolls([...p.scrolls]);

        const hitEdge = p.y - BIRD_RADIUS < 0 || p.y + BIRD_RADIUS > HEIGHT;
        const hitScroll = p.scrolls.some((s) => {
          const x = s.x0 - p.distance;
          const withinX = birdX + BIRD_RADIUS > x - 4 && birdX - BIRD_RADIUS < x + SCROLL_WIDTH + 4;
          const inGap = p.y - BIRD_RADIUS > s.gapY - GAP / 2 && p.y + BIRD_RADIUS < s.gapY + GAP / 2;
          return withinX && !inGap;
        });
        if (hitEdge || hitScroll) endGame();

        tilt.setValue(Math.max(-25, Math.min(70, p.v / 8)));
        distance.setValue(p.distance);
      } else if (statusRef.current === 'ready') {
        p.y = HEIGHT / 2 + Math.sin(now / 250) * 6;
        tilt.setValue(0);
      }

      birdY.setValue(p.y);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width, birdY, tilt, distance]);

  const onTap = () => {
    const p = physics.current;
    if (statusRef.current === 'over') {
      // A short pause so a frantic tap doesn't instantly restart.
      if (performance.now() - p.overAt < 600) return;
      Object.assign(p, { y: HEIGHT / 2, v: 0, distance: 0, scrolls: [], score: 0 });
      distance.setValue(0);
      setScrolls([]);
      setScore(0);
      statusRef.current = 'ready';
      setStatus('ready');
      return;
    }
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing';
      setStatus('playing');
    }
    p.v = FLAP;
  };

  const birdX = width * 0.25;

  return (
    <Pressable style={styles.area} onPressIn={onTap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {scrolls.map((s) => (
        <Animated.View
          key={s.id}
          pointerEvents="none"
          style={[styles.column, { transform: [{ translateX: Animated.subtract(s.x0, distance) }] }]}
        >
          <ScrollPiece height={s.gapY - GAP / 2} rollAt="bottom" theme={theme} />
          <View style={{ height: GAP }} />
          <ScrollPiece height={HEIGHT - (s.gapY + GAP / 2)} rollAt="top" theme={theme} />
        </Animated.View>
      ))}

      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: birdX - BIRD_SIZE / 2,
            top: -BIRD_SIZE / 2,
            transform: [
              { translateY: birdY },
              { rotate: tilt.interpolate({ inputRange: [-25, 70], outputRange: ['-25deg', '70deg'], extrapolate: 'clamp' }) },
            ],
          }}
        >
          <LogoMark size={BIRD_SIZE} color={theme.accent} />
        </Animated.View>
      )}

      <Text style={styles.score} pointerEvents="none">
        {score}
      </Text>
      <Text style={styles.best} pointerEvents="none">
        Best {best}
      </Text>

      {status !== 'playing' && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>{status === 'over' ? 'Game over' : 'Tap to fly'}</Text>
          <Text style={styles.overlayHint}>
            {status === 'over' ? `You scored ${score}. Tap to play again.` : 'Dodge the scrolls while we find your sources'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** One half of an obstacle: a strip of paper with a few lines of "writing" and a rolled end. */
const ScrollPiece = memo(function ScrollPiece({
  height,
  rollAt,
  theme,
}: {
  height: number;
  rollAt: 'top' | 'bottom';
  theme: Theme;
}) {
  const bodyHeight = Math.max(0, height - ROLL / 2);
  const lines = Math.max(0, Math.floor((bodyHeight - 14) / 14));
  const roll = (
    <View
      style={{
        width: SCROLL_WIDTH + 12,
        height: ROLL,
        marginLeft: -6,
        borderRadius: ROLL / 2,
        borderWidth: 2,
        borderColor: theme.accent,
        backgroundColor: theme.primarySoft,
      }}
    />
  );
  return (
    <View style={{ height, width: SCROLL_WIDTH, justifyContent: rollAt === 'top' ? 'flex-start' : 'flex-end' }}>
      {rollAt === 'top' && roll}
      <View
        style={{
          height: bodyHeight - ROLL / 2,
          width: SCROLL_WIDTH,
          borderWidth: 2,
          borderColor: theme.accent,
          backgroundColor: theme.card,
          paddingHorizontal: 8,
          paddingTop: 10,
          gap: 10,
          overflow: 'hidden',
          [rollAt === 'top' ? 'borderTopWidth' : 'borderBottomWidth']: 0,
        }}
      >
        {Array.from({ length: lines }, (_, i) => (
          <View
            key={i}
            style={{ height: 2, width: i % 3 === 2 ? '55%' : '85%', backgroundColor: theme.accent, opacity: 0.35, borderRadius: 1 }}
          />
        ))}
      </View>
      {rollAt === 'bottom' && roll}
    </View>
  );
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    area: {
      width: '100%',
      height: HEIGHT,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.background,
      overflow: 'hidden',
    },
    column: { position: 'absolute', top: 0, left: 0, height: HEIGHT },
    score: {
      position: 'absolute',
      top: 10,
      alignSelf: 'center',
      fontSize: 36,
      fontWeight: '800',
      color: t.accent,
    },
    best: { position: 'absolute', top: 14, right: 14, fontSize: 12, fontWeight: '700', color: t.muted },
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 24,
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 20,
    },
    overlayTitle: { fontSize: 20, fontWeight: '800', color: t.text },
    overlayHint: { fontSize: 13, color: t.muted, textAlign: 'center' },
  });
