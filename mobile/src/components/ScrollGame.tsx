import { File, Paths } from 'expo-file-system';
import { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LogoMark } from '@/components/LogoMark';
import { useTheme, type Theme } from '@/lib/theme';

// A tiny "flappy" game for Pro users while they wait: tap to fly the CiteScan logo
// through the gaps between scrolls. Physics live in refs; each frame is copied into state.
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
  x: number;
  gapY: number;
  scored: boolean;
}

interface Frame {
  birdY: number;
  tilt: number;
  scrolls: Scroll[];
  score: number;
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
  const [frame, setFrame] = useState<Frame>({ birdY: HEIGHT / 2, tilt: 0, scrolls: [], score: 0 });

  const statusRef = useRef<Status>('ready');
  const physics = useRef({ y: HEIGHT / 2, v: 0, scrolls: [] as Scroll[], score: 0, nextId: 0, overAt: 0 });

  useEffect(() => {
    if (!width) return;
    let raf = 0;
    let last: number | null = null;
    const birdX = width * 0.25;

    const endGame = () => {
      statusRef.current = 'over';
      physics.current.overAt = performance.now();
      setStatus('over');
      const score = physics.current.score;
      setBest((b) => {
        if (score > b) {
          saveBest(score);
          return score;
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

        const lastScroll = p.scrolls[p.scrolls.length - 1];
        if (!lastScroll || lastScroll.x < width - SPACING) {
          const margin = GAP / 2 + 30;
          p.scrolls.push({ id: p.nextId++, x: width, gapY: margin + Math.random() * (HEIGHT - 2 * margin), scored: false });
        }
        for (const s of p.scrolls) {
          s.x -= SPEED * dt;
          if (!s.scored && s.x + SCROLL_WIDTH < birdX - BIRD_RADIUS) {
            s.scored = true;
            p.score += 1;
          }
        }
        p.scrolls = p.scrolls.filter((s) => s.x > -SCROLL_WIDTH - ROLL);

        const hitEdge = p.y - BIRD_RADIUS < 0 || p.y + BIRD_RADIUS > HEIGHT;
        const hitScroll = p.scrolls.some((s) => {
          const withinX = birdX + BIRD_RADIUS > s.x - 4 && birdX - BIRD_RADIUS < s.x + SCROLL_WIDTH + 4;
          const inGap = p.y - BIRD_RADIUS > s.gapY - GAP / 2 && p.y + BIRD_RADIUS < s.gapY + GAP / 2;
          return withinX && !inGap;
        });
        if (hitEdge || hitScroll) endGame();
      } else if (statusRef.current === 'ready') {
        p.y = HEIGHT / 2 + Math.sin(now / 250) * 6;
      }

      setFrame({
        birdY: p.y,
        tilt: statusRef.current === 'playing' ? Math.max(-25, Math.min(70, p.v / 8)) : 0,
        scrolls: p.scrolls.map((s) => ({ ...s })),
        score: p.score,
      });
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [width]);

  const onTap = () => {
    const p = physics.current;
    if (statusRef.current === 'over') {
      // A short pause so a frantic tap doesn't instantly restart.
      if (performance.now() - p.overAt < 600) return;
      Object.assign(p, { y: HEIGHT / 2, v: 0, scrolls: [], score: 0 });
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
      {frame.scrolls.map((s) => (
        <View key={s.id} style={[styles.column, { transform: [{ translateX: s.x }] }]} pointerEvents="none">
          <ScrollPiece height={s.gapY - GAP / 2} rollAt="bottom" theme={theme} />
          <View style={{ height: GAP }} />
          <ScrollPiece height={HEIGHT - (s.gapY + GAP / 2)} rollAt="top" theme={theme} />
        </View>
      ))}

      {width > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: birdX - BIRD_SIZE / 2,
            top: frame.birdY - BIRD_SIZE / 2,
            transform: [{ rotate: `${frame.tilt}deg` }],
          }}
        >
          <LogoMark size={BIRD_SIZE} color={theme.accent} />
        </View>
      )}

      <Text style={styles.score} pointerEvents="none">
        {frame.score}
      </Text>
      <Text style={styles.best} pointerEvents="none">
        Best {best}
      </Text>

      {status !== 'playing' && (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayTitle}>{status === 'over' ? 'Game over' : 'Tap to fly'}</Text>
          <Text style={styles.overlayHint}>
            {status === 'over' ? `You scored ${frame.score}. Tap to play again.` : 'Dodge the scrolls while we find your sources'}
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
