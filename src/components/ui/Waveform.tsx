import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";

interface Props {
  /** Loudness envelope, values 0..1. */
  peaks: number[];
  /** Filled fraction, 0..1: playback position or generation progress. */
  progress?: number;
  /** Gentle idle motion (paused off-screen and for reduced-motion users). */
  breathing?: boolean;
  /** Makes the wave a seek bar: drag or use arrow keys. */
  onSeek?: (fraction: number) => void;
  height?: number;
  label?: string;
  valueText?: string;
  className?: string;
}

const BAR = 3; // px
const GAP = 2; // px

function resample(peaks: number[], count: number): number[] {
  if (count >= peaks.length) return peaks;
  const out: number[] = [];
  const step = peaks.length / count;
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * step);
    const to = Math.max(from + 1, Math.floor((i + 1) * step));
    let max = 0;
    for (let j = from; j < to; j++) max = Math.max(max, peaks[j]);
    out.push(max);
  }
  return out;
}

/**
 * The app's signature element: one canvas, drawn only while something changes.
 * Progress eases toward its target (so 4 Hz time updates still look fluid) but
 * tracks the pointer 1:1 while scrubbing.
 */
export function Waveform({ peaks, progress = 0, breathing = false, onSeek, height = 56, label = "Seek", valueText, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const state = useRef({ shown: progress, target: progress, raf: 0, visible: true, dragging: false, width: 0, dpr: 1 });
  const props = useRef({ peaks, breathing: breathing && !reduceMotion });
  props.current = { peaks, breathing: breathing && !reduceMotion };

  const draw = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const s = state.current;
    if (!canvas || !ctx || s.width === 0) return;
    const { dpr, width } = s;
    const h = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);

    const count = Math.max(8, Math.floor((width + GAP) / (BAR + GAP)));
    const bars = resample(props.current.peaks.length ? props.current.peaks : [0.2], count);
    const n = bars.length;
    const pitch = width / n;
    const barWidth = Math.max(1.5, pitch - GAP);
    const breathe = props.current.breathing;

    const shape = () => {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        let amp = bars[i];
        if (breathe) amp *= 0.72 + 0.28 * Math.sin(time / 650 + i * 0.42);
        const bh = Math.max(3, amp * h * 0.92);
        const x = i * pitch + (pitch - barWidth) / 2;
        ctx.roundRect(x, (h - bh) / 2, barWidth, bh, barWidth / 2);
      }
    };

    ctx.fillStyle = "rgb(255 255 255 / 0.16)";
    shape();
    ctx.fill();

    if (s.shown > 0) {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#ff8a5c");
      gradient.addColorStop(1, "#ffc170");
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * Math.min(1, s.shown), h);
      ctx.clip();
      ctx.fillStyle = gradient;
      shape();
      ctx.fill();
      ctx.restore();
    }
  };

  const loop = (time: number) => {
    const s = state.current;
    s.raf = 0;
    const settling = Math.abs(s.target - s.shown) > 0.0005;
    if (settling) s.shown += (s.target - s.shown) * (reduceMotion ? 1 : 0.22);
    else s.shown = s.target;
    draw(time);
    if (s.visible && (settling || props.current.breathing)) s.raf = requestAnimationFrame(loop);
  };

  const kick = () => {
    const s = state.current;
    if (!s.raf) s.raf = requestAnimationFrame(loop);
  };

  // Size the canvas to its box at device resolution.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const s = state.current;
      s.dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.width = canvas.clientWidth;
      canvas.width = Math.round(s.width * s.dpr);
      canvas.height = Math.round(height * s.dpr);
      kick();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      state.current.visible = entry.isIntersecting;
      if (entry.isIntersecting) kick();
    });
    io.observe(canvas);
    return () => {
      ro.disconnect();
      io.disconnect();
      cancelAnimationFrame(state.current.raf);
      state.current.raf = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    const s = state.current;
    if (!s.dragging) s.target = Math.min(1, Math.max(0, progress));
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, peaks, breathing, reduceMotion]);

  const seekTo = (fraction: number) => {
    const clamped = Math.min(1, Math.max(0, fraction));
    const s = state.current;
    s.target = s.shown = clamped; // direct manipulation: no easing under the finger
    kick();
    onSeek?.(clamped);
  };

  const fractionAt = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return (e.clientX - rect.left) / rect.width;
  };

  const interactive = Boolean(onSeek);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full touch-none select-none ${interactive ? "cursor-pointer" : ""} ${className ?? ""}`}
      style={{ height }}
      role={interactive ? "slider" : "img"}
      aria-label={label}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(progress * 100) : undefined}
      aria-valuetext={valueText}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={
        interactive
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              state.current.dragging = true;
              seekTo(fractionAt(e));
            }
          : undefined
      }
      onPointerMove={interactive ? (e) => state.current.dragging && seekTo(fractionAt(e)) : undefined}
      onPointerUp={interactive ? () => (state.current.dragging = false) : undefined}
      onPointerCancel={interactive ? () => (state.current.dragging = false) : undefined}
      onKeyDown={
        interactive
          ? (e: KeyboardEvent<HTMLCanvasElement>) => {
              const step = { ArrowRight: 0.02, ArrowUp: 0.02, ArrowLeft: -0.02, ArrowDown: -0.02 }[e.key];
              if (step !== undefined) {
                e.preventDefault();
                seekTo(state.current.target + step);
              } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault();
                seekTo(e.key === "Home" ? 0 : 1);
              }
            }
          : undefined
      }
    />
  );
}
