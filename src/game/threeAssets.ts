import * as THREE from 'three';
import { KartPreset, TrackData } from './types';

export const WORLD_SCALE = 0.1; // 10 sim px = 1 meter in 3D world

export interface Kart3DRig {
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  driverGroup: THREE.Group;
  frontWheelPivots: THREE.Group[];
  wheels: THREE.Mesh[];
  flameL: THREE.Mesh;
  flameR: THREE.Mesh;
  chassisMaterials: THREE.MeshPhysicalMaterial[];
}

export interface ThreeTexturePack {
  asphalt: THREE.CanvasTexture;
  curb: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  finishBanner: THREE.CanvasTexture;
  checkeredRoad: THREE.CanvasTexture;
  flag: THREE.CanvasTexture;
  itemBox: THREE.CanvasTexture;
  boostPad: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  skyDome: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createThreeTexturePack(maxAnisotropy: number): ThreeTexturePack {
  // 1. Smooth Satin Asphalt Road Texture (512x512, zero grazing-angle speckle aliasing)
  const [asphCanvas, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#505763';
  asphCtx.fillRect(0, 0, 512, 512);
  // Subtle smooth longitudinal racing grooves
  const grooveGrad = asphCtx.createLinearGradient(0, 0, 0, 512);
  grooveGrad.addColorStop(0, '#49505C');
  grooveGrad.addColorStop(0.18, '#535A67');
  grooveGrad.addColorStop(0.5, '#4E5561');
  grooveGrad.addColorStop(0.82, '#535A67');
  grooveGrad.addColorStop(1, '#49505C');
  asphCtx.fillStyle = grooveGrad;
  asphCtx.fillRect(0, 0, 512, 512);
  // Crisp white shoulder lines (Image 2 road asset)
  asphCtx.fillStyle = '#F1F5F9';
  asphCtx.fillRect(0, 14, 512, 16);
  asphCtx.fillRect(0, 482, 512, 16);
  // Clean dashed center line
  asphCtx.fillStyle = 'rgba(255,255,255,0.72)';
  asphCtx.fillRect(48, 250, 176, 12);
  asphCtx.fillRect(304, 250, 176, 12);
  const asphalt = finalizeColorTexture(asphCanvas, maxAnisotropy, 1, 1);
  asphalt.wrapS = THREE.RepeatWrapping;
  asphalt.wrapT = THREE.ClampToEdgeWrapping;

  // 2. Red & White / Orange & White Racing Curb Texture (matches Image 1)
  const [curbCanvas, curbCtx] = makeCanvas(128, 64);
  curbCtx.fillStyle = '#F8FAFC';
  curbCtx.fillRect(0, 0, 64, 64);
  curbCtx.fillStyle = '#EA4C2D';
  curbCtx.fillRect(64, 0, 64, 64);
  curbCtx.fillStyle = 'rgba(0,0,0,0.12)';
  curbCtx.fillRect(0, 54, 128, 10);
  const curb = finalizeColorTexture(curbCanvas, maxAnisotropy, 1, 1);
  curb.wrapS = THREE.RepeatWrapping;
  curb.wrapT = THREE.ClampToEdgeWrapping;

  // 3. Vibrant Mowed Grass Turf Texture (matches Images 1 & 2)
  const [grassCanvas, grassCtx] = makeCanvas(256, 256);
  grassCtx.fillStyle = '#58B63E';
  grassCtx.fillRect(0, 0, 256, 256);
  grassCtx.fillStyle = '#4CA633';
  grassCtx.fillRect(0, 0, 128, 256);
  grassCtx.fillStyle = 'rgba(255,255,255,0.035)';
  grassCtx.fillRect(0, 0, 256, 128);
  const grass = finalizeColorTexture(grassCanvas, maxAnisotropy, 44, 44);

  // 4. Warm Coastal Sand Shoulder Texture (matches Images 1 & 2)
  const [sandCanvas, sandCtx] = makeCanvas(128, 128);
  sandCtx.fillStyle = '#DFBC7D';
  sandCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    sandCtx.fillStyle = i % 2 === 0 ? 'rgba(255,245,215,0.22)' : 'rgba(155,115,60,0.12)';
    sandCtx.fillRect((i * 31) % 128, (i * 59) % 128, 3, 3);
  }
  const sand = finalizeColorTexture(sandCanvas, maxAnisotropy, 1, 1);
  sand.wrapS = THREE.RepeatWrapping;
  sand.wrapT = THREE.ClampToEdgeWrapping;

  // 5. FINISH Overhead Banner Texture (matches Images 1 & 2)
  const [banCanvas, banCtx] = makeCanvas(512, 128);
  const cell = 32;
  for (let x = 0; x < 512; x += cell) {
    for (let y = 0; y < 128; y += cell) {
      banCtx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#FFFFFF' : '#181C24';
      banCtx.fillRect(x, y, cell, cell);
    }
  }
  // Center vibrant plaque
  banCtx.fillStyle = '#E52521';
  banCtx.fillRect(96, 18, 320, 92);
  banCtx.strokeStyle = '#FACC15';
  banCtx.lineWidth = 6;
  banCtx.strokeRect(100, 22, 312, 84);
  banCtx.fillStyle = '#FFFFFF';
  banCtx.font = '900 54px Outfit, sans-serif';
  banCtx.textAlign = 'center';
  banCtx.textBaseline = 'middle';
  banCtx.strokeStyle = '#14181F';
  banCtx.lineWidth = 8;
  banCtx.strokeText('FINISH', 256, 66);
  banCtx.fillText('FINISH', 256, 66);
  const finishBanner = finalizeColorTexture(banCanvas, maxAnisotropy);

  // 6. Checkered Start/Finish Road Stripe
  const [chkCanvas, chkCtx] = makeCanvas(256, 64);
  for (let c = 0; c < 16; c++) {
    for (let r = 0; r < 4; r++) {
      chkCtx.fillStyle = (c + r) % 2 === 0 ? '#FFFFFF' : '#181C24';
      chkCtx.fillRect(c * 16, r * 16, 16, 16);
    }
  }
  const checkeredRoad = finalizeColorTexture(chkCanvas, maxAnisotropy);

  // 7. Waving Checkered Flag (Image 2)
  const [flagCanvas, flagCtx] = makeCanvas(128, 96);
  for (let c = 0; c < 8; c++) {
    for (let r = 0; r < 6; r++) {
      flagCtx.fillStyle = (c + r) % 2 === 0 ? '#FFFFFF' : '#14181F';
      flagCtx.fillRect(c * 16, r * 16, 16, 16);
    }
  }
  const flag = finalizeColorTexture(flagCanvas, maxAnisotropy);

  // 8. Item Box Crate Texture (matches Image 2 bottom-right white & red X box!)
  const [boxCanvas, boxCtx] = makeCanvas(128, 128);
  boxCtx.fillStyle = '#F8FAFC';
  boxCtx.fillRect(0, 0, 128, 128);
  boxCtx.strokeStyle = '#DC2626';
  boxCtx.lineWidth = 18;
  boxCtx.strokeRect(9, 9, 110, 110);
  // Crisp inner outline
  boxCtx.strokeStyle = '#14181F';
  boxCtx.lineWidth = 4;
  boxCtx.strokeRect(2, 2, 124, 124);
  // Bold red X / arcade mark
  boxCtx.strokeStyle = '#DC2626';
  boxCtx.lineWidth = 16;
  boxCtx.lineCap = 'round';
  boxCtx.beginPath();
  boxCtx.moveTo(36, 36);
  boxCtx.lineTo(92, 92);
  boxCtx.moveTo(92, 36);
  boxCtx.lineTo(36, 92);
  boxCtx.stroke();
  const itemBox = finalizeColorTexture(boxCanvas, maxAnisotropy);

  // 9. Boost Pad Chevron Texture
  const [padCanvas, padCtx] = makeCanvas(128, 256);
  padCtx.fillStyle = '#0F172A';
  padCtx.fillRect(0, 0, 128, 256);
  padCtx.strokeStyle = '#38BDF8';
  padCtx.lineWidth = 6;
  padCtx.strokeRect(4, 4, 120, 248);
  const chevColors = ['#38BDF8', '#FACC15', '#38BDF8'];
  for (let i = 0; i < 3; i++) {
    const cy = 54 + i * 74;
    padCtx.strokeStyle = chevColors[i];
    padCtx.lineWidth = 16;
    padCtx.lineCap = 'round';
    padCtx.lineJoin = 'round';
    padCtx.beginPath();
    padCtx.moveTo(22, cy + 28);
    padCtx.lineTo(64, cy - 16);
    padCtx.lineTo(106, cy + 28);
    padCtx.stroke();
  }
  const boostPad = finalizeColorTexture(padCanvas, maxAnisotropy);

  // 10. Soft Contact Shadow Texture
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(10, 16, 22, 0.58)');
  grad.addColorStop(0.55, 'rgba(10, 16, 22, 0.28)');
  grad.addColorStop(1, 'rgba(10, 16, 22, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  // 11. Warm Golden-Yellow Sky Gradient (matches Image 1 horizon atmosphere!)
  const [skyCanvas, skyCtx] = makeCanvas(32, 256);
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#7DD3FC');   // Bright crisp sky zenith
  skyGrad.addColorStop(0.35, '#FDE68A'); // Warm sunny mid-sky
  skyGrad.addColorStop(0.62, '#FEF08A'); // Golden-yellow horizon (Image 1)
  skyGrad.addColorStop(1, '#FDE047');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 32, 256);
  const skyDome = finalizeColorTexture(skyCanvas, maxAnisotropy);

  return {
    asphalt,
    curb,
    grass,
    sand,
    finishBanner,
    checkeredRoad,
    flag,
    itemBox,
    boostPad,
    contactShadow,
    skyDome,
    dispose: () => {
      asphalt.dispose();
      curb.dispose();
      grass.dispose();
      sand.dispose();
      finishBanner.dispose();
      checkeredRoad.dispose();
      flag.dispose();
      itemBox.dispose();
      boostPad.dispose();
      contactShadow.dispose();
      skyDome.dispose();
    },
  };
}

/**
 * Builds a stylized composite 3D Pipe-Frame Kart + Cap-Wearing Driver matching Images 1 & 2.
 * Local forward direction is +Z, up is +Y, bottom sits flush at Y = 0.
 */
export function createKartAndDriverModel(
  preset: KartPreset,
  shadowTex: THREE.CanvasTexture
): Kart3DRig {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  const chassisMaterials: THREE.MeshPhysicalMaterial[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: preset.primaryColor,
    roughness: 0.25,
    metalness: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15,
  });
  chassisMaterials.push(paintMat);

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: '#1E2530',
    roughness: 0.65,
    metalness: 0.35,
  });
  const goldEngineMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.22,
    metalness: 0.85,
  });
  const silverMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    roughness: 0.22,
    metalness: 0.8,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: '#181C24',
    roughness: 0.88,
    metalness: 0.05,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: preset.trimColor,
    roughness: 0.35,
    metalness: 0.05,
  });

  // 0. Ground contact shadow plane
  const shadowGeo = new THREE.PlaneGeometry(3.5, 4.4);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.06;
  root.add(shadowMesh);

  // 1. Floor pan & bucket seat
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 2.35), darkMetalMat);
  floorPan.position.set(0, 0.36, 0.05);
  floorPan.castShadow = true;
  floorPan.receiveShadow = true;
  bodyTiltGroup.add(floorPan);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.72, 0.22), darkMetalMat);
  seatBack.position.set(0, 0.78, -0.58);
  seatBack.rotation.x = -0.22;
  seatBack.castShadow = true;
  bodyTiltGroup.add(seatBack);

  // 2. Tubular Pipe-Frame Chassis (Image 1 & Image 2 signature curved red/blue/green/yellow pipes)
  const pipeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.74, 0.44, -0.92),
    new THREE.Vector3(-0.78, 0.44, 0.78),
    new THREE.Vector3(-0.55, 0.46, 1.48),
    new THREE.Vector3(0.0, 0.48, 1.62),
    new THREE.Vector3(0.55, 0.46, 1.48),
    new THREE.Vector3(0.78, 0.44, 0.78),
    new THREE.Vector3(0.74, 0.44, -0.92),
  ]);
  const pipeFrame = new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 32, 0.095, 10, false), paintMat);
  pipeFrame.castShadow = true;
  bodyTiltGroup.add(pipeFrame);

  // Rear bumper hoop (matches Image 1 rear pipe guard)
  const rearHoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.72, 0.44, -0.92),
    new THREE.Vector3(-0.58, 0.62, -1.24),
    new THREE.Vector3(0.58, 0.62, -1.24),
    new THREE.Vector3(0.72, 0.44, -0.92),
  ]);
  const rearHoop = new THREE.Mesh(new THREE.TubeGeometry(rearHoopCurve, 18, 0.085, 8, false), paintMat);
  rearHoop.castShadow = true;
  bodyTiltGroup.add(rearHoop);

  // Front nose cowl + number badge
  const noseCowl = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.32, 0.74), paintMat);
  noseCowl.position.set(0, 0.56, 1.04);
  noseCowl.rotation.x = 0.14;
  noseCowl.castShadow = true;
  bodyTiltGroup.add(noseCowl);

  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), whiteMat);
  badge.rotation.x = Math.PI / 2 - 0.14;
  badge.position.set(0, 0.68, 1.38);
  bodyTiltGroup.add(badge);

  // Steering column & wheel
  const steerCol = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.58, 8), darkMetalMat);
  steerCol.position.set(0, 0.84, 0.68);
  steerCol.rotation.x = -0.55;
  bodyTiltGroup.add(steerCol);

  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 8, 18), darkMetalMat);
  steerWheel.position.set(0, 1.06, 0.52);
  steerWheel.rotation.x = -0.35;
  bodyTiltGroup.add(steerWheel);

  // 3. Rear Engine Block + Golden Turbo Canister + Twin Exhausts (exact match to Image 1 & 2!)
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.48), darkMetalMat);
  engineBlock.position.set(0, 0.66, -0.88);
  engineBlock.castShadow = true;
  bodyTiltGroup.add(engineBlock);

  const turboCan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.72, 16), goldEngineMat);
  turboCan.rotation.z = Math.PI / 2;
  turboCan.position.set(0, 0.88, -0.98);
  turboCan.castShadow = true;
  bodyTiltGroup.add(turboCan);

  const exhaustGeo = new THREE.CylinderGeometry(0.095, 0.115, 0.54, 12);
  const exhaustL = new THREE.Mesh(exhaustGeo, darkMetalMat);
  exhaustL.position.set(-0.36, 0.92, -1.12);
  exhaustL.rotation.x = -Math.PI / 2 + 0.38;
  exhaustL.rotation.z = 0.12;
  exhaustL.castShadow = true;
  bodyTiltGroup.add(exhaustL);

  const exhaustR = new THREE.Mesh(exhaustGeo, darkMetalMat);
  exhaustR.position.set(0.36, 0.92, -1.12);
  exhaustR.rotation.x = -Math.PI / 2 + 0.38;
  exhaustR.rotation.z = -0.12;
  exhaustR.castShadow = true;
  bodyTiltGroup.add(exhaustR);

  // Boost exhaust flames (hidden unless boosting)
  const flameGeo = new THREE.ConeGeometry(0.14, 0.68, 10);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: '#38BDF8',
    transparent: true,
    opacity: 0.9,
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.4, 1.02, -1.52);
  flameL.visible = false;
  bodyTiltGroup.add(flameL);

  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.4, 1.02, -1.52);
  flameR.visible = false;
  bodyTiltGroup.add(flameR);

  // 4. Four Chunky Wheels (rear wider, front steerable)
  const wheels: THREE.Mesh[] = [];
  const frontWheelPivots: THREE.Group[] = [];

  const createWheel = (radius: number, width: number) => {
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;

    const rimGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.04, 14);
    rimGeo.rotateZ(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, silverMat);
    tire.add(rim);

    const hubGeo = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, width + 0.08, 10);
    hubGeo.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, goldEngineMat);
    tire.add(hub);
    return tire;
  };

  // Front wheels
  const frontPositions: Array<[number, number, number]> = [
    [-0.98, 0.42, 0.94],
    [0.98, 0.42, 0.94],
  ];
  for (const [wx, wy, wz] of frontPositions) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    const w = createWheel(0.42, 0.36);
    pivot.add(w);
    bodyTiltGroup.add(pivot);
    frontWheelPivots.push(pivot);
    wheels.push(w);
  }

  // Rear wheels (chunkier!)
  const rearPositions: Array<[number, number, number]> = [
    [-1.06, 0.5, -0.82],
    [1.06, 0.5, -0.82],
  ];
  for (const [wx, wy, wz] of rearPositions) {
    const w = createWheel(0.5, 0.48);
    w.position.set(wx, wy, wz);
    bodyTiltGroup.add(w);
    wheels.push(w);
  }

  // 5. Stylized Cap-Wearing Driver (matches Image 1 back view & Image 2 front/side/back views!)
  const driverGroup = new THREE.Group();
  driverGroup.position.set(0, 0.56, -0.2);
  bodyTiltGroup.add(driverGroup);

  const overallsMat = new THREE.MeshStandardMaterial({
    color: preset.id === 'red' ? '#1E54C7' : '#1E293B',
    roughness: 0.72,
    metalness: 0.05,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: preset.primaryColor,
    roughness: 0.68,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#F6C29D',
    roughness: 0.62,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: '#5C3317',
    roughness: 0.85,
  });
  const capMat = new THREE.MeshPhysicalMaterial({
    color: preset.helmetColor,
    roughness: 0.42,
    clearcoat: 0.25,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.6,
  });

  // Torso (overalls + shoulder straps)
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.28, 6, 12), overallsMat);
  torso.position.set(0, 0.44, 0);
  torso.castShadow = true;
  driverGroup.add(torso);

  // Arms reaching forward to steering wheel
  const armGeo = new THREE.CylinderGeometry(0.11, 0.1, 0.56, 8);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.34, 0.56, 0.28);
  armL.rotation.x = 1.05;
  armL.rotation.z = -0.35;
  driverGroup.add(armL);

  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.34, 0.56, 0.28);
  armR.rotation.x = 1.05;
  armR.rotation.z = 0.35;
  driverGroup.add(armR);

  const gloveGeo = new THREE.SphereGeometry(0.13, 10, 10);
  const gloveL = new THREE.Mesh(gloveGeo, gloveMat);
  gloveL.position.set(-0.2, 0.52, 0.58);
  driverGroup.add(gloveL);

  const gloveR = new THREE.Mesh(gloveGeo, gloveMat);
  gloveR.position.set(0.2, 0.52, 0.58);
  driverGroup.add(gloveR);

  // Driver Head + Hair back + Iconic Cap with visor (matches Image 1 rear profile!)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 14), skinMat);
  head.position.set(0, 0.98, 0.04);
  head.castShadow = true;
  driverGroup.add(head);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.45),
    hairMat
  );
  hairBack.position.set(0, 0.94, -0.04);
  driverGroup.add(hairBack);

  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 12), capMat);
  capCrown.scale.set(1.04, 0.85, 1.12);
  capCrown.position.set(0, 1.16, 0.0);
  capCrown.castShadow = true;
  driverGroup.add(capCrown);

  const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.41, 0.07, 16, 1, false, -1.0, 2.0), capMat);
  capBrim.position.set(0, 1.06, 0.24);
  capBrim.rotation.x = 0.12;
  driverGroup.add(capBrim);

  const capBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), whiteMat);
  capBadge.rotation.x = Math.PI / 2;
  capBadge.position.set(0, 1.2, 0.42);
  driverGroup.add(capBadge);

  return {
    root,
    bodyTiltGroup,
    driverGroup,
    frontWheelPivots,
    wheels,
    flameL,
    flameR,
    chassisMaterials,
  };
}

