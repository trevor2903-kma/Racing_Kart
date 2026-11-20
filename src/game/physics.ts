import {
  BANANA_SPINOUT_DURATION,
  BOOST_PAD_DURATION,
  DRIFT_CHARGE_TARGET,
  HazardBanana,
  ITEM_BOX_RESPAWN_TIME,
  ItemBox,
  ItemType,
  KART_PRESETS,
  KartColorId,
  KartInput,
  KartPreset,
  KartState,
  MINI_TURBO_DURATION,
  OFFROAD_MAX_SPEED_FACTOR,
  ProjectileRocket,
  ROCKET_HIT_SPINOUT,
  TOTAL_LAPS,
  TURBO_ITEM_DURATION,
  TrackCoin,
  TrackData,
} from './types';
import { getLapProgressFromStart, isPointOnRoad } from './track';

export const BASE_MAX_SPEED = 350; // px/s (~120 km/h on speedometer, smooth controllable 3D pace)
export const REVERSE_MAX_SPEED = 135;
export const ACCEL_RATE = 320;
export const BRAKE_RATE = 460;
export const DRAG_RATE = 180;
export const KART_RADIUS = 19;
export const BARRIER_LATERAL_OFFSET = 48; // Matches 3D barrier wall center (+4.8m outside roadHalf)
export const BARRIER_INNER_CLEARANCE = 23; // 48 - 11 (wall half-thickness) - 14 (kart half-width)

export interface StepEvents {
  itemPickedUp: Array<{ kartId: string; isPlayer: boolean; item: ItemType }>;
  coinPickedUp: Array<{ kartId: string; isPlayer: boolean; x: number; y: number }>;
  miniTurboTriggered: Array<{ kartId: string; isPlayer: boolean }>;
  boostPadTriggered: Array<{ kartId: string; isPlayer: boolean }>;
  itemUsed: Array<{ kartId: string; isPlayer: boolean; item: ItemType }>;
  kartSpinout: Array<{ kartId: string; isPlayer: boolean; x: number; y: number; cause: 'banana' | 'rocket' }>;
  lapCompleted: Array<{ kartId: string; isPlayer: boolean; newLap: number; finished: boolean }>;
  kartBump: Array<{ x: number; y: number; intensity: number }>;
}

export function createEmptyStepEvents(): StepEvents {
  return {
    itemPickedUp: [],
    coinPickedUp: [],
    miniTurboTriggered: [],
    boostPadTriggered: [],
    itemUsed: [],
    kartSpinout: [],
    lapCompleted: [],
    kartBump: [],
  };
}

export function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

/**
 * Creates 4 karts on a staggered 2x2 starting grid behind the start/finish line.
 */
