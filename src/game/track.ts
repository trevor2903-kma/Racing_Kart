import { BoostPad, SceneryProp, TrackData, TrackSample, Vec2 } from './types';

/**
 * Control points forming an extended closed arcade circuit with:
 * - Long main start/finish straight
 * - Wide sweeping coastal turn 1 & speed bend
 * - North-east hairpin & fast back stretch
 * - Technical S-chicane & west valley switchback
 * - Final sweeping corner onto the main straight
 */
const CONTROL_POINTS: Vec2[] = [
  { x: 1350, y: 3350 }, // Start straight west
  { x: 2550, y: 3350 }, // Start straight east
  { x: 3650, y: 3260 }, // Turn 1 entry
  { x: 4480, y: 2880 }, // Sweeping coastal bend
  { x: 4620, y: 1960 }, // East speed straight
  { x: 4120, y: 1080 }, // North-east hairpin
  { x: 3180, y: 760 },  // Fast north straight
  { x: 2480, y: 1280 }, // Chicane entry
  { x: 1960, y: 760 },  // Chicane exit
  { x: 1060, y: 860 },  // North-west sweep
  { x: 680, y: 1620 },  // West valley entry
  { x: 1240, y: 2180 }, // Inner valley hairpin
  { x: 660, y: 2740 },  // South-west bend
  { x: 840, y: 3250 },  // Final corner onto main straight
];

export const WORLD_WIDTH = 5200;
export const WORLD_HEIGHT = 4300;
export const ROAD_WIDTH = 228; // Generous 2.5D arcade road width (> 3x kart width)

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Generates an arc-length parameterized closed circuit with checkpoints,
 * boost pads, item box rows, and non-colliding off-road palm trees & rocks.
 */
export function buildTrackData(): TrackData {
  const subdivisionsPerSegment = 44;
  const rawPoints: Vec2[] = [];
  const n = CONTROL_POINTS.length;

  for (let i = 0; i < n; i++) {
    const p0 = CONTROL_POINTS[(i - 1 + n) % n];
    const p1 = CONTROL_POINTS[i];
    const p2 = CONTROL_POINTS[(i + 1) % n];
    const p3 = CONTROL_POINTS[(i + 2) % n];

    for (let j = 0; j < subdivisionsPerSegment; j++) {
      rawPoints.push(catmullRom(p0, p1, p2, p3, j / subdivisionsPerSegment));
    }
  }

  // Compute tangents, normals, and cumulative arc length
  const m = rawPoints.length;
  const cumLen: number[] = [0];
  for (let i = 1; i < m; i++) {
    const dx = rawPoints[i].x - rawPoints[i - 1].x;
    const dy = rawPoints[i].y - rawPoints[i - 1].y;
    cumLen.push(cumLen[i - 1] + Math.hypot(dx, dy));
  }
  const closingSeg = Math.hypot(
    rawPoints[0].x - rawPoints[m - 1].x,
    rawPoints[0].y - rawPoints[m - 1].y
  );
  const totalLength = cumLen[m - 1] + closingSeg;

  const samples: TrackSample[] = rawPoints.map((pt, i) => {
    const prev = rawPoints[(i - 1 + m) % m];
    const next = rawPoints[(i + 1) % m];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    return {
      x: pt.x,
      y: pt.y,
      tx,
      ty,
      nx: -ty,
      ny: tx,
      s: cumLen[i],
      progress: cumLen[i] / totalLength,
    };
  });

  // 10 sequential anti-cheat checkpoints evenly spaced around the longer circuit
  const checkpointCount = 10;
  const checkpoints: number[] = [];
  for (let c = 1; c <= checkpointCount; c++) {
    const idx = Math.floor((c / (checkpointCount + 1)) * m);
    checkpoints.push(idx);
  }

  // 6 Boost pads placed strategically at straightaways and corner exits
  const boostPadFractions = [0.09, 0.24, 0.42, 0.58, 0.74, 0.90];
  const boostPads: BoostPad[] = boostPadFractions.map((frac, idx) => {
    const sIdx = Math.floor(frac * m) % m;
    const smp = samples[sIdx];
    const lateral = idx % 2 === 0 ? -36 : 36;
    return {
      id: `boost_${idx}`,
      x: smp.x + smp.nx * lateral,
      y: smp.y + smp.ny * lateral,
      angle: Math.atan2(smp.ty, smp.tx),
      width: 56,
      length: 96,
      sampleIndex: sIdx,
    };
  });

  // 4 clusters of 3 Item Boxes across the width of the track
  const itemBoxFractions = [0.13, 0.36, 0.63, 0.84];
  const itemBoxSpawns: Array<{ id: string; x: number; y: number }> = [];
  itemBoxFractions.forEach((frac, clusterIdx) => {
    const sIdx = Math.floor(frac * m) % m;
    const smp = samples[sIdx];
    [-64, 0, 64].forEach((offset, slotIdx) => {
      itemBoxSpawns.push({
        id: `box_${clusterIdx}_${slotIdx}`,
        x: smp.x + smp.nx * offset,
        y: smp.y + smp.ny * offset,
      });
    });
  });

  // 5 arcs of 4 Gold Coins along key straightaways and sweeping apexes
  const coinArcFractions = [0.06, 0.21, 0.48, 0.69, 0.93];
  const coinSpawns: Array<{ id: string; x: number; y: number }> = [];
  coinArcFractions.forEach((frac, arcIdx) => {
    const baseIdx = Math.floor(frac * m) % m;
    const lateral = arcIdx % 2 === 0 ? 44 : -44;
    for (let k = 0; k < 4; k++) {
      const sIdx = (baseIdx + k * 3) % m;
      const smp = samples[sIdx];
      coinSpawns.push({
        id: `coin_${arcIdx}_${k}`,
        x: smp.x + smp.nx * lateral,
        y: smp.y + smp.ny * lateral,
      });
    }
  });

  // Deterministic decorative palm trees, stylized tiered trees & coastal rocks placed safely outside track barriers
  const scenery: SceneryProp[] = [];
  const minClearance = ROAD_WIDTH * 0.5 + 175;
  let seed = 1337;
  const nextRand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 320; i++) {
    const x = 140 + nextRand() * (WORLD_WIDTH - 280);
    const y = 140 + nextRand() * (WORLD_HEIGHT - 280);
    let minDist = Infinity;
    for (let k = 0; k < samples.length; k++) {
      const d = Math.hypot(x - samples[k].x, y - samples[k].y);
      if (d < minDist) minDist = d;
    }
    if (minDist > minClearance) {
      const roll = nextRand();
      const kind: SceneryProp['kind'] = roll < 0.42 ? 'palm' : roll < 0.78 ? 'tree' : 'rock';
      scenery.push({
        kind,
        x,
        y,
        scale: 0.8 + nextRand() * 0.5,
        rotation: nextRand() * Math.PI * 2,
      });
    }
  }

  return {
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    roadWidth: ROAD_WIDTH,
    totalLength,
    samples,
    checkpoints,
    boostPads,
    itemBoxSpawns,
    coinSpawns,
    scenery,
    startLineSampleIndex: 36, // Centered cleanly on the long main straightaway
  };
}