/**
 * Generates closed-loop ribbon geometry for road, sand shoulder, curbs, and trackside colored barrier blocks.
 */
export function buildTrack3DGeometry(
  track: TrackData,
  textures: ThreeTexturePack
): { group: THREE.Group; flagMesh: THREE.Mesh } {
  const group = new THREE.Group();
  const s = WORLD_SCALE;
  const roadHalf = track.roadWidth * 0.5 * s;

  // 1. Vast Ground Turf Plane extending to horizon fog
  const groundGeo = new THREE.PlaneGeometry(1600, 1600);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.95,
    metalness: 0.0,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.set(track.worldWidth * 0.5 * s, 0, track.worldHeight * 0.5 * s);
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Helper to build closed ribbon BufferGeometry along track samples
  const buildRibbon = (innerOffset: number, outerOffset: number, y: number, uScale: number) => {
    const samples = track.samples;
    const n = samples.length;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= n; i++) {
      const smp = samples[i % n];
      const cx = smp.x * s;
      const cz = smp.y * s;
      const nx = smp.nx;
      const nz = smp.ny;
      const u = (i === n ? track.totalLength * s : smp.s * s) * uScale;

      positions.push(cx + nx * innerOffset, y, cz + nz * innerOffset);
      positions.push(cx + nx * outerOffset, y, cz + nz * outerOffset);
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(u, 0, u, 1);
    }

    for (let i = 0; i < n; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  };

  // 2. Warm Coastal Sand Shoulder extending smoothly under barriers (y = 0.025)
  const sandMat = new THREE.MeshStandardMaterial({
    map: textures.sand,
    roughness: 0.92,
    metalness: 0.0,
  });
  const sandMesh = new THREE.Mesh(
    buildRibbon(-(roadHalf + 5.8), roadHalf + 5.8, 0.025, 0.04),
    sandMat
  );
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  // 3. Red & White Striped Curbs on both edges (y = 0.045)
  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curb,
    roughness: 0.72,
    metalness: 0.05,
  });
  const curbLeft = new THREE.Mesh(
    buildRibbon(-(roadHalf + 1.25), -roadHalf + 0.1, 0.045, 0.14),
    curbMat
  );
  curbLeft.receiveShadow = true;
  const curbRight = new THREE.Mesh(
    buildRibbon(roadHalf - 0.1, roadHalf + 1.25, 0.045, 0.14),
    curbMat
  );
  curbRight.receiveShadow = true;
  group.add(curbLeft, curbRight);

  // 4. Asphalt Road Surface (y = 0.065)
  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.78,
    metalness: 0.04,
  });
  const roadMesh = new THREE.Mesh(buildRibbon(-roadHalf, roadHalf, 0.065, 0.055), roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 5. Checkered Start/Finish Road Line + Overhead FINISH Gantry + Waving Flags (Images 1 & 2!)
  const startSmp = track.samples[track.startLineSampleIndex];
  const sx = startSmp.x * s;
  const sz = startSmp.y * s;
  const startAngle = Math.atan2(startSmp.tx, startSmp.ty);

  const startLineMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(roadHalf * 2, 3.8),
    new THREE.MeshStandardMaterial({
      map: textures.checkeredRoad,
      roughness: 0.68,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  startLineMesh.rotation.x = -Math.PI / 2;
  startLineMesh.rotation.z = startAngle;
  startLineMesh.position.set(sx, 0.085, sz);
  startLineMesh.receiveShadow = true;
  group.add(startLineMesh);

  // Overhead FINISH Gantry
  const gantry = new THREE.Group();
  gantry.position.set(sx, 0, sz);
  gantry.rotation.y = startAngle;

  const poleMat = new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.35, metalness: 0.4 });
  const poleTopMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.3, metalness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.32, 0.36, 7.6, 12);
  const poleOffset = roadHalf + 4.8;

  const poleL = new THREE.Mesh(poleGeo, poleMat);
  poleL.position.set(-poleOffset, 3.8, 0);
  poleL.castShadow = true;
  const poleR = new THREE.Mesh(poleGeo, poleMat);
  poleR.position.set(poleOffset, 3.8, 0);
  poleR.castShadow = true;

  const finialGeo = new THREE.SphereGeometry(0.48, 12, 10);
  const finL = new THREE.Mesh(finialGeo, poleTopMat);
  finL.position.set(-poleOffset, 7.8, 0);
  const finR = new THREE.Mesh(finialGeo, poleTopMat);
  finR.position.set(poleOffset, 7.8, 0);

  const bannerGeo = new THREE.BoxGeometry(poleOffset * 2 + 0.8, 2.35, 0.45);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: textures.finishBanner,
    roughness: 0.4,
    metalness: 0.08,
  });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 6.2, 0);
  banner.castShadow = true;
  gantry.add(poleL, poleR, finL, finR, banner);
  group.add(gantry);

  // Checkered Flag beside start line (matches Image 2!)
  const flagGroup = new THREE.Group();
  flagGroup.position.set(
    sx + startSmp.nx * (roadHalf + 4.4),
    0,
    sz + startSmp.ny * (roadHalf + 4.4)
  );
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.2, 8), poleMat);
  flagPole.position.y = 2.6;
  flagPole.castShadow = true;
  const flagGeo = new THREE.PlaneGeometry(2.6, 1.7, 8, 4);
  flagGeo.translate(1.3, 0, 0);
  const flagMesh = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({
      map: textures.flag,
      side: THREE.DoubleSide,
      roughness: 0.55,
    })
  );
  flagMesh.position.set(0, 4.2, 0);
  flagGroup.add(flagPole, flagMesh);
  group.add(flagGroup);

  // 6. Boost Pads along the track (y = 0.082) — arrows oriented forward along track tangent (+tx, +ty)
  const padMat = new THREE.MeshStandardMaterial({
    map: textures.boostPad,
    emissive: '#0EA5E9',
    emissiveIntensity: 0.35,
    roughness: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const padGeo = new THREE.PlaneGeometry(5.8, 9.6);
  for (const pad of track.boostPads) {
    const mesh = new THREE.Mesh(padGeo, padMat);
    mesh.rotation.x = -Math.PI / 2;
    const smp = track.samples[pad.sampleIndex];
    mesh.rotation.z = Math.atan2(-smp.tx, -smp.ty);
    mesh.position.set(pad.x * s, 0.082, pad.y * s);
    group.add(mesh);
  }

  // 7. Continuous Solid Colorful Mario-style Trackside Barrier Walls (Red, Blue, Orange, Green — Image 1 signature!)
  const blockGeo = new THREE.BoxGeometry(2.2, 2.0, 1.0);
  const blockMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.48,
    metalness: 0.06,
  });
  const barrierColors = [
    new THREE.Color('#E53935'),
    new THREE.Color('#1E88E5'),
    new THREE.Color('#FB8C00'),
    new THREE.Color('#43A047'),
  ];
  const samples = track.samples;
  const barrierPlacements: Array<{
    x: number;
    z: number;
    rotY: number;
    len: number;
    colorIdx: number;
  }> = [];
  const blockOffset = roadHalf + 4.8;
  for (let i = 0; i < samples.length; i += 2) {
    const smp = samples[i];
    const nextSmp = samples[(i + 2) % samples.length];
    const cIdx = Math.floor(i / 2) % barrierColors.length;

    for (const side of [1, -1] as const) {
      const p1x = smp.x * s + smp.nx * blockOffset * side;
      const p1z = smp.y * s + smp.ny * blockOffset * side;
      const p2x = nextSmp.x * s + nextSmp.nx * blockOffset * side;
      const p2z = nextSmp.y * s + nextSmp.ny * blockOffset * side;
      const dx = p2x - p1x;
      const dz = p2z - p1z;
      const chordLen = Math.max(1.2, Math.hypot(dx, dz));
      const rotY = Math.atan2(dx, dz);
      barrierPlacements.push({
        x: (p1x + p2x) * 0.5,
        z: (p1z + p2z) * 0.5,
        rotY,
        len: chordLen * 0.94,
        colorIdx: side > 0 ? cIdx : (cIdx + 2) % barrierColors.length,
      });
    }
  }

  if (barrierPlacements.length > 0) {
    const inst = new THREE.InstancedMesh(blockGeo, blockMat, barrierPlacements.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    barrierPlacements.forEach((bp, idx) => {
      dummy.position.set(bp.x, 1.0, bp.z);
      dummy.rotation.set(0, bp.rotY, 0);
      dummy.scale.set(1, 1, bp.len);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, barrierColors[bp.colorIdx]);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }

  return { group, flagMesh };
}

/**
 * Populates rolling green background hills, fluffy white clouds, palm trees, tiered trees & rocks.
 */
export function buildEnvironment3D(track: TrackData): THREE.Group {
  const env = new THREE.Group();
  const s = WORLD_SCALE;
  const cx = track.worldWidth * 0.5 * s;
  const cz = track.worldHeight * 0.5 * s;
  const roadHalf = track.roadWidth * 0.5 * s;

  // 1. Rolling Bright Green Rounded Dome Hills safely outside the entire circuit (Image 1 signature!)
  const hillGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const hillMat1 = new THREE.MeshStandardMaterial({ color: '#58C83C', roughness: 0.88 });
  const hillMat2 = new THREE.MeshStandardMaterial({ color: '#45B02C', roughness: 0.88 });
  const hillCount = 24;
  for (let i = 0; i < hillCount; i++) {
    const a = (i / hillCount) * Math.PI * 2;
    const dirX = Math.cos(a);
    const dirZ = Math.sin(a);
    const radius = 54 + (i % 4) * 16;
    const height = 36 + (i % 5) * 12;
    let dist = 330 + (i % 3) * 50;

    // Push hill radially outward until its inner skirt clears every track sample + barriers + margin
    const minReqClearance = radius + roadHalf + 30;
    for (let step = 0; step < 8; step++) {
      const hx = cx + dirX * dist;
      const hz = cz + dirZ * dist;
      let minRoadDist = Infinity;
      for (let k = 0; k < track.samples.length; k += 4) {
        const smp = track.samples[k];
        const d = Math.hypot(hx - smp.x * s, hz - smp.y * s);
        if (d < minRoadDist) minRoadDist = d;
      }
      if (minRoadDist >= minReqClearance) break;
      dist += minReqClearance - minRoadDist + 10;
    }

    const hill = new THREE.Mesh(hillGeo, i % 2 === 0 ? hillMat1 : hillMat2);
    hill.position.set(cx + dirX * dist, -1.5, cz + dirZ * dist);
    hill.scale.set(radius, height, radius);
    env.add(hill);
  }

  // 2. Crisp Fluffy White Clouds floating in the sky (Image 1 — unaffected by horizon fog)
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', fog: false });
  const cloudSphereGeo = new THREE.SphereGeometry(1, 12, 10);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.15;
    const dist = 250 + (i % 3) * 55;
    const cg = new THREE.Group();
    cg.position.set(cx + Math.cos(a) * dist, 52 + (i % 4) * 10, cz + Math.sin(a) * dist);
    const puffOffsets: Array<[number, number, number, number]> = [
      [0, 0, 0, 9.5],
      [-8, -1.5, 1, 7.2],
      [8.5, -1.2, -1, 7.5],
      [2, 3.2, 0.5, 6.8],
    ];
    for (const [px, py, pz, r] of puffOffsets) {
      const puff = new THREE.Mesh(cloudSphereGeo, cloudMat);
      puff.position.set(px, py, pz);
      puff.scale.set(r, r * 0.72, r * 0.8);
      cg.add(puff);
    }
    env.add(cg);
  }

  // 3. Instanced Palm Trees, Tiered Green Trees (Image 1 & 2), and Faceted Rocks (Image 2)
  const palms = track.scenery.filter((p) => p.kind === 'palm');
  const trees = track.scenery.filter((p) => p.kind === 'tree');
  const rocks = track.scenery.filter((p) => p.kind === 'rock');

  const dummy = new THREE.Object3D();

  // 3a. Palm Trees (trunk + 6 arched fronds)
  if (palms.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.62, 6.2, 8);
    trunkGeo.translate(0, 3.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#8A5A36', roughness: 0.88 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palms.length);
    trunkInst.castShadow = true;

    const frondGeo = new THREE.ConeGeometry(0.95, 4.0, 5);
    frondGeo.rotateX(Math.PI * 0.42);
    frondGeo.translate(0, 0, 1.9);
    const frondMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.65 });
    const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palms.length * 6);
    const frondColors = [new THREE.Color('#2FA83C'), new THREE.Color('#3BC44A')];

    palms.forEach((p, idx) => {
      const px = p.x * s;
      const pz = p.y * s;
      dummy.position.set(px, 0, pz);
      dummy.rotation.set(0, p.rotation, 0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      for (let f = 0; f < 6; f++) {
        dummy.position.set(px, 6.0 * p.scale, pz);
        dummy.rotation.set(0, p.rotation + (f * Math.PI) / 3, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        frondInst.setMatrixAt(idx * 6 + f, dummy.matrix);
        frondInst.setColorAt(idx * 6 + f, frondColors[f % 2]);
      }
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    frondInst.instanceMatrix.needsUpdate = true;
    if (frondInst.instanceColor) frondInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    frondInst.computeBoundingSphere();
    env.add(trunkInst, frondInst);
  }

  // 3b. Tiered Rounded Green Trees (Image 1 background trees!)
  if (trees.length > 0) {
    const tTrunkGeo = new THREE.CylinderGeometry(0.5, 0.72, 4.2, 8);
    tTrunkGeo.translate(0, 2.1, 0);
    const tTrunkMat = new THREE.MeshStandardMaterial({ color: '#7D4E2D', roughness: 0.9 });
    const tTrunkInst = new THREE.InstancedMesh(tTrunkGeo, tTrunkMat, trees.length);
    tTrunkInst.castShadow = true;

    const tierGeo = new THREE.SphereGeometry(2.1, 10, 8);
    const tierMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.72 });
    const tierInst = new THREE.InstancedMesh(tierGeo, tierMat, trees.length * 3);
    const treeColors = [new THREE.Color('#2CA83A'), new THREE.Color('#3CC249'), new THREE.Color('#4CD158')];

    trees.forEach((t, idx) => {
      const tx = t.x * s;
      const tz = t.y * s;
      dummy.position.set(tx, 0, tz);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      tTrunkInst.setMatrixAt(idx, dummy.matrix);

      const tierHeights = [4.4, 6.2, 7.8];
      const tierScales = [1.05, 0.85, 0.62];
      for (let k = 0; k < 3; k++) {
        dummy.position.set(tx, tierHeights[k] * t.scale, tz);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.scale.set(t.scale * tierScales[k], t.scale * tierScales[k] * 0.82, t.scale * tierScales[k]);
        dummy.updateMatrix();
        tierInst.setMatrixAt(idx * 3 + k, dummy.matrix);
        tierInst.setColorAt(idx * 3 + k, treeColors[k]);
      }
    });
    tTrunkInst.instanceMatrix.needsUpdate = true;
    tierInst.instanceMatrix.needsUpdate = true;
    if (tierInst.instanceColor) tierInst.instanceColor.needsUpdate = true;
    tTrunkInst.computeBoundingSphere();
    tierInst.computeBoundingSphere();
    env.add(tTrunkInst, tierInst);
  }

  // 3c. Faceted Rocks (Image 2 rock outcrop)
  if (rocks.length > 0) {
    const rockGeo = new THREE.DodecahedronGeometry(2.0, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.88,
      flatShading: true,
    });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length * 2);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;
    const rockCols = [new THREE.Color('#8E867B'), new THREE.Color('#A69E92')];

    rocks.forEach((r, idx) => {
      const rx = r.x * s;
      const rz = r.y * s;
      dummy.position.set(rx, 1.0 * r.scale, rz);
      dummy.rotation.set(0.2, r.rotation, 0.1);
      dummy.scale.set(1.1 * r.scale, 0.8 * r.scale, 0.95 * r.scale);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx * 2, dummy.matrix);
      rockInst.setColorAt(idx * 2, rockCols[0]);

      dummy.position.set(rx + 1.1 * r.scale, 0.65 * r.scale, rz + 0.6 * r.scale);
      dummy.rotation.set(0.5, r.rotation + 1.1, 0.3);
      dummy.scale.set(0.72 * r.scale, 0.58 * r.scale, 0.68 * r.scale);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx * 2 + 1, dummy.matrix);
      rockInst.setColorAt(idx * 2 + 1, rockCols[1]);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    rockInst.computeBoundingSphere();
    env.add(rockInst);
  }

  return env;
}

