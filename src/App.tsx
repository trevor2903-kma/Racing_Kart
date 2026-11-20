import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FinishModal } from './components/FinishModal';
import { PauseModal } from './components/PauseModal';
import { RaceHud, RaceHudHandle } from './components/RaceHud';
import { TitleOverlay } from './components/TitleOverlay';
import { kartAudio } from './game/audio';
import {
  DiscreteHudState,
  extractDiscreteHudState,
  hasDiscreteHudChanged,
} from './game/items';
import {
  BASE_MAX_SPEED,
  computeAiInput,
  computeRankings,
  createEmptyStepEvents,
  createInitialCoins,
  createInitialItemBoxes,
  createStartingGrid,
  stepItemsAndTrackObjects,
  stepKartPhysics,
  updateLapAndCheckpoints,
} from './game/physics';
import { KartThreeScene } from './game/threeScene';
import { buildTrackData } from './game/track';
import {
  DRIFT_CHARGE_TARGET,
  GameState,
  HazardBanana,
  HudSnapshot,
  ItemBox,
  KartColorId,
  KartInput,
  KartState,
  ProjectileRocket,
  RaceStandingsEntry,
  TOTAL_LAPS,
  TrackCoin,
} from './game/types';

interface SimState {
  phase: GameState;
  karts: KartState[];
  itemBoxes: ItemBox[];
  coins: TrackCoin[];
  bananas: HazardBanana[];
  rockets: ProjectileRocket[];
  raceTime: number;
  countdownTimer: number;
  lastCountdownDigit: number;
  goDisplayTimer: number;
  calloutText: string | null;
  calloutTimer: number;
  hitstopTimer: number;
  timeNow: number;
}

const INITIAL_HUD: HudSnapshot = {
  rank: 3,
  totalKarts: 4,
  lap: 1,
  totalLaps: TOTAL_LAPS,
  speedKmh: 0,
  raceTime: 0,
  coins: 0,
  heldItem: null,
  driftChargeRatio: 0,
  driftReady: false,
  isBoosted: false,
  countdownValue: -1,
  calloutText: null,
  kartDots: [],
};

