import React from 'react';
import { KART_PRESETS, KartColorId, TOTAL_LAPS } from '../game/types';
import { KartMiniSvg } from './ItemIcon';

interface TitleOverlayProps {
  selectedColor: KartColorId;
  onSelectColor: (color: KartColorId) => void;
  onStartRace: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  selectedColor,
  onSelectColor,
  onStartRace,
}) => {
  return (
    <div
      className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 overflow-y-auto"
      style={{
        background:
          'linear-gradient(90deg, rgba(12, 18, 26, 0.88) 0%, rgba(12, 18, 26, 0.68) 46%, rgba(12, 18, 26, 0.22) 100%)',
      }}
    >
      {/* Left/Center Main Composition over negative space */}
      <div className="my-auto max-w-xl">
        {/* Custom SVG Arcade Emblem */}
        <div className="mb-5">
          <svg
            viewBox="0 0 460 118"
            className="w-full max-w-[430px] h-auto"
            role="img"
            aria-label="Turbo Kart Grand Prix"
          >
            {/* Checkered pennant ribbon */}
            <path
              d="M14 26 L432 14 L446 56 L28 68 Z"
              fill="#E52521"
              stroke="#14181F"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <path
              d="M22 68 L412 58 L402 104 L14 112 Z"
              fill="#FACC15"
              stroke="#14181F"
              strokeWidth="5"
              strokeLinejoin="round"
            />
            {/* Checkered accents */}
            <rect x="26" y="32" width="14" height="14" fill="#FFFFFF" />
            <rect x="40" y="32" width="14" height="14" fill="#14181F" />
            <rect x="26" y="46" width="14" height="14" fill="#14181F" />
            <rect x="40" y="46" width="14" height="14" fill="#FFFFFF" />

            <text
              x="245"
              y="52"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#14181F"
              strokeWidth="7"
              style={{
                paintOrder: 'stroke fill',
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: '40px',
                letterSpacing: '0.03em',
              }}
            >
              TURBO KART
            </text>
            <text
              x="212"
              y="93"
              textAnchor="middle"
              fill="#14181F"
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: '26px',
                letterSpacing: '0.14em',
              }}
            >
              GRAND PRIX
            </text>
          </svg>
        </div>

        <p className="mb-6 max-w-md text-base text-slate-200 leading-relaxed">
          {TOTAL_LAPS}-Lap Coastal Circuit. Chain 1.5s drifts for Mini-Turbos, dodge bananas, and launch homing rockets to claim 1st place.
        </p>

        {/* Kart Color / Driver Selector */}
        <div className="mb-7">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            Select Your Kart
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {KART_PRESETS.map((preset) => {
              const active = preset.id === selectedColor;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectColor(preset.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition-transform duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                    active
                      ? 'bg-[#1f2937] border-2 border-[#FACC15] scale-[1.03]'
                      : 'bg-[#141a23]/90 border border-white/15 hover:border-white/40'
                  }`}
                >
                  <KartMiniSvg preset={preset} />
                  <span className="font-display text-sm font-bold text-white whitespace-nowrap">
                    {preset.driverName}
                  </span>
                  <span className="text-[11px] text-slate-300 whitespace-nowrap">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Single Primary CTA */}
        <button
          type="button"
          data-start="true"
          onClick={onStartRace}
          className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#FACC15] px-8 py-3.5 font-display text-lg font-extrabold text-[#14181F] shadow-[0_4px_0_#A16207] transition-transform duration-150 hover:brightness-105 active:translate-y-0.5 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white"
        >
          Start Race
        </button>
      </div>

      {/* Bottom Safe-Margin Flat Control Hint */}
      <div className="text-xs sm:text-sm font-medium text-slate-300 tracking-wide">
        W / ↑ Accelerate · S / ↓ Brake · A / D Steer · Space / Shift Drift (1.5s Mini-Turbo) · E / Enter Item · P Pause
      </div>
    </div>
  );
};
