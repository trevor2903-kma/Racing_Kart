import React, { useImperativeHandle, useMemo, useRef } from 'react';
import { Volume2, VolumeX, Pause, RotateCcw } from 'lucide-react';
import { getItemDefinition } from '../game/items';
import { HudSnapshot, TrackData } from '../game/types';
import { CoinIconSvg, ItemIcon } from './ItemIcon';

export interface LiveHudValues {
  speedKmh: number;
  raceTime: number;
  driftChargeRatio: number;
  driftReady: boolean;
  kartDots: Array<{
    id: string;
    x: number;
    y: number;
    color: string;
    isPlayer: boolean;
  }>;
}

export interface RaceHudHandle {
  updateLiveValues: (vals: LiveHudValues) => void;
}

interface RaceHudProps {
  hud: HudSnapshot;
  track: TrackData;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
  onTouchKey: (code: string, pressed: boolean) => void;
  onTouchUseItem: () => void;
  hudRef: React.RefObject<RaceHudHandle | null>;
}

function ordinalSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

export function formatRaceTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const RaceHud: React.FC<RaceHudProps> = ({
  hud,
  track,
  muted,
  onToggleMute,
  onPause,
  onRestart,
  onTouchKey,
  onTouchUseItem,
  hudRef,
}) => {
  const speedTextRef = useRef<HTMLSpanElement | null>(null);
  const needleRef = useRef<SVGGElement | null>(null);
  const timeTextRef = useRef<HTMLDivElement | null>(null);
  const driftBarRef = useRef<HTMLDivElement | null>(null);
  const driftLabelRef = useRef<HTMLDivElement | null>(null);
  const dotGroupRefs = useRef<Record<string, SVGGElement | null>>({});

  useImperativeHandle(
    hudRef,
    () => ({
      updateLiveValues(vals: LiveHudValues) {
        if (speedTextRef.current) {
          speedTextRef.current.textContent = String(vals.speedKmh);
        }
        if (needleRef.current) {
          const clamped = Math.min(185, Math.max(0, vals.speedKmh));
          const deg = -125 + (clamped / 185) * 250;
          needleRef.current.setAttribute('transform', `rotate(${deg.toFixed(1)} 54 54)`);
        }
        if (timeTextRef.current) {
          timeTextRef.current.textContent = formatRaceTime(vals.raceTime);
        }
        if (driftBarRef.current) {
          driftBarRef.current.style.width = `${Math.round(vals.driftChargeRatio * 100)}%`;
          driftBarRef.current.style.backgroundColor = vals.driftReady ? '#FB923C' : '#38BDF8';
        }
        if (driftLabelRef.current) {
          driftLabelRef.current.textContent = vals.driftReady ? 'Mini-Turbo Ready!' : 'Drift Boost';
        }
        for (const dot of vals.kartDots) {
          const g = dotGroupRefs.current[dot.id];
          if (g) {
            const dx = (dot.x / track.worldWidth) * 136;
            const dy = (dot.y / track.worldHeight) * 108;
            g.setAttribute('transform', `translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`);
          }
        }
      },
    }),
    [track.worldWidth, track.worldHeight]
  );

  const minimapPath = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i < track.samples.length; i += 6) {
      const s = track.samples[i];
      const mx = (s.x / track.worldWidth) * 136;
      const my = (s.y / track.worldHeight) * 108;
      pts.push(`${i === 0 ? 'M' : 'L'}${mx.toFixed(1)},${my.toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
  }, [track]);

  const startDot = useMemo(() => {
    const s = track.samples[track.startLineSampleIndex];
    return {
      x: (s.x / track.worldWidth) * 136,
      y: (s.y / track.worldHeight) * 108,
    };
  }, [track]);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none p-3 sm:p-5 flex flex-col justify-between">
      {/* Top Row: Top-Left (Item + Minimap) and Top-Right (Rank/Lap/Timer + Utility Buttons) */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left Cluster */}
        <div className="flex items-start gap-3">
          {/* Item Slot */}
          {(() => {
            const itemDef = getItemDefinition(hud.heldItem);
            return (
              <div className="flex flex-col items-center">
                <div
                  data-testid="item-slot"
                  data-item={hud.heldItem ?? 'none'}
                  className="relative w-[68px] h-[68px] sm:w-[78px] sm:h-[78px] rounded-2xl border-[3px] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
                  style={{
                    backgroundColor: itemDef ? itemDef.slotBg : 'rgba(20, 26, 35, 0.9)',
                    borderColor: itemDef ? itemDef.accentColor : '#475569',
                  }}
                >
                  <ItemIcon item={hud.heldItem} size={46} />
                  {itemDef && (
                    <span
                      data-testid="item-action-tag"
                      className="absolute -bottom-2 px-1.5 py-0.5 rounded bg-[#0f172a] border text-[9px] font-black tracking-wider uppercase leading-none"
                      style={{
                        borderColor: itemDef.accentColor,
                        color: itemDef.accentColor,
                      }}
                    >
                      {itemDef.actionTag}
                    </span>
                  )}
                </div>
                <div
                  data-testid="item-label"
                  className="mt-2.5 text-[11px] font-bold tracking-wide text-white hud-text-stroke whitespace-nowrap"
                >
                  {itemDef ? `${itemDef.label} [E]` : 'ITEM [E]'}
                </div>
              </div>
            );
          })()}

          {/* Mobile Compact Coin Badge */}
          <div className="flex md:hidden items-center gap-1.5 rounded-xl bg-[#141a23]/92 border-2 border-[#475569] px-2.5 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            <CoinIconSvg size={18} />
            <span
              data-testid="hud-coins-mobile"
              className="font-display text-sm font-black text-[#FACC15] tabular-nums leading-none"
            >
              {hud.coins}
            </span>
          </div>

          {/* Minimap */}
          <div className="hidden sm:block rounded-xl bg-[#141a23]/88 border-2 border-[#475569] p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            <svg width="136" height="108" viewBox="0 0 136 108" aria-label="Track minimap">
              <path
                d={minimapPath}
                fill="none"
                stroke="#334155"
                strokeWidth="10"
                strokeLinejoin="round"
              />
              <path
                d={minimapPath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />
              <circle
                cx={startDot.x}
                cy={startDot.y}
                r="3.5"
                fill="#FFFFFF"
                stroke="#14181F"
                strokeWidth="1.5"
              />
              {hud.kartDots.map((dot) => {
                const dx = (dot.x / track.worldWidth) * 136;
                const dy = (dot.y / track.worldHeight) * 108;
                return (
                  <g
                    key={dot.id}
                    ref={(el) => {
                      dotGroupRefs.current[dot.id] = el;
                    }}
                    transform={`translate(${dx.toFixed(1)}, ${dy.toFixed(1)})`}
                  >
                    {dot.isPlayer && (
                      <circle cx="0" cy="0" r="6.5" fill="none" stroke="#FACC15" strokeWidth="2" />
                    )}
                    <circle
                      cx="0"
                      cy="0"
                      r={dot.isPlayer ? 4.2 : 3.4}
                      fill={dot.color}
                      stroke="#14181F"
                      strokeWidth="1.4"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Top-Right Cluster: Placement, Lap, Time & Utility Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 rounded-lg bg-[#141a23]/90 border border-[#475569] text-slate-200 hover:text-white hover:border-white/50 flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart race (R)"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="w-9 h-9 rounded-lg bg-[#141a23]/90 border border-[#475569] text-slate-200 hover:text-white hover:border-white/50 flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game (P)"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 rounded-lg bg-[#141a23]/90 border border-[#475569] text-slate-200 hover:text-white hover:border-white/50 flex items-center justify-center cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Position & Lap Plaque */}
          <div className="flex items-center gap-3 rounded-xl bg-[#141a23]/92 border-2 border-[#475569] px-3.5 sm:px-4 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
            <div className="flex items-baseline gap-0.5 pr-3 border-r border-white/15">
              <span
                data-testid="hud-rank"
                className="font-display text-2xl sm:text-3xl font-black text-[#FACC15] tabular-nums leading-none"
              >
                {hud.rank}
              </span>
              <span className="font-display text-xs sm:text-sm font-extrabold text-[#FACC15]">
                {ordinalSuffix(hud.rank)}
              </span>
              <span className="ml-1 font-display text-xs sm:text-sm font-bold text-slate-400 tabular-nums">
                /{hud.totalKarts}
              </span>
            </div>

            <div className="flex flex-col items-end">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Lap
                </span>
                <span
                  data-testid="hud-lap"
                  className="font-display text-lg sm:text-xl font-black text-white tabular-nums leading-none"
                >
                  {Math.min(hud.lap, hud.totalLaps)}/{hud.totalLaps}
                </span>
              </div>
              <div
                ref={timeTextRef}
                data-testid="hud-time"
                className="font-mono text-xs font-bold text-slate-300 tabular-nums mt-0.5"
              >
                {formatRaceTime(hud.raceTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Transient Countdown / Lap Callout */}
      {(hud.countdownValue >= 0 || hud.calloutText) && (
        <div className="self-center my-auto flex flex-col items-center pointer-events-none">
          {hud.countdownValue >= 0 && (
            <div className="font-display text-7xl sm:text-8xl font-black text-[#FACC15] hud-text-stroke tracking-tight">
              {hud.countdownValue === 0 ? 'GO!' : hud.countdownValue}
            </div>
          )}
          {hud.countdownValue < 0 && hud.calloutText && (
            <div className="font-display text-4xl sm:text-5xl font-black text-white hud-text-stroke tracking-wide">
              {hud.calloutText}
            </div>
          )}
        </div>
      )}

      {/* Bottom Row: Mobile Touch Controls (md:hidden) + Bottom-Right Speedometer & Drift Charge Gauge */}
      <div className="flex items-end justify-between gap-2">
        {/* Touch Controls visible only on narrow/mobile viewports */}
        <div className="flex md:hidden items-end gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Steer Left"
              onPointerDown={() => onTouchKey('KeyA', true)}
              onPointerUp={() => onTouchKey('KeyA', false)}
              onPointerCancel={() => onTouchKey('KeyA', false)}
              onPointerLeave={() => onTouchKey('KeyA', false)}
              className="w-11 h-11 rounded-xl bg-[#141a23]/88 border-2 border-[#475569] text-white font-display font-black text-base active:bg-[#273244]"
            >
              ◀
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Steer Right"
              onPointerDown={() => onTouchKey('KeyD', true)}
              onPointerUp={() => onTouchKey('KeyD', false)}
              onPointerCancel={() => onTouchKey('KeyD', false)}
              onPointerLeave={() => onTouchKey('KeyD', false)}
              className="w-11 h-11 rounded-xl bg-[#141a23]/88 border-2 border-[#475569] text-white font-display font-black text-base active:bg-[#273244]"
            >
              ▶
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              tabIndex={-1}
              aria-label="Accelerate"
              onPointerDown={() => onTouchKey('KeyW', true)}
              onPointerUp={() => onTouchKey('KeyW', false)}
              onPointerCancel={() => onTouchKey('KeyW', false)}
              onPointerLeave={() => onTouchKey('KeyW', false)}
              className="w-11 h-11 rounded-xl bg-[#22B14C]/90 border-2 border-[#14181F] text-white font-display font-black text-[11px]"
            >
              GAS
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Drift"
              onPointerDown={() => onTouchKey('Space', true)}
              onPointerUp={() => onTouchKey('Space', false)}
              onPointerCancel={() => onTouchKey('Space', false)}
              onPointerLeave={() => onTouchKey('Space', false)}
              className="w-11 h-11 rounded-xl bg-[#38BDF8]/90 border-2 border-[#14181F] text-[#14181F] font-display font-black text-[10px]"
            >
              DRIFT
            </button>
            {hud.heldItem && (
              <button
                type="button"
                tabIndex={-1}
                aria-label="Use Item"
                onClick={onTouchUseItem}
                className="w-11 h-11 rounded-xl bg-[#FACC15] border-2 border-[#14181F] text-[#14181F] font-display font-black text-[10px]"
              >
                USE
              </button>
            )}
          </div>
        </div>

        {/* Desktop Bottom-Left Coin Counter (matches Image 1) */}
        <div className="hidden md:flex items-center gap-2 rounded-xl bg-[#141a23]/92 border-2 border-[#475569] px-3.5 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <CoinIconSvg size={22} />
          <span
            data-testid="hud-coins"
            className="font-display text-lg font-black text-[#FACC15] tabular-nums leading-none"
          >
            {hud.coins}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-1.5 sm:gap-3 shrink-0">
          {/* Drift Mini-Turbo Charge Bar */}
          <div className="sm:mb-2 flex flex-col items-end">
            <div
              ref={driftLabelRef}
              className="hidden sm:block text-xs font-extrabold uppercase tracking-wider text-white hud-text-stroke mb-1"
            >
              {hud.driftReady ? 'Mini-Turbo Ready!' : 'Drift Boost'}
            </div>
            <div className="w-[74px] sm:w-28 h-2.5 sm:h-3.5 rounded-full bg-[#141a23]/95 border-2 border-[#475569] overflow-hidden p-0.5">
              <div
                ref={driftBarRef}
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(hud.driftChargeRatio * 100)}%`,
                  backgroundColor: hud.driftReady ? '#FB923C' : '#38BDF8',
                }}
              />
            </div>
          </div>

          {/* Analog + Digital Speedometer */}
          <div className="relative w-[76px] h-[76px] sm:w-[108px] sm:h-[108px] flex items-center justify-center shrink-0">
            <svg className="w-full h-full" viewBox="0 0 108 108" aria-label="Speedometer">
              <circle cx="54" cy="54" r="50" fill="#181F2A" stroke="#64748B" strokeWidth="4" />
              <circle cx="54" cy="54" r="44" fill="#0F141C" stroke="#334155" strokeWidth="1.5" />
              {Array.from({ length: 11 }).map((_, idx) => {
                const a = (-125 + idx * 25 - 90) * (Math.PI / 180);
                const r1 = 35;
                const r2 = 41;
                const isRedline = idx >= 8;
                return (
                  <line
                    key={idx}
                    x1={54 + Math.cos(a) * r1}
                    y1={54 + Math.sin(a) * r1}
                    x2={54 + Math.cos(a) * r2}
                    y2={54 + Math.sin(a) * r2}
                    stroke={isRedline ? '#EF4444' : '#E2E8F0'}
                    strokeWidth={idx % 2 === 0 ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                );
              })}
              <g ref={needleRef} transform="rotate(-125 54 54)">
                <polygon points="52,54 54,18 56,54" fill="#EF4444" />
                <circle cx="54" cy="54" r="5" fill="#94A3B8" stroke="#14181F" strokeWidth="1.5" />
              </g>
            </svg>
            <div className="absolute bottom-2 sm:bottom-3.5 flex flex-col items-center leading-none">
              <span
                ref={speedTextRef}
                data-testid="hud-speed"
                className="font-mono text-sm sm:text-lg font-extrabold text-white tabular-nums"
              >
                {hud.speedKmh}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 tracking-wider">
                KM/H
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