export default function App() {
  const track = useMemo(() => buildTrackData(), []);
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [gameState, setGameState] = useState<GameState>(() =>
    isAutostart ? 'playing' : 'title'
  );
  const [selectedColor, setSelectedColor] = useState<KartColorId>('red');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [standings, setStandings] = useState<RaceStandingsEntry[]>([]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const threeSceneRef = useRef<KartThreeScene | null>(null);
  const hudHandleRef = useRef<RaceHudHandle | null>(null);
  const lastDiscreteHudRef = useRef<DiscreteHudState>(
    extractDiscreteHudState(INITIAL_HUD)
  );

  const keysHeldRef = useRef<Set<string>>(new Set());
  const useItemPressedRef = useRef(false);
  const selectedColorRef = useRef<KartColorId>(selectedColor);
  selectedColorRef.current = selectedColor;

  const simRef = useRef<SimState>({
    phase: isAutostart ? 'playing' : 'title',
    karts: createStartingGrid(track, 'red'),
    itemBoxes: createInitialItemBoxes(track),
    coins: createInitialCoins(track),
    bananas: [],
    rockets: [],
    raceTime: 0,
    countdownTimer: 0,
    lastCountdownDigit: -1,
    goDisplayTimer: 0,
    calloutText: null,
    calloutTimer: 0,
    hitstopTimer: 0,
    timeNow: 0,
  });

  useEffect(() => {
    document.body.dataset.state = gameState;
    simRef.current.phase = gameState;
  }, [gameState]);

  const buildHudFromSim = useCallback((sim: SimState): HudSnapshot => {
    const player = sim.karts.find((k) => k.isPlayer) || sim.karts[0];
    const countdownValue =
      sim.countdownTimer > 0
        ? Math.ceil(sim.countdownTimer / 0.6)
        : sim.goDisplayTimer > 0
        ? 0
        : -1;

    return {
      rank: player.rank,
      totalKarts: sim.karts.length,
      lap: Math.min(player.lap, TOTAL_LAPS),
      totalLaps: TOTAL_LAPS,
      speedKmh: Math.round((Math.abs(player.speed) / BASE_MAX_SPEED) * 120),
      raceTime: sim.raceTime,
      coins: player.coins,
      heldItem: player.heldItem,
      driftChargeRatio: player.isDrifting
        ? Math.min(1, player.driftTimer / DRIFT_CHARGE_TARGET)
        : 0,
      driftReady: player.driftReady,
      isBoosted:
        player.turboItemTimer > 0 ||
        player.miniTurboTimer > 0 ||
        player.boostPadTimer > 0,
      countdownValue,
      calloutText: sim.calloutTimer > 0 ? sim.calloutText : null,
      kartDots: sim.karts.map((k) => ({
        id: k.id,
        x: k.x,
        y: k.y,
        color: k.preset.primaryColor,
        isPlayer: k.isPlayer,
      })),
    };
  }, []);

  const syncDiscreteHud = useCallback(
    (sim: SimState, force = false): HudSnapshot => {
      const snapshot = buildHudFromSim(sim);
      const nextDiscrete = extractDiscreteHudState(snapshot);
      if (force || hasDiscreteHudChanged(lastDiscreteHudRef.current, nextDiscrete)) {
        lastDiscreteHudRef.current = nextDiscrete;
        setHud(snapshot);
      }
      return snapshot;
    },
    [buildHudFromSim]
  );

  const resetRaceSimulation = useCallback(
    (colorId: KartColorId, skipCountdown: boolean) => {
      const karts = createStartingGrid(track, colorId);
      const itemBoxes = createInitialItemBoxes(track);
      const coins = createInitialCoins(track);

      simRef.current = {
        phase: 'playing',
        karts,
        itemBoxes,
        coins,
        bananas: [],
        rockets: [],
        raceTime: 0,
        countdownTimer: skipCountdown ? 0 : 1.8,
        lastCountdownDigit: skipCountdown ? 0 : 3,
        goDisplayTimer: skipCountdown ? 0.7 : 0,
        calloutText: null,
        calloutTimer: 0,
        hitstopTimer: 0,
        timeNow: 0,
      };

      const player = karts.find((k) => k.isPlayer) || karts[0];
      threeSceneRef.current?.resetCamera(player);
      keysHeldRef.current.clear();
      useItemPressedRef.current = false;
      syncDiscreteHud(simRef.current, true);
    },
    [track, syncDiscreteHud]
  );

  const startRace = useCallback(
    (skipCountdown = false) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      kartAudio.startEngine();
      kartAudio.playCountdownTick(skipCountdown);
      resetRaceSimulation(selectedColorRef.current, skipCountdown);
      document.body.dataset.state = 'playing';
      setGameState('playing');
      threeSceneRef.current?.getCanvasElement().focus();
    },
    [resetRaceSimulation]
  );

  const handlePause = useCallback(() => {
    if (simRef.current.phase !== 'playing') return;
    keysHeldRef.current.clear();
    kartAudio.stopEngine();
    document.body.dataset.state = 'paused';
    setGameState('paused');
  }, []);

  const handleResume = useCallback(() => {
    if (simRef.current.phase !== 'paused') return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    kartAudio.startEngine();
    document.body.dataset.state = 'playing';
    setGameState('playing');
    threeSceneRef.current?.getCanvasElement().focus();
  }, []);

  const handleBackToTitle = useCallback(() => {
    keysHeldRef.current.clear();
    useItemPressedRef.current = false;
    kartAudio.stopEngine();
    const karts = createStartingGrid(track, selectedColorRef.current);
    simRef.current.phase = 'title';
    simRef.current.karts = karts;
    simRef.current.itemBoxes = createInitialItemBoxes(track);
    simRef.current.coins = createInitialCoins(track);
    simRef.current.bananas = [];
    simRef.current.rockets = [];
    syncDiscreteHud(simRef.current, true);
    document.body.dataset.state = 'title';
    setGameState('title');
  }, [track, syncDiscreteHud]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = kartAudio.toggleMute();
    setMuted(nextMuted);
  }, []);

  useEffect(() => {
    if (isAutostart) {
      resetRaceSimulation(selectedColorRef.current, true);
    }
  }, [isAutostart, resetRaceSimulation]);

  // Global keyboard & focus-loss handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const phase = simRef.current.phase;

      if (phase === 'title') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          startRace(false);
        }
        return;
      }

      if (code === 'KeyM') {
        handleToggleMute();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        if (phase === 'playing') handlePause();
        else if (phase === 'paused') handleResume();
        return;
      }

      if (code === 'KeyR' && (phase === 'playing' || phase === 'paused')) {
        e.preventDefault();
        startRace(false);
        return;
      }

      if (phase === 'playing') {
        if (
          code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight' ||
          code === 'Space'
        ) {
          e.preventDefault();
        }
        if ((code === 'KeyE' || code === 'Enter') && !e.repeat) {
          useItemPressedRef.current = true;
        }
        keysHeldRef.current.add(code);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearInputs = () => {
      keysHeldRef.current.clear();
      useItemPressedRef.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, [startRace, handlePause, handleResume, handleToggleMute]);

  // Isolated 3D WebGL Scene + Simulation Loop (mounted once)
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const threeScene = new KartThreeScene(mount, track);
    threeSceneRef.current = threeScene;

    const syncSize = () => {
      const rect = mount.getBoundingClientRect();
      threeScene.resize(
        rect.width || window.innerWidth,
        rect.height || window.innerHeight
      );
    };
    syncSize();
    {
      const initSim = simRef.current;
      const initFocus =
        initSim.phase === 'title'
          ? initSim.karts[0]
          : initSim.karts.find((k) => k.isPlayer) || initSim.karts[0];
      threeScene.syncAndRender(
        initSim.karts,
        initSim.itemBoxes,
        initSim.coins,
        initSim.bananas,
        initSim.rockets,
        initFocus,
        initSim.timeNow,
        0,
        initSim.phase === 'title'
      );
    }
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', syncSize);

    let frameId = 0;
    let isCancelled = false;
    let lastTimestamp = performance.now();
    let liveHudAccum = 0;
    let lastSpeedSent = -1;
    let lastTimeSent = -1;
    let lastDriftSent = -1;
    let lastPhase: GameState = simRef.current.phase;
    let needsStaticRender = true;

    const afterDraw = (cb: () => void) => {
      const gl = threeScene.renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (isCancelled) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const stepSimulation = (sim: SimState, dt: number) => {
      if (sim.phase === 'title') {
        const events = createEmptyStepEvents();
        const inputs: Record<string, KartInput> = {};
        for (const k of sim.karts) {
          inputs[k.id] = computeAiInput(k, sim.karts, sim.bananas, track, dt);
          stepKartPhysics(k, inputs[k.id], track, dt, events);
        }
        stepItemsAndTrackObjects(
          sim.karts,
          inputs,
          sim.itemBoxes,
          sim.bananas,
          sim.rockets,
          track,
          dt,
          events,
          Math.random,
          sim.coins
        );
        return;
      }

      if (sim.phase !== 'playing') return;

      if (sim.countdownTimer > 0) {
        useItemPressedRef.current = false;
        sim.countdownTimer = Math.max(0, sim.countdownTimer - dt);
        const digit = Math.ceil(sim.countdownTimer / 0.6);
        if (sim.countdownTimer <= 0) {
          sim.goDisplayTimer = 0.75;
          kartAudio.playCountdownTick(true);
          syncDiscreteHud(sim, true);
        } else if (digit !== sim.lastCountdownDigit) {
          sim.lastCountdownDigit = digit;
          kartAudio.playCountdownTick(false);
          syncDiscreteHud(sim, true);
        }
        return;
      }

      if (sim.goDisplayTimer > 0) sim.goDisplayTimer = Math.max(0, sim.goDisplayTimer - dt);
      if (sim.calloutTimer > 0) sim.calloutTimer = Math.max(0, sim.calloutTimer - dt);

      if (sim.hitstopTimer > 0) {
        useItemPressedRef.current = false;
        sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        return;
      }

      sim.raceTime += dt;
      const held = keysHeldRef.current;
      const playerInput: KartInput = {
        accelerate: held.has('KeyW') || held.has('ArrowUp'),
        brake: held.has('KeyS') || held.has('ArrowDown'),
        steerLeft: held.has('KeyA') || held.has('ArrowLeft'),
        steerRight: held.has('KeyD') || held.has('ArrowRight'),
        drift:
          held.has('Space') ||
          held.has('ShiftLeft') ||
          held.has('ShiftRight'),
        useItem: useItemPressedRef.current,
      };
      useItemPressedRef.current = false;

      const events = createEmptyStepEvents();
      const inputs: Record<string, KartInput> = {};

      for (const k of sim.karts) {
        const input = k.isPlayer
          ? k.finished
            ? computeAiInput(k, sim.karts, sim.bananas, track, dt)
            : playerInput
          : computeAiInput(k, sim.karts, sim.bananas, track, dt);
        inputs[k.id] = input;
        stepKartPhysics(k, input, track, dt, events);
        updateLapAndCheckpoints(k, track, sim.raceTime, events);
      }

      stepItemsAndTrackObjects(
        sim.karts,
        inputs,
        sim.itemBoxes,
        sim.bananas,
        sim.rockets,
        track,
        dt,
        events,
        Math.random,
        sim.coins
      );
      computeRankings(sim.karts);

      // Process audio & 3D burst particles
      for (const ev of events.miniTurboTriggered) {
        if (ev.isPlayer) kartAudio.playBoost();
        const k = sim.karts.find((x) => x.id === ev.kartId);
        if (k) threeScene.spawnBurstWorld(k.x, k.y, 14, ['#FB923C', '#FACC15', '#FFFFFF'], 16);
      }
      for (const ev of events.boostPadTriggered) {
        if (ev.isPlayer) kartAudio.playBoost();
      }
      for (const ev of events.itemPickedUp) {
        if (ev.isPlayer) kartAudio.playItemPickup();
      }
      for (const ev of events.coinPickedUp) {
        if (ev.isPlayer) kartAudio.playCoinPickup();
        threeScene.spawnBurstWorld(ev.x, ev.y, 8, ['#FACC15', '#FEF08A'], 10);
      }
      for (const ev of events.itemUsed) {
        if (ev.isPlayer) {
          if (ev.item === 'turbo') kartAudio.playBoost();
          else if (ev.item === 'banana') kartAudio.playBananaDrop();
          else if (ev.item === 'rocket') kartAudio.playRocketLaunch();
        }
      }
      for (const ev of events.kartSpinout) {
        if (ev.cause === 'rocket') {
          threeScene.spawnBurstWorld(ev.x, ev.y, 26, ['#EF4444', '#F97316', '#FACC15', '#FFFFFF'], 22);
          threeScene.addTrauma(ev.isPlayer ? 0.7 : 0.35);
          sim.hitstopTimer = 0.045;
        } else {
          threeScene.spawnBurstWorld(ev.x, ev.y, 12, ['#FACC15', '#FEF08A'], 14);
          if (ev.isPlayer) threeScene.addTrauma(0.38);
        }
        if (ev.isPlayer) kartAudio.playSpinout();
      }
      for (const bump of events.kartBump) {
        if (bump.intensity > 0.2) {
          kartAudio.playBump(bump.intensity);
          threeScene.spawnBurstWorld(bump.x, bump.y, 6, ['#FACC15', '#FFFFFF'], 9);
        }
      }

      let playerFinishedNow = false;
      for (const lapEv of events.lapCompleted) {
        if (lapEv.isPlayer) {
          kartAudio.playLapComplete(lapEv.finished);
          if (lapEv.finished) {
            playerFinishedNow = true;
          } else {
            sim.calloutText =
              lapEv.newLap === TOTAL_LAPS ? 'FINAL LAP!' : `LAP ${lapEv.newLap}`;
            sim.calloutTimer = 1.6;
          }
        }
      }

      const player = sim.karts.find((k) => k.isPlayer) || sim.karts[0];
      const playerBoosted =
        player.turboItemTimer > 0 ||
        player.miniTurboTimer > 0 ||
        player.boostPadTimer > 0;
      kartAudio.updateEngine(player.speed / BASE_MAX_SPEED, playerBoosted, true);

      if (playerFinishedNow) {
        const finalSorted = [...sim.karts].sort((a, b) => {
          if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
          if (a.finished) return -1;
          if (b.finished) return 1;
          return b.totalProgress - a.totalProgress;
        });

        const builtStandings: RaceStandingsEntry[] = finalSorted.map((k, idx) => {
          const remainingLaps = Math.max(0.02, TOTAL_LAPS - k.totalProgress);
          const estTime =
            k.finishTime !== null
              ? k.finishTime
              : sim.raceTime + remainingLaps * 18.5;
          return {
            id: k.id,
            name: k.preset.name,
            driverName: k.preset.driverName,
            colorId: k.preset.id,
            primaryColor: k.preset.primaryColor,
            isPlayer: k.isPlayer,
            rank: idx + 1,
            finishTime: estTime,
            bestLapTime: k.bestLapTime,
          };
        });

        sim.phase = 'gameover';
        document.body.dataset.state = 'gameover';
        kartAudio.stopEngine();
        setStandings(builtStandings);
        setGameState('gameover');
      }
    };

    const scheduleNext = () => {
      if (isCancelled) return;
      if (threeScene.isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (isCancelled) return;
      const now = performance.now();
      const rawDt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), threeScene.isSoftwareGl ? 0.1 : 0.05);

      const sim = simRef.current;
      if (sim.phase !== lastPhase) {
        lastPhase = sim.phase;
        needsStaticRender = true;
      }

      if (sim.phase === 'paused' || sim.phase === 'gameover') {
        if (needsStaticRender) {
          needsStaticRender = false;
          const focusKart = sim.karts.find((k) => k.isPlayer) || sim.karts[0];
          threeScene.syncAndRender(
            sim.karts,
            sim.itemBoxes,
            sim.coins,
            sim.bananas,
            sim.rockets,
            focusKart,
            sim.timeNow,
            0,
            false
          );
        }
        frameId = window.setTimeout(tick, 140);
        return;
      }

      sim.timeNow += dt;

      // Substep simulation when dt > 0.03s (keeps drift & collision physics rock-solid on software WebGL)
      const substeps = dt > 0.03 ? Math.ceil(dt / 0.025) : 1;
      const subDt = dt / substeps;
      for (let s = 0; s < substeps; s++) {
        stepSimulation(sim, subDt);
      }

      if (sim.phase === 'playing') {
        liveHudAccum += dt;
        const snapshot = syncDiscreteHud(sim, false);
        if (liveHudAccum >= 0.08 && sim.countdownTimer <= 0) {
          liveHudAccum = 0;
          const timeTenths = Math.floor(snapshot.raceTime * 10);
          const driftPct = Math.round(snapshot.driftChargeRatio * 100);
          if (
            snapshot.speedKmh !== lastSpeedSent ||
            timeTenths !== lastTimeSent ||
            driftPct !== lastDriftSent
          ) {
            lastSpeedSent = snapshot.speedKmh;
            lastTimeSent = timeTenths;
            lastDriftSent = driftPct;
            hudHandleRef.current?.updateLiveValues({
              speedKmh: snapshot.speedKmh,
              raceTime: snapshot.raceTime,
              driftChargeRatio: snapshot.driftChargeRatio,
              driftReady: snapshot.driftReady,
              kartDots: snapshot.kartDots,
            });
          }
        }
      }

      const focusKart =
        sim.phase === 'title'
          ? sim.karts[0]
          : sim.karts.find((k) => k.isPlayer) || sim.karts[0];

      threeScene.syncAndRender(
        sim.karts,
        sim.itemBoxes,
        sim.coins,
        sim.bananas,
        sim.rockets,
        focusKart,
        sim.timeNow,
        dt,
        sim.phase === 'title'
      );

      scheduleNext();
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncSize);
      kartAudio.stopEngine();
      threeScene.dispose();
      threeSceneRef.current = null;
    };
  }, [track, syncDiscreteHud]);

  const handleTouchKey = useCallback((code: string, pressed: boolean) => {
    if (pressed) keysHeldRef.current.add(code);
    else keysHeldRef.current.delete(code);
  }, []);

  const handleTouchUseItem = useCallback(() => {
    useItemPressedRef.current = true;
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#1b2d1b]">
      {/* Isolated Full-Bleed 3D WebGL Mount Container */}
      <div
        ref={canvasMountRef}
        data-testid="game-canvas"
        className="w-full h-full"
      />

      {gameState === 'title' && (
        <TitleOverlay
          selectedColor={selectedColor}
          onSelectColor={(color) => {
            setSelectedColor(color);
            simRef.current.karts = createStartingGrid(track, color);
          }}
          onStartRace={() => startRace(false)}
        />
      )}

      {(gameState === 'playing' || gameState === 'paused') && (
        <RaceHud
          hud={hud}
          track={track}
          muted={muted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onRestart={() => startRace(false)}
          onTouchKey={handleTouchKey}
          onTouchUseItem={handleTouchUseItem}
          hudRef={hudHandleRef}
        />
      )}

      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={() => startRace(false)}
          onBackToTitle={handleBackToTitle}
        />
      )}

      {gameState === 'gameover' && (
        <FinishModal
          standings={standings}
          onPlayAgain={() => startRace(false)}
          onChangeKart={handleBackToTitle}
        />
      )}
    </main>
  );
}