export function createStartingGrid(
  track: TrackData,
  playerColorId: KartColorId = 'red'
): KartState[] {
  const playerPreset = KART_PRESETS.find((p) => p.id === playerColorId) || KART_PRESETS[0];
  const aiPresets = KART_PRESETS.filter((p) => p.id !== playerPreset.id);

  // Order on grid: 3 AI karts in front slots + player in P4 (or P1..P4)
  // Place player in P4 (back-right) for exciting overtakes, or P1? Let's place player in P3 (2nd row left) so 2 AI are visible ahead and 1 behind.
  const orderedPresets: Array<{ preset: KartPreset; isPlayer: boolean; aiSpeed: number; lane: number }> = [
    { preset: aiPresets[0], isPlayer: false, aiSpeed: 0.96, lane: -34 },
    { preset: aiPresets[1], isPlayer: false, aiSpeed: 0.92, lane: 34 },
    { preset: playerPreset, isPlayer: true, aiSpeed: 1.0, lane: -34 },
    { preset: aiPresets[2], isPlayer: false, aiSpeed: 0.89, lane: 34 },
  ];

  const n = track.samples.length;
  return orderedPresets.map((entry, slotIdx) => {
    const row = Math.floor(slotIdx / 2);
    const backSamples = 6 + row * 5;
    const sampleIdx = (track.startLineSampleIndex - backSamples + n) % n;
    const smp = track.samples[sampleIdx];
    const x = smp.x + smp.nx * entry.lane;
    const y = smp.y + smp.ny * entry.lane;
    const angle = Math.atan2(smp.ty, smp.tx);

    return {
      id: entry.isPlayer ? 'player' : `ai_${entry.preset.id}`,
      preset: entry.preset,
      isPlayer: entry.isPlayer,
      x,
      y,
      vx: 0,
      vy: 0,
      angle,
      speed: 0,
      steerAngle: 0,
      baseMaxSpeed: BASE_MAX_SPEED * entry.aiSpeed,
      onRoad: true,
      isDrifting: false,
      driftDir: 0,
      driftTimer: 0,
      driftReady: false,
      miniTurboTimer: 0,
      turboItemTimer: 0,
      boostPadTimer: 0,
      spinoutTimer: 0,
      spinoutAngleOffset: 0,
      hitFlashTimer: 0,
      lap: 1,
      nextCheckpoint: 0,
      closestSampleIndex: sampleIdx,
      totalProgress: -0.05 * (slotIdx + 1),
      rank: slotIdx + 1,
      finished: false,
      finishTime: null,
      lapStartTime: 0,
      bestLapTime: null,
      heldItem: null,
      coins: 0,
      aiItemCooldown: 1.2 + slotIdx * 0.4,
      aiLaneOffset: entry.lane * 0.6,
      aiSkillSpeedFactor: entry.aiSpeed,
    };
  });
}

export function createInitialItemBoxes(track: TrackData): ItemBox[] {
  return track.itemBoxSpawns.map((sp, idx) => ({
    id: sp.id,
    x: sp.x,
    y: sp.y,
    radius: 20,
    active: true,
    respawnTimer: 0,
    phase: idx * 0.7,
  }));
}

export function createInitialCoins(track: TrackData): TrackCoin[] {
  return track.coinSpawns.map((sp, idx) => ({
    id: sp.id,
    x: sp.x,
    y: sp.y,
    radius: 16,
    active: true,
    respawnTimer: 0,
    phase: idx * 0.55,
  }));
}

/**
 * Computes effective maximum speed taking into account off-road penalty (40% reduction)
 * and active Turbo / Mini-Turbo / Boost Pad multipliers.
 */
export function getEffectiveMaxSpeed(kart: KartState): number {
  const coinBonus = 1 + Math.min(10, kart.coins) * 0.008;
  let maxSpeed = kart.baseMaxSpeed * coinBonus;

  // Off-road reduces max speed by 40% unless actively boosting with Mushroom Turbo
  if (!kart.onRoad && kart.turboItemTimer <= 0) {
    maxSpeed *= OFFROAD_MAX_SPEED_FACTOR;
  }

  let boostMultiplier = 1.0;
  if (kart.turboItemTimer > 0) {
    boostMultiplier = Math.max(boostMultiplier, 1.5); // 150% max speed
  }
  if (kart.boostPadTimer > 0) {
    boostMultiplier = Math.max(boostMultiplier, 1.42);
  }
  if (kart.miniTurboTimer > 0) {
    boostMultiplier = Math.max(boostMultiplier, 1.36);
  }

  return maxSpeed * boostMultiplier;
}

/**
 * Advances a single kart's physics, drift charging, mini-turbo release, and world bounds.
 */
