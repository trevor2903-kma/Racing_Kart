import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  buildEnvironment3D,
  buildTrack3DGeometry,
  createBanana3D,
  createCoin3D,
  createItemBox3D,
  createKartAndDriverModel,
  createRedShell3D,
  createThreeTexturePack,
  Kart3DRig,
  ThreeTexturePack,
  WORLD_SCALE,
} from './threeAssets';
import {
  HazardBanana,
  ItemBox,
  KartState,
  ProjectileRocket,
  TrackCoin,
  TrackData,
} from './types';

interface SparkParticle3D {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  scale: number;
}

const SPARK_POOL_SIZE = 180;
const _dummy = new THREE.Object3D();
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _colorTmp = new THREE.Color();

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class KartThreeScene {
  public readonly isSoftwareGl: boolean;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;

  private textures: ThreeTexturePack;
  private skyDome: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;
  private flagMesh: THREE.Mesh;

  private kartRigs = new Map<string, Kart3DRig>();
  private itemBoxMeshes = new Map<string, THREE.Group>();
  private coinMeshes = new Map<string, THREE.Group>();
  private bananaMeshes = new Map<string, THREE.Group>();
  private rocketMeshes = new Map<string, THREE.Group>();

  private sparkInstanced: THREE.InstancedMesh;
  private sparks: SparkParticle3D[] = [];
  private sparkHead = 0;

  private camX = 0;
  private camZ = 0;
  private camAngle = 0;
  private camInitialized = false;
  private shakeTrauma = 0;
  private disposed = false;

  constructor(container: HTMLElement, private track: TrackData) {
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.outline = 'none';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Turbo Kart GP 3D race canvas');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#FDE68A');
    // Match fog softly to Image 1's sunny golden horizon while keeping green hills vibrant
    this.scene.fog = new THREE.Fog('#FDE68A', 250, 620);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.4, 800);

    // Studio Environment Reflection for metallic gold exhausts, coins & clearcoat paint
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createThreeTexturePack(maxAnisotropy);

    // Sky Dome (warm sunny sky blue -> golden yellow horizon)
    const skyGeo = new THREE.SphereGeometry(640, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.textures.skyDome,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.position.set(
      track.worldWidth * 0.5 * WORLD_SCALE,
      0,
      track.worldHeight * 0.5 * WORLD_SCALE
    );
    this.scene.add(this.skyDome);

    // Warm Sun + Cool Sky Hemisphere Fill (3-point outdoor lighting)
    const hemi = new THREE.HemisphereLight('#BAE6FD', '#4D7C0F', 0.85);
    hemi.position.set(0, 60, 0);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight('#FFFBEB', 1.65);
    this.sunLight.position.set(45, 72, 35);
    if (!this.isSoftwareGl) {
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      const d = 58;
      this.sunLight.shadow.camera.left = -d;
      this.sunLight.shadow.camera.right = d;
      this.sunLight.shadow.camera.top = d;
      this.sunLight.shadow.camera.bottom = -d;
      this.sunLight.shadow.camera.near = 5;
      this.sunLight.shadow.camera.far = 175;
      this.sunLight.shadow.bias = -0.0005;
      this.sunLight.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const rimLight = new THREE.DirectionalLight('#93C5FD', 0.42);
    rimLight.position.set(-40, 25, -45);
    this.scene.add(rimLight);

    // Build 3D Track, FINISH Gantry, Barrier Blocks & Rolling Hills Environment
    const trackBuilt = buildTrack3DGeometry(track, this.textures);
    this.flagMesh = trackBuilt.flagMesh;
    this.scene.add(trackBuilt.group);
    this.scene.add(buildEnvironment3D(track));

    // Pooled 3D Spark / Particle InstancedMesh (for drift sparks & explosions)
    const sparkGeo = new THREE.OctahedronGeometry(0.24, 0);
    const sparkMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    this.sparkInstanced = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_POOL_SIZE);
    this.sparkInstanced.frustumCulled = false;
    this.sparkInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        color: new THREE.Color('#38BDF8'),
        scale: 1,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
      this.sparkInstanced.setColorAt(i, _colorTmp.set('#38BDF8'));
    }
    this.sparkInstanced.instanceMatrix.needsUpdate = true;
    if (this.sparkInstanced.instanceColor) this.sparkInstanced.instanceColor.needsUpdate = true;
    this.scene.add(this.sparkInstanced);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  public getCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  public resize(width: number, height: number): void {
    if (this.disposed) return;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.camInitialized) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public resetCamera(focusKart: KartState): void {
    this.camX = focusKart.x * WORLD_SCALE;
    this.camZ = focusKart.y * WORLD_SCALE;
    this.camAngle = focusKart.angle;
    this.camInitialized = true;
    this.shakeTrauma = 0;
    for (const s of this.sparks) s.active = false;
  }

  public addTrauma(amount: number): void {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  public spawnSpark(
    wx: number,
    wy: number,
    wz: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: string,
    scale = 1,
    maxLife = 0.35
  ): void {
    const s = this.sparks[this.sparkHead];
    this.sparkHead = (this.sparkHead + 1) % SPARK_POOL_SIZE;
    s.active = true;
    s.x = wx;
    s.y = wy;
    s.z = wz;
    s.vx = vx;
    s.vy = vy;
    s.vz = vz;
    s.life = maxLife;
    s.maxLife = maxLife;
    s.color.set(colorHex);
    s.scale = scale;
  }

  public spawnBurstWorld(simX: number, simY: number, count: number, colors: string[], speed = 12): void {
    const wx = simX * WORLD_SCALE;
    const wz = simY * WORLD_SCALE;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.spawnSpark(
        wx,
        0.9,
        wz,
        Math.cos(a) * sp,
        3.5 + Math.random() * 6,
        Math.sin(a) * sp,
        colors[i % colors.length],
        1.1 + Math.random() * 0.7,
        0.35 + Math.random() * 0.25
      );
    }
  }

  public syncAndRender(
    karts: KartState[],
    itemBoxes: ItemBox[],
    coins: TrackCoin[],
    bananas: HazardBanana[],
    rockets: ProjectileRocket[],
    focusKart: KartState,
    timeNow: number,
    dt: number,
    isTitleMode: boolean
  ): void {
    if (this.disposed) return;

    // 1. Wave checkered flag gently
    this.flagMesh.rotation.y = Math.sin(timeNow * 4.5) * 0.22;

    // 2. Sync Karts (create rig lazily or rebuild if preset color changed)
    const activeKartIds = new Set<string>();
    for (const k of karts) {
      activeKartIds.add(k.id);
      let rig = this.kartRigs.get(k.id);
      if (rig && rig.root.userData.colorId !== k.preset.id) {
        this.scene.remove(rig.root);
        rig = undefined;
      }
      if (!rig) {
        rig = createKartAndDriverModel(k.preset, this.textures.contactShadow);
        rig.root.userData.colorId = k.preset.id;
        this.scene.add(rig.root);
        this.kartRigs.set(k.id, rig);
      }

      const wx = k.x * WORLD_SCALE;
      const wz = k.y * WORLD_SCALE;
      rig.root.position.set(wx, 0, wz);
      rig.root.rotation.y = Math.PI / 2 - (k.angle + k.spinoutAngleOffset);

      // Visual front-wheel steering & turn lean + drift kickout angle
      const driftBodyYaw = k.isDrifting ? -k.driftDir * 0.24 : 0;
      const leanRoll = -k.steerAngle * 0.08 - (k.isDrifting ? k.driftDir * 0.09 : 0);
      rig.bodyTiltGroup.rotation.y = driftBodyYaw;
      rig.bodyTiltGroup.rotation.z = leanRoll;
      rig.driverGroup.rotation.z = -k.steerAngle * 0.14;

      for (const pivot of rig.frontWheelPivots) {
        pivot.rotation.y = -k.steerAngle * 0.42;
      }
      const wheelSpin = (k.speed * WORLD_SCALE * dt) / 0.45;
      for (const w of rig.wheels) {
        w.rotation.x += wheelSpin;
      }

      const boosted = k.turboItemTimer > 0 || k.miniTurboTimer > 0 || k.boostPadTimer > 0;
      rig.flameL.visible = boosted;
      rig.flameR.visible = boosted;
      if (boosted) {
        const pulse = 0.85 + Math.sin(timeNow * 38) * 0.25;
        rig.flameL.scale.set(1, 1, pulse);
        rig.flameR.scale.set(1, 1, pulse);
      }

      // Hit flash feedback
      const flash = k.hitFlashTimer > 0 && Math.floor(k.hitFlashTimer * 24) % 2 === 0;
      for (const mat of rig.chassisMaterials) {
        mat.emissive.setHex(flash ? 0xffffff : 0x000000);
        mat.emissiveIntensity = flash ? 0.6 : 0;
      }

      // Drift Sparks behind rear tires (Image 1 signature cyan/blue -> orange sparks!)
      if (k.isDrifting && k.speed > 115 && dt > 0) {
        const totalYaw = Math.PI / 2 - k.angle + driftBodyYaw;
        const sinY = Math.sin(totalYaw);
        const cosY = Math.cos(totalYaw);
        const sparkColor = k.driftReady ? '#FB923C' : '#38BDF8';
        for (const side of [-1.06, 1.06]) {
          // Transform local rear wheel offset (side, 0.35, -0.95) into world XZ
          const lx = side;
          const lz = -0.95;
          const rx = wx + lx * cosY + lz * sinY;
          const rz = wz - lx * sinY + lz * cosY;
          this.spawnSpark(
            rx,
            0.35,
            rz,
            (Math.random() - 0.5) * 4.5 - sinY * 4.0,
            2.2 + Math.random() * 3.5,
            (Math.random() - 0.5) * 4.5 - cosY * 4.0,
            sparkColor,
            k.driftReady ? 1.25 : 0.95,
            0.24
          );
        }
      }
    }

    // 3. Sync Item Boxes
    for (const box of itemBoxes) {
      let mesh = this.itemBoxMeshes.get(box.id);
      if (!mesh) {
        mesh = createItemBox3D(this.textures.itemBox, this.textures.contactShadow);
        mesh.position.set(box.x * WORLD_SCALE, 0, box.y * WORLD_SCALE);
        this.scene.add(mesh);
        this.itemBoxMeshes.set(box.id, mesh);
      }
      mesh.visible = box.active;
      if (box.active) {
        const core = mesh.getObjectByName('spinCore');
        if (core) {
          core.rotation.y = timeNow * 2.1 + box.phase;
          core.position.y = 1.65 + Math.sin(timeNow * 3.2 + box.phase) * 0.25;
        }
      }
    }

    // 4. Sync Gold Coins
    for (const coin of coins) {
      let mesh = this.coinMeshes.get(coin.id);
      if (!mesh) {
        mesh = createCoin3D(this.textures.contactShadow);
        mesh.position.set(coin.x * WORLD_SCALE, 0, coin.y * WORLD_SCALE);
        this.scene.add(mesh);
        this.coinMeshes.set(coin.id, mesh);
      }
      mesh.visible = coin.active;
      if (coin.active) {
        const core = mesh.getObjectByName('spinCore');
        if (core) {
          core.rotation.y = timeNow * 3.4 + coin.phase;
          core.position.y = 1.45 + Math.sin(timeNow * 3.8 + coin.phase) * 0.2;
        }
      }
    }

    // 5. Sync Bananas
    const activeBananaIds = new Set<string>();
    for (const b of bananas) {
      activeBananaIds.add(b.id);
      let mesh = this.bananaMeshes.get(b.id);
      if (!mesh) {
        mesh = createBanana3D(this.textures.contactShadow);
        this.scene.add(mesh);
        this.bananaMeshes.set(b.id, mesh);
      }
      mesh.position.set(b.x * WORLD_SCALE, 0, b.y * WORLD_SCALE);
    }
    for (const [id, mesh] of this.bananaMeshes.entries()) {
      if (!activeBananaIds.has(id)) {
        this.scene.remove(mesh);
        this.bananaMeshes.delete(id);
      }
    }

    // 6. Sync Homing Red Shells / Rockets
    const activeRocketIds = new Set<string>();
    for (const r of rockets) {
      activeRocketIds.add(r.id);
      let mesh = this.rocketMeshes.get(r.id);
      if (!mesh) {
        mesh = createRedShell3D(this.textures.contactShadow);
        this.scene.add(mesh);
        this.rocketMeshes.set(r.id, mesh);
      }
      mesh.position.set(r.x * WORLD_SCALE, 0, r.y * WORLD_SCALE);
      const core = mesh.getObjectByName('spinCore');
      if (core) core.rotation.y = timeNow * 14;
    }
    for (const [id, mesh] of this.rocketMeshes.entries()) {
      if (!activeRocketIds.has(id)) {
        this.scene.remove(mesh);
        this.rocketMeshes.delete(id);
      }
    }

    // 7. Update Pooled 3D Sparks & Burst Particles
    if (this.shakeTrauma > 0) {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.4);
    }
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const s = this.sparks[i];
      if (!s.active) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 14 * dt;
      if (s.y < 0.15) {
        s.y = 0.15;
        s.vy *= -0.35;
      }
      const ratio = s.life / s.maxLife;
      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(timeNow * 8 + i, timeNow * 6, 0);
      _dummy.scale.setScalar(s.scale * ratio);
      _dummy.updateMatrix();
      this.sparkInstanced.setMatrixAt(i, _dummy.matrix);
      this.sparkInstanced.setColorAt(i, s.color);
    }
    this.sparkInstanced.instanceMatrix.needsUpdate = true;
    if (this.sparkInstanced.instanceColor) this.sparkInstanced.instanceColor.needsUpdate = true;

    // 8. Smooth Behind-the-Kart 3D Chase Camera (Image 1 perspective!)
    const targetX = focusKart.x * WORLD_SCALE;
    const targetZ = focusKart.y * WORLD_SCALE;
    const targetAngle = focusKart.angle;

    if (!this.camInitialized) {
      this.camX = targetX;
      this.camZ = targetZ;
      this.camAngle = targetAngle;
      this.camInitialized = true;
    } else {
      const posBlend = dt === 0 ? 1 : 1 - Math.exp(-14 * dt);
      const rotBlend = dt === 0 ? 1 : 1 - Math.exp(-10 * dt);
      this.camX += (targetX - this.camX) * posBlend;
      this.camZ += (targetZ - this.camZ) * posBlend;
      let diff = targetAngle - this.camAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.camAngle += diff * rotBlend;
    }

    const focusBoosted =
      focusKart.turboItemTimer > 0 ||
      focusKart.miniTurboTimer > 0 ||
      focusKart.boostPadTimer > 0;
    const targetFov = isTitleMode ? 54 : focusBoosted ? 68 : 60;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * (dt === 0 ? 1 : Math.min(1, dt * 8));
      this.camera.updateProjectionMatrix();
    }

    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.55;
    const shakeX = (Math.random() * 2 - 1) * shakeMag;
    const shakeY = (Math.random() * 2 - 1) * shakeMag;

    if (isTitleMode) {
      // Dynamic scenic angle trailing the lead kart from slightly right/above so Title card on left stays clear
      const fx = Math.cos(this.camAngle);
      const fz = Math.sin(this.camAngle);
      const rx = -fz;
      const rz = fx;
      _vec3A.set(this.camX - fx * 9.5 + rx * 3.6, 4.2, this.camZ - fz * 9.5 + rz * 3.6);
      _vec3B.set(this.camX + fx * 11 - rx * 1.4, 1.3, this.camZ + fz * 11 - rz * 1.4);
    } else {
      // Exact Image 1 behind-the-kart chase camera
      const fx = Math.cos(this.camAngle);
      const fz = Math.sin(this.camAngle);
      const chaseDist = focusBoosted ? 7.2 : 6.4;
      _vec3A.set(this.camX - fx * chaseDist + shakeX, 2.85 + shakeY, this.camZ - fz * chaseDist);
      _vec3B.set(this.camX + fx * 13.5, 1.35, this.camZ + fz * 13.5);
    }

    this.camera.position.copy(_vec3A);
    this.camera.lookAt(_vec3B);

    // Keep shadow frustum & sky centered cleanly around active camera area
    if (!this.isSoftwareGl) {
      this.sunLight.position.set(this.camX + 35, 65, this.camZ + 28);
      this.sunLight.target.position.set(this.camX, 0, this.camZ);
    }
    this.skyDome.position.set(this.camX, -15, this.camZ);

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
