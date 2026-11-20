import React from 'react';
import { ItemType, KartPreset } from '../game/types';

export const ItemIcon: React.FC<{ item: ItemType | null; size?: number }> = ({
  item,
  size = 48,
}) => {
  if (!item) {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <rect
          x="8"
          y="8"
          width="32"
          height="32"
          rx="8"
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="2.5"
          strokeDasharray="5 4"
        />
      </svg>
    );
  }

  if (item === 'turbo') {
    // Red spotted Turbo Mushroom
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M17 27 H31 L30 40 C30 42 28 43 24 43 C20 43 18 42 18 40 Z"
          fill="#FEF3C7"
          stroke="#14181F"
          strokeWidth="3"
        />
        <path
          d="M7 26 C7 14 14 7 24 7 C34 7 41 14 41 26 C41 29 36 30 24 30 C12 30 7 29 7 26 Z"
          fill="#EF4444"
          stroke="#14181F"
          strokeWidth="3"
        />
        <circle cx="16" cy="18" r="4.2" fill="#FFFFFF" />
        <circle cx="31" cy="17" r="3.8" fill="#FFFFFF" />
        <circle cx="24" cy="11.5" r="3.2" fill="#FFFFFF" />
        <line x1="21" y1="33" x2="21" y2="37" stroke="#14181F" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="27" y1="33" x2="27" y2="37" stroke="#14181F" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (item === 'banana') {
    // Expressive Banana Peel
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M9 35 C13 24 19 16 24 11 C29 16 35 24 39 35 C34 39 29 37 24 31 C19 37 14 39 9 35 Z"
          fill="#FACC15"
          stroke="#14181F"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="21.5" y="6" width="5" height="6" rx="1.5" fill="#78350F" stroke="#14181F" strokeWidth="2" />
        <circle cx="22" cy="22" r="1.4" fill="#14181F" />
        <circle cx="26" cy="22" r="1.4" fill="#14181F" />
      </svg>
    );
  }

  // Homing Red Shell (matches Image 2 UI slot & Items sheet)
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      {/* Cream belly underside */}
      <path
        d="M9 28 C9 37 15 41 24 41 C33 41 39 37 39 28 Z"
        fill="#FDE68A"
        stroke="#14181F"
        strokeWidth="3"
      />
      <line x1="16" y1="30" x2="18" y2="39" stroke="#D97706" strokeWidth="2" />
      <line x1="24" y1="30" x2="24" y2="40" stroke="#D97706" strokeWidth="2" />
      <line x1="32" y1="30" x2="30" y2="39" stroke="#D97706" strokeWidth="2" />
      {/* Glossy Red Shell dome */}
      <path
        d="M7 26 C7 14 14 7 24 7 C34 7 41 14 41 26 Z"
        fill="#E52521"
        stroke="#14181F"
        strokeWidth="3"
      />
      {/* Hex pattern highlights */}
      <polygon
        points="24,11 30,15 28,22 20,22 18,15"
        fill="#F87171"
        opacity="0.45"
      />
      {/* White shell rim */}
      <rect
        x="6"
        y="24"
        width="36"
        height="6"
        rx="3"
        fill="#F8FAFC"
        stroke="#14181F"
        strokeWidth="2.8"
      />
    </svg>
  );
};

export const CoinIconSvg: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="#FACC15" stroke="#14181F" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="9.5" fill="#EAB308" stroke="#FEF08A" strokeWidth="1.5" />
    <rect x="14.2" y="9" width="3.6" height="14" rx="1.5" fill="#FEF08A" stroke="#A16207" strokeWidth="1" />
  </svg>
);

export const KartMiniSvg: React.FC<{ preset: KartPreset }> = ({ preset }) => (
  <svg width="58" height="44" viewBox="0 0 64 48" aria-hidden="true">
    {/* 4 Tires */}
    <rect x="10" y="5" width="14" height="8" rx="2.5" fill="#181C24" />
    <rect x="10" y="35" width="14" height="8" rx="2.5" fill="#181C24" />
    <rect x="40" y="6" width="13" height="8" rx="2.5" fill="#181C24" />
    <rect x="40" y="34" width="13" height="8" rx="2.5" fill="#181C24" />
    {/* Golden Engine + Exhausts */}
    <rect x="4" y="14" width="8" height="5" rx="1.5" fill="#94A3B8" stroke="#14181F" strokeWidth="1.5" />
    <rect x="4" y="29" width="8" height="5" rx="1.5" fill="#94A3B8" stroke="#14181F" strokeWidth="1.5" />
    <rect x="11" y="18" width="6" height="12" rx="2" fill="#F59E0B" stroke="#14181F" strokeWidth="1.4" />
    {/* Chassis */}
    <path
      d="M11 12 L42 11 C53 12 58 17 58 24 C58 31 53 36 42 37 L11 36 Z"
      fill={preset.primaryColor}
      stroke="#14181F"
      strokeWidth="2.8"
    />
    <rect x="41" y="17" width="11" height="14" rx="4" fill={preset.trimColor} />
    <rect x="15" y="15" width="14" height="18" rx="2" fill={preset.secondaryColor} />
    {/* Driver Cap */}
    <circle cx="29" cy="24" r="8.5" fill={preset.helmetColor} stroke="#14181F" strokeWidth="2.2" />
    <path d="M32 18 A6 6 0 0 1 32 30 Z" fill="#FFFFFF" opacity="0.85" />
  </svg>
);