export function stepKartPhysics(
  kart: KartState,
  input: KartInput,
  track: TrackData,
  dt: number,
  events?: StepEvents
): void {
  // Tick timers
  if (kart.miniTurboTimer > 0) kart.miniTurboTimer = Math.max(0, kart.miniTurboTimer - dt);
  if (kart.turboItemTimer > 0) kart.turboItemTimer = Math.max(0, kart.turboItemTimer - dt);
  if (kart.boostPadTimer > 0) kart.boostPadTimer = Math.max(0, kart.boostPadTimer - dt);
  if (kart.hitFlashTimer > 0) kart.hitFlashTimer = Math.max(0, kart.hitFlashTimer - dt);

  // Check road surface under kart
  const roadInfo = isPointOnRoad(track, kart.x, kart.y, kart.closestSampleIndex);
  kart.onRoad = roadInfo.onRoad;
  kart.closestSampleIndex = roadInfo.closestIndex;

  // Handle spinout state (Banana or Rocket hit)
  if (kart.spinoutTimer > 0) {
    kart.spinoutTimer = Math.max(0, kart.spinoutTimer - dt);
    kart.spinoutAngleOffset += dt * 13.5;
    kart.isDrifting = false;
    kart.driftDir = 0;
    kart.driftTimer = 0;
    kart.driftReady = false;

    // Decelerate smoothly during spinout
    kart.vx *= Math.max(0, 1 - 2.8 * dt);
    kart.vy *= Math.max(0, 1 - 2.8 * dt);
    kart.speed = Math.hypot(kart.vx, kart.vy);
    kart.x += kart.vx * dt;
    kart.y += kart.vy * dt;
    constrainKartToTrackBarriers(kart, track, events);
    if (kart.spinoutTimer <= 0) {
      kart.spinoutAngleOffset = 0;
    }
    return;
  }

  const steerInput = (input.steerRight ? 1 : 0) - (input.steerLeft ? 1 : 0);
  kart.steerAngle += (steerInput - kart.steerAngle) * Math.min(1, dt * 9.5);

  const effectiveMax = getEffectiveMaxSpeed(kart);
  const isActivelyBoosted =
    kart.turboItemTimer > 0 || kart.miniTurboTimer > 0 || kart.boostPadTimer > 0;

  // Longitudinal acceleration / braking
  if (isActivelyBoosted) {
    // Boost overrides throttle smoothly up to boosted max speed
    const targetBoostSpeed = Math.max(kart.speed, effectiveMax * 0.96);
    kart.speed += (targetBoostSpeed - kart.speed) * Math.min(1, dt * 7.5);
  } else if (input.accelerate) {
    const accelMultiplier = kart.onRoad ? 1.0 : 0.72;
    kart.speed += ACCEL_RATE * accelMultiplier * dt;
  } else if (input.brake) {
    if (kart.speed > 15) {
      kart.speed -= BRAKE_RATE * dt;
    } else {
      kart.speed -= ACCEL_RATE * 0.65 * dt;
    }
  } else {
    // Natural rolling drag
    if (kart.speed > 0) {
      kart.speed = Math.max(0, kart.speed - DRAG_RATE * dt);
    } else if (kart.speed < 0) {
      kart.speed = Math.min(0, kart.speed + DRAG_RATE * 1.4 * dt);
    }
  }

  // Softly pull speed down if exceeding effective max (e.g. entering grass off-road)
  if (kart.speed > effectiveMax) {
    kart.speed = Math.max(effectiveMax, kart.speed - 380 * dt);
  }
  if (kart.speed < -REVERSE_MAX_SPEED) {
    kart.speed = -REVERSE_MAX_SPEED;
  }

  // Drift & Mini-Turbo state machine
  const canDrift = input.drift && kart.speed > 125;
  if (canDrift && !kart.isDrifting && steerInput !== 0) {
    kart.isDrifting = true;
    kart.driftDir = steerInput > 0 ? 1 : -1;
    kart.driftTimer = 0;
    kart.driftReady = false;
  } else if (kart.isDrifting) {
    if (!input.drift || kart.speed < 80) {
      // Drift released -> check if Mini-Turbo earned (>= 1.5s)
      if (kart.driftReady) {
        kart.miniTurboTimer = MINI_TURBO_DURATION;
        kart.speed = Math.max(kart.speed, kart.baseMaxSpeed * 1.32);
        events?.miniTurboTriggered.push({ kartId: kart.id, isPlayer: kart.isPlayer });
      }
      kart.isDrifting = false;
      kart.driftDir = 0;
      kart.driftTimer = 0;
      kart.driftReady = false;
    } else {
      // Accumulate drift charge (faster when counter-steering/tightening into turn)
      const chargeRate = steerInput === kart.driftDir ? 1.1 : 0.92;
      kart.driftTimer += dt * chargeRate;
      if (kart.driftTimer >= DRIFT_CHARGE_TARGET) {
        kart.driftReady = true;
      }
    }
  }

  // Angular steering rate (tuned for smooth, controllable A/D & Space drift)
  const speedRatio = Math.min(1, Math.abs(kart.speed) / (BASE_MAX_SPEED * 0.45));
  const reverseSign = kart.speed >= -5 ? 1 : -1;
  if (kart.isDrifting) {
    // Locked drift direction with gentle arc tightening (0.64x to 1.36x)
    const arcAdjust = 1.0 + kart.steerAngle * kart.driftDir * 0.36;
    const driftTurnRate = 1.85 * arcAdjust;
    kart.angle = normalizeAngle(kart.angle + kart.driftDir * driftTurnRate * dt);
  } else {
    const baseTurnRate = 2.15;
    kart.angle = normalizeAngle(
      kart.angle + kart.steerAngle * baseTurnRate * speedRatio * reverseSign * dt
    );
  }

  // Lateral grip & drift inertia blending
  const forwardX = Math.cos(kart.angle);
  const forwardY = Math.sin(kart.angle);
  const targetVx = forwardX * kart.speed;
  const targetVy = forwardY * kart.speed;

  // Higher grip on road, controlled slide when drifting or off-road
  const lateralGrip = kart.isDrifting ? 5.2 : kart.onRoad ? 11.5 : 7.0;
  const blend = Math.min(1, lateralGrip * dt);
  kart.vx += (targetVx - kart.vx) * blend;
  kart.vy += (targetVy - kart.vy) * blend;

  kart.x += kart.vx * dt;
  kart.y += kart.vy * dt;

  constrainKartToTrackBarriers(kart, track, events);
}

