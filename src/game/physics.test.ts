import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrackData, isPointOnRoad } from './track';
import {
  BASE_MAX_SPEED,
  computeAiInput,
  computeRankings,
  createEmptyStepEvents,
  createInitialCoins,
  createInitialItemBoxes,
  createStartingGrid,
  getEffectiveMaxSpeed,
  stepItemsAndTrackObjects,
  stepKartPhysics,
  updateLapAndCheckpoints,
} from './physics';
import {
  DRIFT_CHARGE_TARGET,
  HazardBanana,
  KartInput,
  MINI_TURBO_DURATION,
  OFFROAD_MAX_SPEED_FACTOR,
  ProjectileRocket,
  TOTAL_LAPS,
  TURBO_ITEM_DURATION,
} from './types';

const IDLE_INPUT: KartInput = {
  accelerate: false,
  brake: false,
  steerLeft: false,
  steerRight: false,
  drift: false,
  useItem: false,
};

test('track starts karts cleanly on road facing forward', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  assert.equal(karts.length, 4);
  for (const kart of karts) {
    const roadCheck = isPointOnRoad(track, kart.x, kart.y);
    assert.equal(roadCheck.onRoad, true, `Kart ${kart.id} should spawn on paved road`);
  }
});

test('off-road reduces max speed by 40%', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  player.onRoad = true;
  const roadMax = getEffectiveMaxSpeed(player);
  player.onRoad = false;
  const grassMax = getEffectiveMaxSpeed(player);
  assert.ok(Math.abs(grassMax - roadMax * OFFROAD_MAX_SPEED_FACTOR) < 0.01);
});

test('drift held for 1.5s charges and triggers 1s Mini-Turbo on release', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const events = createEmptyStepEvents();

  // Accelerate up to drifting speed
  player.speed = BASE_MAX_SPEED * 0.8;

  // Hold drift + steer right for >= 1.5s
  const driftInput: KartInput = { ...IDLE_INPUT, accelerate: true, steerRight: true, drift: true };
  for (let i = 0; i < 95; i++) {
    stepKartPhysics(player, driftInput, track, 1 / 60, events);
  }
  assert.equal(player.isDrifting, true);
  assert.ok(player.driftTimer >= DRIFT_CHARGE_TARGET);
  assert.equal(player.driftReady, true);

  // Release drift
  stepKartPhysics(player, { ...IDLE_INPUT, accelerate: true }, track, 1 / 60, events);
  assert.equal(player.isDrifting, false);
  assert.ok(player.miniTurboTimer > MINI_TURBO_DURATION - 0.05);
  assert.equal(events.miniTurboTriggered.length, 1);
});

test('anti-cheat checkpoints prevent lap increment when skipping track', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const events = createEmptyStepEvents();

  // Teleport straight past finish line without clearing checkpoints
  player.closestSampleIndex = track.startLineSampleIndex + 3;
  updateLapAndCheckpoints(player, track, 10, events);
  assert.equal(player.lap, 1);

  // Clear all checkpoints sequentially, then cross start/finish line
  for (let c = 0; c < track.checkpoints.length; c++) {
    player.closestSampleIndex = track.checkpoints[c];
    updateLapAndCheckpoints(player, track, 12 + c, events);
  }
  assert.equal(player.nextCheckpoint, track.checkpoints.length);

  player.closestSampleIndex = track.startLineSampleIndex + 4;
  updateLapAndCheckpoints(player, track, 25, events);
  assert.equal(player.lap, 2);

  // Complete remaining laps up to TOTAL_LAPS
  for (let lap = 2; lap <= TOTAL_LAPS; lap++) {
    for (let c = 0; c < track.checkpoints.length; c++) {
      player.closestSampleIndex = track.checkpoints[c];
      updateLapAndCheckpoints(player, track, 30 * lap + c, events);
    }
    player.closestSampleIndex = track.startLineSampleIndex + 4;
    updateLapAndCheckpoints(player, track, 30 * lap + 10, events);
  }
  assert.equal(player.finished, true);
  assert.ok(player.finishTime !== null);
});

test('item box grants item and respawns after 5 seconds', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const boxes = createInitialItemBoxes(track);
  const events = createEmptyStepEvents();

  // Move player onto first item box
  player.x = boxes[0].x;
  player.y = boxes[0].y;
  stepItemsAndTrackObjects(karts, {}, boxes, [], [], track, 0.016, events, () => 0.1);

  assert.equal(boxes[0].active, false);
  assert.ok(player.heldItem !== null);

  // Advance 4.9s -> still inactive
  stepItemsAndTrackObjects(karts, {}, boxes, [], [], track, 4.9, events);
  assert.equal(boxes[0].active, false);

  // Advance 0.2s -> respawned
  stepItemsAndTrackObjects(karts, {}, boxes, [], [], track, 0.2, events);
  assert.equal(boxes[0].active, true);
});