/**
 * 3D Item Box matching Image 2 (red-framed white X crate + ground shadow)
 */
export function createItemBox3D(
  itemBoxTex: THREE.CanvasTexture,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 2.1, 2.1),
    new THREE.MeshStandardMaterial({
      map: itemBoxTex,
      roughness: 0.35,
      metalness: 0.08,
    })
  );
  cube.position.y = 1.65;
  cube.rotation.set(0.35, 0.4, 0.25);
  cube.castShadow = true;
  cube.name = 'spinCore';
  g.add(cube);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  g.add(shadow);
  return g;
}

/**
 * 3D Gold Coin matching Images 1 & 2 (shiny beveled metallic gold disc + inner bar + shadow)
 */
export function createCoin3D(shadowTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const coinMat = new THREE.MeshStandardMaterial({
    color: '#FACC15',
    metalness: 0.88,
    roughness: 0.18,
    emissive: '#B45309',
    emissiveIntensity: 0.14,
  });

  const core = new THREE.Group();
  core.position.y = 1.5;
  core.name = 'spinCore';

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 20), coinMat);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  core.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.11, 8, 20), coinMat);
  core.add(rim);

  const slotBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.05, 0.32), coinMat);
  core.add(slotBar);

  g.add(core);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 2.1),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  g.add(shadow);
  return g;
}