function constrainKartToTrackBarriers(
  kart: KartState,
  track: TrackData,
  events?: StepEvents
): void {
  const roadInfo = isPointOnRoad(track, kart.x, kart.y, kart.closestSampleIndex);
  kart.closestSampleIndex = roadInfo.closestIndex;
  const smp = track.samples[roadInfo.closestIndex];

  const maxLateral = track.roadWidth * 0.5 + BARRIER_INNER_CLEARANCE;
  const dx = kart.x - smp.x;
  const dy = kart.y - smp.y;
  const lat = dx * smp.nx + dy * smp.ny;
  const absLat = Math.abs(lat);

  if (absLat > maxLateral) {
    const sign = lat >= 0 ? 1 : -1;
    const outX = smp.nx * sign;
    const outY = smp.ny * sign;
    const push = absLat - maxLateral;
    kart.x -= outX * push;
    kart.y -= outY * push;

    const vOut = kart.vx * outX + kart.vy * outY;
    if (vOut > 0) {
      kart.vx -= outX * vOut * 1.25;
      kart.vy -= outY * vOut * 1.25;
      kart.speed *= 0.85;
      if (vOut > 85) {
        events?.kartBump.push({
          x: kart.x + outX * 14,
          y: kart.y + outY * 14,
          intensity: Math.min(0.9, vOut / 280),
        });
      }
    }

    // Gently deflect steering angle along barrier tangent so karts slide smoothly instead of sticking
    const tangentAngle = Math.atan2(smp.ty, smp.tx);
    const forwardDot = Math.cos(kart.angle) * smp.tx + Math.sin(kart.angle) * smp.ty;
    const targetWallAngle = forwardDot >= 0 ? tangentAngle : normalizeAngle(tangentAngle + Math.PI);
    const angleDiff = normalizeAngle(targetWallAngle - kart.angle);
    kart.angle = normalizeAngle(kart.angle + angleDiff * 0.22);
  }

  const margin = 42;
  if (kart.x < margin) {
    kart.x = margin;
    kart.vx = Math.abs(kart.vx) * 0.4;
  } else if (kart.x > track.worldWidth - margin) {
    kart.x = track.worldWidth - margin;
    kart.vx = -Math.abs(kart.vx) * 0.4;
  }

  if (kart.y < margin) {
    kart.y = margin;
    kart.vy = Math.abs(kart.vy) * 0.4;
  } else if (kart.y > track.worldHeight - margin) {
    kart.y = track.worldHeight - margin;
    kart.vy = -Math.abs(kart.vy) * 0.4;
  }
}