test('mushroom turbo boosts max speed to 150% for 2s and banana spins out rival for 1.5s', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const rival = karts.find((k) => !k.isPlayer)!;
  const boxes = createInitialItemBoxes(track);
  const bananas: HazardBanana[] = [];
  const rockets: ProjectileRocket[] = [];
  const events = createEmptyStepEvents();

  player.heldItem = 'turbo';
  stepItemsAndTrackObjects(
    karts,
    { [player.id]: { ...IDLE_INPUT, useItem: true } },
    boxes,
    bananas,
    rockets,
    track,
    0.016,
    events
  );
  assert.ok(player.turboItemTimer > TURBO_ITEM_DURATION - 0.05);
  assert.ok(Math.abs(getEffectiveMaxSpeed(player) - player.baseMaxSpeed * 1.5) < 0.01);

  // Drop banana and drive rival over it
  player.heldItem = 'banana';
  stepItemsAndTrackObjects(
    karts,
    { [player.id]: { ...IDLE_INPUT, useItem: true } },
    boxes,
    bananas,
    rockets,
    track,
    0.016,
    events
  );
  assert.equal(bananas.length, 1);

  rival.x = bananas[0].x;
  rival.y = bananas[0].y;
  stepItemsAndTrackObjects(karts, {}, boxes, bananas, rockets, track, 0.016, events);
  assert.equal(bananas.length, 0);
  assert.ok(rival.spinoutTimer > 1.4);
});

test('homing rocket tracks nearest ahead opponent and causes spinout', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const aiAhead = karts[0];
  aiAhead.x = player.x + 240;
  aiAhead.y = player.y + 40;
  player.totalProgress = 0.2;
  aiAhead.totalProgress = 0.28;
  computeRankings(karts);

  const boxes = createInitialItemBoxes(track);
  const rockets: ProjectileRocket[] = [];
  const events = createEmptyStepEvents();

  // Fire rocket roughly forward (slightly off-axis to prove homing steers onto target)
  player.angle = 0;
  player.heldItem = 'rocket';
  stepItemsAndTrackObjects(
    karts,
    { [player.id]: { ...IDLE_INPUT, useItem: true } },
    boxes,
    [],
    rockets,
    track,
    0.016,
    events
  );
  assert.equal(rockets.length, 1);
  assert.equal(rockets[0].targetId, aiAhead.id);

  // Step simulation until rocket homes in and hits target
  for (let i = 0; i < 90; i++) {
    stepItemsAndTrackObjects(karts, {}, boxes, [], rockets, track, 0.016, events);
    if ((rockets as ProjectileRocket[]).length === 0) break;
  }
  assert.equal((rockets as ProjectileRocket[]).length, 0);
  assert.ok(aiAhead.spinoutTimer > 0.5);
});

test('AI controller outputs valid steering and acceleration along track', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const ai = karts[0];
  const aiInput = computeAiInput(ai, karts, [], track, 0.016);
  assert.equal(aiInput.accelerate, true);
});

test('gold coin pickup increments coin count, boosts max speed, and respawns after 6s', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const boxes = createInitialItemBoxes(track);
  const coins = createInitialCoins(track);
  const events = createEmptyStepEvents();

  assert.ok(coins.length >= 10);
  const baseMax = getEffectiveMaxSpeed(player);

  player.x = coins[0].x;
  player.y = coins[0].y;
  stepItemsAndTrackObjects(karts, {}, boxes, [], [], track, 0.016, events, () => 0.5, coins);

  assert.equal(coins[0].active, false);
  assert.equal(player.coins, 1);
  assert.equal(events.coinPickedUp.length, 1);
  assert.ok(getEffectiveMaxSpeed(player) > baseMax);

  stepItemsAndTrackObjects(karts, {}, boxes, [], [], track, 6.1, events, () => 0.5, coins);
  assert.equal(coins[0].active, true);
});

test('trackside barriers block karts from driving outside and scenery stays clear of track', () => {
  const track = buildTrackData();
  const karts = createStartingGrid(track, 'red');
  const player = karts.find((k) => k.isPlayer)!;
  const smp = track.samples[player.closestSampleIndex];

  // Aim kart perpendicularly toward right barrier wall and drive hard
  player.angle = Math.atan2(smp.ny, smp.nx);
  player.speed = BASE_MAX_SPEED;
  const events = createEmptyStepEvents();
  for (let i = 0; i < 60; i++) {
    stepKartPhysics(player, { ...IDLE_INPUT, accelerate: true }, track, 1 / 60, events);
  }

  const info = isPointOnRoad(track, player.x, player.y, player.closestSampleIndex);
  assert.ok(
    info.distanceFromCenter <= track.roadWidth * 0.5 + 24,
    `Kart must be stopped by barrier wall (dist=${info.distanceFromCenter})`
  );

  // Verify no scenery prop intrudes inside barriers
  for (const prop of track.scenery) {
    let minDist = Infinity;
    for (const s of track.samples) {
      const d = Math.hypot(prop.x - s.x, prop.y - s.y);
      if (d < minDist) minDist = d;
    }
    assert.ok(
      minDist > track.roadWidth * 0.5 + 165,
      `Scenery prop too close to track (${minDist})`
    );
  }
});