/**
 * 3D Banana Peel matching Image 2 (3 splayed yellow peel petals + brown stem + cartoon eyes)
 */
export function createBanana3D(shadowTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.42 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#78350F', roughness: 0.78 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#14181F' });

  const body = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const petal = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.95, 4, 8), yellowMat);
    const a = (i * Math.PI * 2) / 3;
    petal.position.set(Math.sin(a) * 0.45, 0.42, Math.cos(a) * 0.45);
    petal.rotation.set(Math.cos(a) * 0.95, 0, -Math.sin(a) * 0.95);
    petal.castShadow = true;
    body.add(petal);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.45, 8), stemMat);
  stem.position.y = 1.02;
  body.add(stem);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
  eyeL.position.set(-0.1, 0.75, 0.22);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
  eyeR.position.set(0.1, 0.75, 0.22);
  body.add(eyeL, eyeR);
  g.add(body);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 2.3),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  g.add(shadow);
  return g;
}

/**
 * 3D Red Shell Homing Projectile matching Image 2 (red dome + white rim + cream belly)
 */
export function createRedShell3D(shadowTex: THREE.CanvasTexture): THREE.Group {
  const g = new THREE.Group();
  const redMat = new THREE.MeshPhysicalMaterial({
    color: '#E52521',
    roughness: 0.25,
    clearcoat: 0.85,
  });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.4 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: '#FDE68A', roughness: 0.55 });

  const shell = new THREE.Group();
  shell.position.y = 0.75;
  shell.name = 'spinCore';

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    redMat
  );
  dome.scale.set(1, 0.88, 1.08);
  dome.castShadow = true;
  shell.add(dome);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.14, 8, 18), whiteMat);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, 1.08, 1);
  shell.add(rim);

  const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.66, 0.32, 16), bellyMat);
  belly.position.y = -0.18;
  shell.add(belly);

  g.add(shell);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  g.add(shadow);
  return g;
}