/**
 * Anti-cheat checkpoint and 3-lap progression tracker.
 */
export function updateLapAndCheckpoints(
  kart: KartState,
  track: TrackData,
  raceTime: number,
  events?: StepEvents
): void {
  if (kart.finished) return;

  const n = track.samples.length;
  const currIdx = kart.closestSampleIndex;

  // Check if kart passed the next expected checkpoint
  if (kart.nextCheckpoint < track.checkpoints.length) {
    const cpIdx = track.checkpoints[kart.nextCheckpoint];
    const diff = Math.abs(((currIdx - cpIdx + n + n / 2) % n) - n / 2);
    if (diff <= 18) {
      kart.nextCheckpoint += 1;
    }
  }

  // Check if all checkpoints are cleared and kart crossed the Start/Finish line
  if (kart.nextCheckpoint >= track.checkpoints.length) {
    const startIdx = track.startLineSampleIndex;
    const relFromStart = (currIdx - startIdx + n) % n;
    // Crossed forward past start line (within 0..22 samples ahead of start line)
    if (relFromStart >= 0 && relFromStart <= 22) {
      const lapDuration = raceTime - kart.lapStartTime;
      if (lapDuration > 3) {
        kart.bestLapTime =
          kart.bestLapTime === null ? lapDuration : Math.min(kart.bestLapTime, lapDuration);
      }
      kart.lapStartTime = raceTime;
      kart.nextCheckpoint = 0;

      if (kart.lap >= TOTAL_LAPS) {
        kart.finished = true;
        kart.finishTime = raceTime;
        kart.lap = TOTAL_LAPS + 1;
        events?.lapCompleted.push({
          kartId: kart.id,
          isPlayer: kart.isPlayer,
          newLap: TOTAL_LAPS,
          finished: true,
        });
      } else {
        kart.lap += 1;
        events?.lapCompleted.push({
          kartId: kart.id,
          isPlayer: kart.isPlayer,
          newLap: kart.lap,
          finished: false,
        });
      }
    }
  }

  // Update continuous progress for live standings
  if (kart.finished) {
    kart.totalProgress = TOTAL_LAPS + 1;
  } else {
    let frac = getLapProgressFromStart(track, currIdx);
    // If just behind the start line before crossing on lap 1 (or before checkpoints clear), treat high frac at checkpoint 0 as negative/pre-start
    if (kart.nextCheckpoint === 0 && frac > 0.8) {
      frac -= 1.0;
    }
    kart.totalProgress = (kart.lap - 1) + frac;
  }
}

/**
 * Updates Item Box respawns, pickups, Boost Pads, Bananas, Homing Rockets, and Kart bumps.
 */
