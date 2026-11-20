import { HudSnapshot, ItemType } from './types';

export interface ItemDefinition {
  id: ItemType;
  label: string;
  actionTag: string;
  usedCallout: string;
  accentColor: string;
  slotBg: string;
}

export const ALL_ITEM_TYPES: readonly ItemType[] = ['turbo', 'banana', 'rocket'] as const;

/**
 * Single source of truth mapping every ItemType to its display metadata,
 * distinct color coding, and feedback callout so HUD visuals always match gameplay effects.
 */
export const ITEM_CATALOG: Readonly<Record<ItemType, ItemDefinition>> = {
  turbo: {
    id: 'turbo',
    label: 'Turbo Boost',
    actionTag: 'SPEED',
    usedCallout: 'TURBO BOOST!',
    accentColor: '#38BDF8',
    slotBg: '#102436',
  },
  banana: {
    id: 'banana',
    label: 'Banana Trap',
    actionTag: 'TRAP',
    usedCallout: 'TRAP DROPPED!',
    accentColor: '#FACC15',
    slotBg: '#2b2410',
  },
  rocket: {
    id: 'rocket',
    label: 'Red Shell',
    actionTag: 'HOMING',
    usedCallout: 'SHELL LAUNCHED!',
    accentColor: '#EF4444',
    slotBg: '#2e1418',
  },
};

export function getItemDefinition(item: ItemType | null): ItemDefinition | null {
  if (!item) return null;
  return ITEM_CATALOG[item] ?? null;
}

export interface DiscreteHudState {
  rank: number;
  lap: number;
  coins: number;
  heldItem: ItemType | null;
  countdownValue: number;
  calloutText: string | null;
}

export function extractDiscreteHudState(snapshot: HudSnapshot): DiscreteHudState {
  return {
    rank: snapshot.rank,
    lap: snapshot.lap,
    coins: snapshot.coins,
    heldItem: snapshot.heldItem,
    countdownValue: snapshot.countdownValue,
    calloutText: snapshot.calloutText,
  };
}

export function hasDiscreteHudChanged(
  prev: DiscreteHudState,
  next: DiscreteHudState
): boolean {
  return (
    prev.rank !== next.rank ||
    prev.lap !== next.lap ||
    prev.coins !== next.coins ||
    prev.heldItem !== next.heldItem ||
    prev.countdownValue !== next.countdownValue ||
    prev.calloutText !== next.calloutText
  );
}
