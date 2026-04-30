/**
 * LoadingScreen — cinematic threshold-based overlay
 *
 * Rules:
 *  - If `isLoading` resolves in < THRESHOLD_MS → nothing ever shown (no flash)
 *  - If loading takes longer → fades in from black cinematically
 *  - Holds for minimum time so it never immediately flashes out
 *  - Fades out dramatically when loading completes + min-hold is met
 */
import { useEffect, useRef, useState } from 'react';

// ── Timings ── adjust here to tune the feel ────────────────────────────────
const THRESHOLD_MS = 500;   // wait before appearing — keeps short loads invisible
const FADE_IN_MS   = 1300;  // emerge from black   (ease-in curve)
const MIN_HOLD_MS  = 950;   // minimum fully-visible time after fade-in
const FADE_OUT_MS  = 1400;  // dissolve away       (ease-in curve)

type Phase = 'idle' | 'entering' | 'holding' | 'exiting' | 'done';

export default function LoadingScreen({ isLoading }: { isLoading: boolean }) {
  const [phase, setPhase]     = useState<Phase>('idle');
  const [opacity, setOpacity] = useState(0);

  // Refs so timeout callbacks always see fresh values (no stale closures)
  const phaseRef    = useRef<Phase>('idle');
  const canExitRef  = useRef(false);
  const doneRef     = useRef(!isLoading);
  const t1 = useRef<ReturnType<typeof setTimeout>>();
  const t2 = useRef<ReturnType<typeof setTimeout>>();
  const t3 = useRef<ReturnType<typeof setTimeout>>();
  const raf = useRef<number>();

  function go(next: Phase) { phaseRef.current = next; setPhase(next); }

  function doExit() {
    if (phaseRef.current === 'exiting' || phaseRef.current === 'done') return;
    go('exiting');
    setOpacity(0);
    t3.current = setTimeout(() => go('done'), FADE_OUT_MS + 100);
  }

  useEffect(() => {
    if (isLoading) {
      doneRef.current  = false;
      canExitRef.current = false;
      clearTimeout(t3.current);

      t1.current = setTimeout(() => {
        go('entering');
        setOpacity(0);
        // Double-rAF — ensures browser registers the opacity:0 before transitioning to 1
        raf.current = requestAnimationFrame(() =>
          requestAnimationFrame(() => setOpacity(1))
        );
        t2.current = setTimeout(() => {
          canExitRef.current = true;
          if (doneRef.current) doExit();
          else go('holding');
        }, FADE_IN_MS + MIN_HOLD_MS);
      }, THRESHOLD_MS);

    } else {
      doneRef.current = true;
      clearTimeout(t1.current); // cancel before threshold → never show
      if (phaseRef.current === 'idle') { go('done'); return; }
      if (canExitRef.current) doExit();
      // else: t2 (hold timer) will call doExit() when it fires
    }

    return () => clearTimeout(t1.current);
  }, [isLoading]); // eslint-disable-line

  useEffect(() => () => {
    clearTimeout(t1.current);
    clearTimeout(t2.current);
    clearTimeout(t3.current);
    cancelAnimationFrame(raf.current!);
  }, []);

  if (phase === 'idle' || phase === 'done') return null;

  const transition =
    phase === 'entering' ? `opacity ${FADE_IN_MS}ms cubic-bezier(0.5, 0, 0.75, 0)` :
    phase === 'exiting'  ? `opacity ${FADE_OUT_MS}ms cubic-bezier(0.7, 0, 1, 0.6)` :
    'none';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 9999,
      opacity,
      transition,
      pointerEvents: 'all',
    }}>
      {/* Full-screen hands image */}
      <img
        src="/hands-loading.png"
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </div>
  );
}