export function stepItemsAndTrackObjects(
  karts: KartState[],
  inputs: Record<string, KartInput>,
  itemBoxes: ItemBox[],
  bananas: HazardBanana[],
  rockets: ProjectileRocket[],
  track: TrackData,
  dt: number,
  events: StepEvents,
  rng: () => number = Math.random,
  coins: TrackCoin[] = []
): void {
  // 1. Item Boxes respawn & collection
  for (const box of itemBoxes) {
    box.phase += dt * 3.2;
    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.respawnTimer = 0;
      }
      continue;
    }

    for (const kart of karts) {
      const dist = Math.hypot(kart.x - box.x, kart.y - box.y);
      if (dist <= box.radius + KART_RADIUS) {
        box.active = false;
        box.respawnTimer = ITEM_BOX_RESPAWN_TIME;
        if (!kart.heldItem) {
          const item = pickRandomItem(kart.rank, rng);
          kart.heldItem = item;
          events.itemPickedUp.push({ kartId: kart.id, isPlayer: kart.isPlayer, item });
        }
        break;
      }
    }
  }

  // 1b. Gold Coins pickup & 6s respawn
  for (const coin of coins) {
    coin.phase += dt * 3.6;
    if (!coin.active) {
      coin.respawnTimer -= dt;
      if (coin.respawnTimer <= 0) {
        coin.active = true;
        coin.respawnTimer = 0;
      }
      continue;
    }

    for (const kart of karts) {
      const dist = Math.hypot(kart.x - coin.x, kart.y - coin.y);
      if (dist <= coin.radius + KART_RADIUS) {
        coin.active = false;
        coin.respawnTimer = 6.0;
        kart.coins += 1;
        events.coinPickedUp.push({
          kartId: kart.id,
          isPlayer: kart.isPlayer,
          x: coin.x,
          y: coin.y,
        });
        break;
      }
    }
  }

  // 2. Boost Pads
  for (const pad of track.boostPads) {
    for (const kart of karts) {
      const dist = Math.hypot(kart.x - pad.x, kart.y - pad.y);
      if (dist <= 38) {
        if (kart.boostPadTimer < 0.25) {
          events.boostPadTriggered.push({ kartId: kart.id, isPlayer: kart.isPlayer });
        }
        kart.boostPadTimer = BOOST_PAD_DURATION;
        kart.speed = Math.max(kart.speed, kart.baseMaxSpeed * 1.38);
      }
    }
  }

  // 3. Use held items
  for (const kart of karts) {
    const input = inputs[kart.id];
    if (!kart.finished && kart.spinoutTimer <= 0 && kart.heldItem && input?.useItem) {
      const item = kart.heldItem;
      kart.heldItem = null;
      events.itemUsed.push({ kartId: kart.id, isPlayer: kart.isPlayer, item });

      if (item === 'turbo') {
        kart.turboItemTimer = TURBO_ITEM_DURATION;
        kart.speed = Math.max(kart.speed, kart.baseMaxSpeed * 1.45);
      } else if (item === 'banana') {
        const dropDist = KART_RADIUS + 18;
        bananas.push({
          id: `banana_${Date.now()}_${Math.floor(rng() * 10000)}`,
          x: kart.x - Math.cos(kart.angle) * dropDist,
          y: kart.y - Math.sin(kart.angle) * dropDist,
          ownerId: kart.id,
          armTimer: 0.35,
          radius: 15,
        });
      } else if (item === 'rocket') {
        const target = findNearestAheadTarget(kart, karts);
        const launchSpeed = 570;
        const spawnDist = KART_RADIUS + 20;
        rockets.push({
          id: `rocket_${Date.now()}_${Math.floor(rng() * 10000)}`,
          x: kart.x + Math.cos(kart.angle) * spawnDist,
          y: kart.y + Math.sin(kart.angle) * spawnDist,
          vx: Math.cos(kart.angle) * launchSpeed,
          vy: Math.sin(kart.angle) * launchSpeed,
          angle: kart.angle,
          ownerId: kart.id,
          targetId: target ? target.id : null,
          life: 4.5,
          radius: 14,
        });
      }
    }
  }

  // 4. Bananas
  for (let i = bananas.length - 1; i >= 0; i--) {
    const b = bananas[i];
    if (b.armTimer > 0) b.armTimer = Math.max(0, b.armTimer - dt);

    let hit = false;
    for (const kart of karts) {
      if (b.armTimer > 0 && kart.id === b.ownerId) continue;
      if (kart.spinoutTimer > 0) continue;
      const dist = Math.hypot(kart.x - b.x, kart.y - b.y);
      if (dist <= b.radius + KART_RADIUS - 3) {
        kart.spinoutTimer = BANANA_SPINOUT_DURATION;
        kart.hitFlashTimer = 0.16;
        kart.speed *= 0.35;
        events.kartSpinout.push({
          kartId: kart.id,
          isPlayer: kart.isPlayer,
          x: kart.x,
          y: kart.y,
          cause: 'banana',
        });
        hit = true;
        break;
      }
    }
    if (hit) {
      bananas.splice(i, 1);
    }
  }

  // 5. Homing Rockets
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.life -= dt;
    if (r.life <= 0) {
      rockets.splice(i, 1);
      continue;
    }

    // Re-acquire or steer toward target
    let targetKart = karts.find((k) => k.id === r.targetId && !k.finished);
    if (!targetKart) {
      // Steer along road if no specific target
      const roadInfo = isPointOnRoad(track, r.x, r.y);
      const aheadIdx = (roadInfo.closestIndex + 6) % track.samples.length;
      const smp = track.samples[aheadIdx];
      const desiredAngle = Math.atan2(smp.y - r.y, smp.x - r.x);
      const diff = normalizeAngle(desiredAngle - r.angle);
      r.angle = normalizeAngle(r.angle + Math.max(-3.8 * dt, Math.min(3.8 * dt, diff)));
    } else {
      const desiredAngle = Math.atan2(targetKart.y - r.y, targetKart.x - r.x);
      const diff = normalizeAngle(desiredAngle - r.angle);
      const maxTurn = 5.4 * dt;
      r.angle = normalizeAngle(r.angle + Math.max(-maxTurn, Math.min(maxTurn, diff)));
    }

    const rocketSpeed = 580;
    r.vx = Math.cos(r.angle) * rocketSpeed;
    r.vy = Math.sin(r.angle) * rocketSpeed;
    r.x += r.vx * dt;
    r.y += r.vy * dt;

    let exploded = false;
    for (const kart of karts) {
      if (kart.id === r.ownerId && r.life > 4.2) continue;
      if (kart.id === r.ownerId) continue;
      const dist = Math.hypot(kart.x - r.x, kart.y - r.y);
      if (dist <= r.radius + KART_RADIUS + 4) {
        kart.spinoutTimer = ROCKET_HIT_SPINOUT;
        kart.hitFlashTimer = 0.22;
        kart.speed *= 0.2;
        kart.vx *= 0.2;
        kart.vy *= 0.2;
        events.kartSpinout.push({
          kartId: kart.id,
          isPlayer: kart.isPlayer,
          x: kart.x,
          y: kart.y,
          cause: 'rocket',
        });
        exploded = true;
        break;
      }
    }

    if (exploded) {
      rockets.splice(i, 1);
    }
  }

  // 6. Kart-to-Kart elastic collisions
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = KART_RADIUS * 2;
      if (dist > 0.001 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.5;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal < 0) {
          const impulse = -velAlongNormal * 0.65;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          events.kartBump.push({
            x: (a.x + b.x) * 0.5,
            y: (a.y + b.y) * 0.5,
            intensity: Math.min(1, Math.abs(velAlongNormal) / 350),
          });
        }
      }
    }
  }
}