/**
 * Finds the closest sample index on the track centerline to a world position.
 * Supports an optional hint index for O(1) local tracking, falling back to full scan if far.
 */
export function getClosestSampleIndex(
  track: TrackData,
  x: number,
  y: number,
  hintIndex?: number
): number {
  const samples = track.samples;
  const n = samples.length;

  if (hintIndex !== undefined) {
    let bestIdx = hintIndex % n;
    let bestDistSq = Infinity;
    const windowRadius = 26;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = (hintIndex + offset + n) % n;
      const dx = x - samples[idx].x;
      const dy = y - samples[idx].y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
    if (bestDistSq < (track.roadWidth * 1.8) ** 2) {
      return bestIdx;
    }
  }

  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < n; i++) {
    const dx = x - samples[i].x;
    const dy = y - samples[i].y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Returns true if the coordinate (x, y) is within the paved road surface.
 */
export function isPointOnRoad(track: TrackData, x: number, y: number, hintIndex?: number): {
  onRoad: boolean;
  closestIndex: number;
  distanceFromCenter: number;
} {
  const closestIndex = getClosestSampleIndex(track, x, y, hintIndex);
  const smp = track.samples[closestIndex];
  const distanceFromCenter = Math.hypot(x - smp.x, y - smp.y);
  return {
    onRoad: distanceFromCenter <= track.roadWidth * 0.5,
    closestIndex,
    distanceFromCenter,
  };
}

/**
 * Computes cyclic progress [0, 1) relative to the start/finish line.
 */
export function getLapProgressFromStart(track: TrackData, sampleIndex: number): number {
  const n = track.samples.length;
  const relIdx = (sampleIndex - track.startLineSampleIndex + n) % n;
  return relIdx / n;
}
