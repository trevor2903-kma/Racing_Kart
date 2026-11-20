import React from 'react';
import { ItemType, KartPreset } from '../game/types';

export const ItemIcon: React.FC<{ item: ItemType | null; size?: number }> = ({
  item,
  size = 48,
}) => {
  if (!item) {
    return (
      <svg key="empty" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
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

  switch (item) {
    case 'turbo':
      // Electric Cyan & Gold Speed Boost Bolt + Chevrons (distinct from Red Shell)
      return (
        <svg key="turbo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
          {/* Speed aura chevrons */}
          <path
            d="M8 20 L15 13 L8 6"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          <path
            d="M40 42 L33 35 L40 28"
            fill="none"
            stroke="#38BDF8"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
          {/* Core Turbo Lightning Bolt */}
          <path
            d="M27 5 L12 25 H23 L19 43 L37 21 H26 Z"
            fill="#38BDF8"
            stroke="#14181F"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M25.5 11 L17 23 H24.5 L22.5 34.5 L32 22.5 H24.5 Z"
            fill="#FACC15"
          />
        </svg>
      );

    case 'banana':
      // Expressive Yellow Banana Peel Trap
      return (
        <svg key="banana" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
          <path
            d="M9 35 C13 24 19 16 24 11 C29 16 35 24 39 35 C34 39 29 37 24 31 C19 37 14 39 9 35 Z"
            fill="#FACC15"
            stroke="#14181F"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect
            x="21.5"
            y="6"
            width="5"
            height="6"
            rx="1.5"
            fill="#78350F"
            stroke="#14181F"
            strokeWidth="2"
          />
          <circle cx="22" cy="22" r="1.4" fill="#14181F" />
          <circle cx="26" cy="22" r="1.4" fill="#14181F" />
        </svg>
      );

    case 'rocket':
      // Homing Red Shell with target highlight
      return (
        <svg key="rocket" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
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
            opacity="0.55"
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
          {/* Subtle homing lock pip */}
          <circle cx="38" cy="11" r="4" fill="#FACC15" stroke="#14181F" strokeWidth="1.8" />
        </svg>
      );

    default: {
      const _exhaustive: never = item;
      void _exhaustive;
      return null;
    }
  }
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