export function pickRandomItem(rank: number, rng: () => number = Math.random): ItemType {
  const r = rng();
  // Slight rubber-band weighting: trailing racers get Turbo & Rocket slightly more often
  if (rank >= 3) {
    if (r < 0.42) return 'turbo';
    if (r < 0.82) return 'rocket';
    return 'banana';
  }
  if (r < 0.36) return 'turbo';
  if (r < 0.68) return 'banana';
  return 'rocket';
}

/**
 * Finds the nearest rival ahead of the firing kart (by race progress or proximity ahead).
 */
export function findNearestAheadTarget(
  shooter: KartState,
  karts: KartState[]
): KartState | null {
  let bestTarget: KartState | null = null;
  let bestScore = Infinity;

  for (const other of karts) {
    if (other.id === shooter.id || other.finished) continue;
    const progressDiff = other.totalProgress - shooter.totalProgress;
    const dist = Math.hypot(other.x - shooter.x, other.y - shooter.y);

    // Prefer rivals ahead in race rank/progress, otherwise closest ahead geometrically
    if (progressDiff > 0) {
      if (dist < bestScore) {
        bestScore = dist;
        bestTarget = other;
      }
    }
  }

  if (bestTarget) return bestTarget;

  // Fallback if shooter is in 1st place: find closest opponent in front cone
  const fx = Math.cos(shooter.angle);
  const fy = Math.sin(shooter.angle);
  for (const other of karts) {
    if (other.id === shooter.id || other.finished) continue;
    const dx = other.x - shooter.x;
    const dy = other.y - shooter.y;
    const dist = Math.hypot(dx, dy);
    const dot = (dx * fx + dy * fy) / (dist || 1);
    if (dot > 0.1 && dist < bestScore) {
      bestScore = dist;
      bestTarget = other;
    }
  }

  return bestTarget;
}

