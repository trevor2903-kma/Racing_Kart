/**
 * Core data models, configuration presets, and simulation constants
 * for Turbo Kart GP (Top-Down 2.5D Arcade Kart Racer).
 */

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type KartColorId = 'red' | 'blue' | 'green' | 'yellow';

export type ItemType = 'turbo' | 'banana' | 'rocket';

export interface KartPreset {
  id: KartColorId;
  name: string;
  driverName: string;
  primaryColor: string;
  secondaryColor: string;
  trimColor: string;
  helmetColor: string;
  number: string;
}

export const KART_PRESETS: KartPreset[] = [
  {
    id: 'red',
    name: 'Crimson Blaze',
    driverName: 'Marco',
    primaryColor: '#E52521',
    secondaryColor: '#9E1310',
    trimColor: '#FFFFFF',
    helmetColor: '#E52521',
    number: '01',
  },
  {
    id: 'blue',
    name: 'Cobalt Comet',
    driverName: 'Luca',
    primaryColor: '#1E64E8',
    secondaryColor: '#0F3B99',
    trimColor: '#E8F1FF',
    helmetColor: '#1E64E8',
    number: '02',
  },
  {
    id: 'green',
    name: 'Emerald Viper',
    driverName: 'Leo',
    primaryColor: '#22B14C',
    secondaryColor: '#126E2D',
    trimColor: '#FFFFFF',
    helmetColor: '#22B14C',
    number: '03',
  },
  {
    id: 'yellow',
    name: 'Solar Bolt',
    driverName: 'Sunny',
    primaryColor: '#F5B800',
    secondaryColor: '#B57D00',
    trimColor: '#FFF7D6',
    helmetColor: '#F5B800',
    number: '04',
  },
];

export const TOTAL_LAPS = 5;
export const DRIFT_CHARGE_TARGET = 1.5; // Seconds of drifting required for Mini-Turbo
export const MINI_TURBO_DURATION = 1.0; // Seconds of boost after releasing charged drift
export const TURBO_ITEM_DURATION = 2.0; // Seconds of Mushroom Turbo boost (150% max speed)
export const BOOST_PAD_DURATION = 0.85; // Seconds of boost from track boost pad
export const BANANA_SPINOUT_DURATION = 1.5; // Seconds of spin-out control loss
export const ROCKET_HIT_SPINOUT = 1.4; // Seconds of spin-out on rocket hit
export const ITEM_BOX_RESPAWN_TIME = 5.0; // Seconds until collected item box respawns
export const OFFROAD_MAX_SPEED_FACTOR = 0.6; // 40% reduction in max speed off-road

export interface Vec2 {
  x: number;
  y: number;
}

export interface TrackSample {
  x: number;
  y: number;
  tx: number; // Unit tangent X
  ty: number; // Unit tangent Y
  nx: number; // Unit normal X
  ny: number; // Unit normal Y
  s: number; // Arc distance from start line
  progress: number; // Normalized [0, 1) around the loop
}

export interface BoostPad {
  id: string;
  x: number;
  y: number;
  angle: number;
  width: number;
  length: number;
  sampleIndex: number;
}

export interface ItemBox {
  id: string;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  respawnTimer: number;
  phase: number;
}

export interface TrackCoin {
  id: string;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  respawnTimer: number;
  phase: number;
}

export interface SceneryProp {
  kind: 'palm' | 'tree' | 'rock';
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface TrackData {
  worldWidth: number;
  worldHeight: number;
  roadWidth: number;
  totalLength: number;
  samples: TrackSample[];
  checkpoints: number[]; // Sample indices acting as anti-cheat checkpoints
  boostPads: BoostPad[];
  itemBoxSpawns: Array<{ id: string; x: number; y: number }>;
  coinSpawns: Array<{ id: string; x: number; y: number }>;
  scenery: SceneryProp[];
  startLineSampleIndex: number;
}

export interface KartInput {
  accelerate: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  drift: boolean;
  useItem: boolean;
}

export interface KartState {
  id: string;
  preset: KartPreset;
  isPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // Facing angle in radians
  speed: number; // Signed forward speed (px/s)
  steerAngle: number; // Visual wheel / steer offset (-1..1)
  baseMaxSpeed: number;
  onRoad: boolean;

  // Drift & Boost states
  isDrifting: boolean;
  driftDir: -1 | 0 | 1;
  driftTimer: number;
  driftReady: boolean;
  miniTurboTimer: number;
  turboItemTimer: number;
  boostPadTimer: number;

  // Spinout & Hit states
  spinoutTimer: number;
  spinoutAngleOffset: number;
  hitFlashTimer: number;

  // Race progress & anti-cheat
  lap: number; // 1-indexed during race; > TOTAL_LAPS when finished
  nextCheckpoint: number; // Index into TrackData.checkpoints
  closestSampleIndex: number;
  totalProgress: number; // Continuous progress for live rankings
  rank: number; // 1..4
  finished: boolean;
  finishTime: number | null;
  lapStartTime: number;
  bestLapTime: number | null;

  // Item inventory & coins
  heldItem: ItemType | null;
  coins: number;
  aiItemCooldown: number;
  aiLaneOffset: number;
  aiSkillSpeedFactor: number;
}

export interface HazardBanana {
  id: string;
  x: number;
  y: number;
  ownerId: string;
  armTimer: number; // Grace time so dropper doesn't hit own banana immediately
  radius: number;
}

export interface ProjectileRocket {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  ownerId: string;
  targetId: string | null;
  life: number;
  radius: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

export interface RaceStandingsEntry {
  id: string;
  name: string;
  driverName: string;
  colorId: KartColorId;
  primaryColor: string;
  isPlayer: boolean;
  rank: number;
  finishTime: number;
  bestLapTime: number | null;
}

export interface HudSnapshot {
  rank: number;
  totalKarts: number;
  lap: number;
  totalLaps: number;
  speedKmh: number;
  raceTime: number;
  coins: number;
  heldItem: ItemType | null;
  driftChargeRatio: number;
  driftReady: boolean;
  isBoosted: boolean;
  countdownValue: number; // 3, 2, 1, 0 (GO!), -1 (hidden)
  calloutText: string | null;
  kartDots: Array<{
    id: string;
    x: number;
    y: number;
    color: string;
    isPlayer: boolean;
  }>;
}