/**
 * Updates live 1st..4th race rankings based on finish time or total race progress.
 */
export function computeRankings(karts: KartState[]): void {
  const sorted = [...karts].sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.totalProgress - a.totalProgress;
  });

  sorted.forEach((k, idx) => {
    k.rank = idx + 1;
  });
}

/**
 * AI Bot controller: follows track waypoints, avoids banana hazards, and uses items smartly.
 */
export function computeAiInput(
  ai: KartState,
  allKarts: KartState[],
  bananas: HazardBanana[],
  track: TrackData,
  dt: number
): KartInput {
  const n = track.samples.length;
  const lookAheadSteps = 10;
  const targetSample = track.samples[(ai.closestSampleIndex + lookAheadSteps) % n];

  // Dynamic lane avoidance around bananas ahead
  let avoidOffset = ai.aiLaneOffset;
  for (const b of bananas) {
    const dx = b.x - ai.x;
    const dy = b.y - ai.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 170) {
      const forwardDot = dx * Math.cos(ai.angle) + dy * Math.sin(ai.angle);
      if (forwardDot > 0) {
        const lateral = dx * -Math.sin(ai.angle) + dy * Math.cos(ai.angle);
        avoidOffset += lateral > 0 ? -52 : 52;
      }
    }
  }
  avoidOffset = Math.max(-72, Math.min(72, avoidOffset));

  const tx = targetSample.x + targetSample.nx * avoidOffset;
  const ty = targetSample.y + targetSample.ny * avoidOffset;
  const desiredAngle = Math.atan2(ty - ai.y, tx - ai.x);
  const angleErr = normalizeAngle(desiredAngle - ai.angle);

  const steerLeft = angleErr < -0.08;
  const steerRight = angleErr > 0.08;
  // Drift gently on sharper bends
  const drift = Math.abs(angleErr) > 0.58 && ai.speed > 200;

  // AI smart item usage
  let useItem = false;
  if (ai.heldItem) {
    ai.aiItemCooldown -= dt;
    if (ai.aiItemCooldown <= 0) {
      if (ai.heldItem === 'turbo' && Math.abs(angleErr) < 0.35) {
        useItem = true;
      } else if (ai.heldItem === 'rocket') {
        const ahead = findNearestAheadTarget(ai, allKarts);
        if (ahead) useItem = true;
      } else if (ai.heldItem === 'banana') {
        useItem = true;
      }
      if (useItem) {
        ai.aiItemCooldown = 1.8;
      }
    }
  }

  return {
    accelerate: true,
    brake: false,
    steerLeft,
    steerRight,
    drift,
    useItem,
  };
}
