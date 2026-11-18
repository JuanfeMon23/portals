import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { projects } from './projects.js';
import { floorTexture, wallTexture, woodTexture, leatherTexture, boneTexture, bannerTexture, labelTexture } from './textures.js';
import { fireParticles, embers, orbitSparks } from './shaders.js';
import { portalSphereMaterial, haloMaterial, beamMaterial, flameMaterial } from './fx.js';
import { ropeTexture, grateTexture, curtainTexture, emblemTexture, taperedTube, beamBetween, ropeColumn, spikedBrazier, channeler } from './props.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Solo en dev: ?at=0..1 congela la inmersión en ese instante (para revisarla cuadro a cuadro).
const dbgAt = import.meta.env.DEV && new URLSearchParams(window.location.search).has('at')
  ? Number(new URLSearchParams(window.location.search).get('at')) : null;

const HALL_R = 34;
const WALL_H = 18;
const PORTAL_R = 21;
const SPHERE_R = 2.3;
const PLAT_H = 1.5;
const SPHERE_Y = PLAT_H + 0.3 + SPHERE_R * 1.1;
const SPHERE_Z = -0.3;
const CAM_HOME = new THREE.Vector3(0, 7.5, 22);
const TARGET_HOME = new THREE.Vector3(0, 4.6, -9);
let baseFov = 50;

// Encuadre según el aspecto: más lejos y más angular en pantallas estrechas.
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  CAM_HOME.z = Math.min(28, 22 + Math.max(0, 1.75 - aspect) * 9);
  baseFov = 50 + Math.max(0, 1.3 - aspect) * 38;
}
fitCamera();

// ---------- Render ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0503');
scene.fog = new THREE.FogExp2('#170904', 0.018);

const camera = new THREE.PerspectiveCamera(baseFov, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 15, 32);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET_HOME);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 32;
controls.minAzimuthAngle = -0.7;
controls.maxAzimuthAngle = 0.7;
controls.minPolarAngle = 1.0;
controls.maxPolarAngle = 1.5;
controls.rotateSpeed = 0.5;
controls.enabled = false;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Materiales ----------
const stoneMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.95, color: '#c9a58f' });
const darkStoneMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 1, color: '#6e5040' });
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.85, color: '#c8a080' });
const ropeMat = new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 1 });
const boneMat = new THREE.MeshStandardMaterial({ map: boneTexture(), roughness: 0.55 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#34302c', roughness: 0.4, metalness: 0.8 });
const goldMat = new THREE.MeshStandardMaterial({ color: '#d39a3a', roughness: 0.3, metalness: 0.7, emissive: '#3a2004', emissiveIntensity: 0.6 });
const robeMat = new THREE.MeshStandardMaterial({ color: '#2a0d1a', roughness: 0.9 });

const animated = []; // materiales con uTime
const flickers = []; // luces que parpadean

// ---------- Sala ----------
scene.add(new THREE.HemisphereLight('#ff9a60', '#1a0804', 0.45));
scene.add(new THREE.AmbientLight('#3a1a10', 0.55));

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(HALL_R, 96),
  new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, color: '#d8b8a0' }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Rejillas encendidas alrededor de la fogata
const grate = grateTexture();
grate.repeat.set(3, 3);
const grateMat = new THREE.MeshStandardMaterial({ map: grate, emissiveMap: grate, emissive: '#ffffff', emissiveIntensity: 0.45, color: '#3a2a20', roughness: 0.7 });
const grates = new THREE.Mesh(new THREE.RingGeometry(3.3, 6.4, 64), grateMat);
grates.rotation.x = -Math.PI / 2; grates.position.y = 0.02;
scene.add(grates);
for (const r of [3.3, 6.4]) {
  const curb = new THREE.Mesh(new THREE.TorusGeometry(r, 0.14, 6, 72), goldMat);
  curb.rotation.x = Math.PI / 2; curb.position.y = 0.06;
  scene.add(curb);
}
const curbStone = new THREE.Mesh(new THREE.RingGeometry(6.55, 7.6, 64), new THREE.MeshStandardMaterial({ map: wallTexture(), color: '#8a5a44', roughness: 1 }));
curbStone.rotation.x = -Math.PI / 2; curbStone.position.y = 0.015;
scene.add(curbStone);

const wall = new THREE.Mesh(new THREE.CylinderGeometry(HALL_R, HALL_R, WALL_H, 96, 1, true), stoneMat.clone());
wall.material.side = THREE.BackSide;
wall.position.y = WALL_H / 2;
scene.add(wall);

const roof = new THREE.Mesh(
  new THREE.ConeGeometry(HALL_R, 14, 96, 1, true),
  new THREE.MeshStandardMaterial({ map: leatherTexture(), side: THREE.BackSide, roughness: 1, color: '#b07050' }),
);
roof.position.y = WALL_H + 7;
scene.add(roof);

const RIBS = 16;
const banners = [];
const apex = new THREE.Vector3(0, WALL_H + 14, 0);
for (let i = 0; i < RIBS; i++) {
  const a = (i / RIBS) * Math.PI * 2;
  const base = new THREE.Vector3(Math.cos(a) * (HALL_R - 1), 0, Math.sin(a) * (HALL_R - 1));
  const col = ropeColumn({ height: WALL_H, radius: 1.0, wood: woodMat, rope: ropeMat, iron: ironMat });
  col.position.copy(base);
  scene.add(col);
  scene.add(beamBetween(base.clone().setY(WALL_H), apex, 0.45, woodMat));
  // colmillo curvo que sale del muro hacia el centro
  const dir = base.clone().normalize();
  scene.add(taperedTube([
    base.clone().addScaledVector(dir, 0.2).setY(WALL_H - 3),
    base.clone().addScaledVector(dir, -1.8).setY(WALL_H - 1.6),
    base.clone().addScaledVector(dir, -3.4).setY(WALL_H + 0.8),
  ], 0.55, 0.05, boneMat, 16, 8));
  // estandarte entre columnas
  const ba = a + Math.PI / RIBS;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3, 7.5, 6, 12), new THREE.MeshStandardMaterial({ map: bannerTexture(), side: THREE.DoubleSide, roughness: 0.9 }));
  banner.position.set(Math.cos(ba) * (HALL_R - 0.4), 11, Math.sin(ba) * (HALL_R - 0.4));
  banner.lookAt(0, 11, 0);
  banner.userData.base = banner.geometry.attributes.position.array.slice();
  banner.userData.phase = i;
  banners.push(banner);
  scene.add(banner);
}

// Fogata central
const pit = new THREE.Group();
for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.15, 0), darkStoneMat);
  rock.position.set(Math.cos(a) * 2.5, 0.35, Math.sin(a) * 2.5);
  rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  pit.add(rock);
}
const coals = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshStandardMaterial({ color: '#1a0500', emissive: '#ff3a00', emissiveIntensity: 1.6 }));
coals.rotation.x = -Math.PI / 2; coals.position.y = 0.15;
pit.add(coals);
// lenguas de fuego repartidas por la fogata
for (let k = 0; k < 9; k++) {
  const fm = flameMaterial({ intensity: 0.55 });
  const r = k === 0 ? 0 : 0.6 + (k % 2) * 0.55;
  const a = k * 2.4;
  const h = k === 0 ? 4.4 : 2.4 + Math.random() * 1.4;
  for (let c = 0; c < 2; c++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.55, h), fm);
    f.position.set(Math.cos(a) * r, 0.2 + h / 2, Math.sin(a) * r);
    f.rotation.y = a + c * Math.PI / 2;
    pit.add(f);
  }
  animated.push(fm);
}
const pitFire = fireParticles({ count: reducedMotion ? 80 : 240, radius: 1.5, height: 6, size: 220, speed: 0.5 });
pit.add(pitFire);
animated.push(pitFire.material);
const pitLight = new THREE.PointLight('#ff7a2a', 170, 50, 2);
pitLight.position.y = 2.5;
pit.add(pitLight);
flickers.push({ light: pitLight, base: 170, seed: 0 });
scene.add(pit);

const emberField = embers(reducedMotion ? 150 : 650, HALL_R - 4, WALL_H + 4);
scene.add(emberField);
animated.push(emberField.material);

function addBrazier(pos, withLight, scale = 1.15) {
  const b = spikedBrazier({ iron: ironMat, scale, withLight, reduced: reducedMotion });
  b.group.position.copy(pos);
  animated.push(...b.animated);
  if (b.light) flickers.push({ light: b.light, base: b.light.intensity, seed: Math.random() * 100 });
  scene.add(b.group);
}

// ---------- Santuarios ----------
const portals = [];
const n = projects.length;
const spread = Math.min(Math.PI * 0.75, (n - 1) * 0.42);
const angleOf = (i) => (n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1));
const onArc = (angle, r, y = 0) => new THREE.Vector3(Math.sin(angle) * r, y, -Math.cos(angle) * r);

function buildSanctuary(p, i) {
  const angle = angleOf(i);
  const g = new THREE.Group();
  g.position.copy(onArc(angle, PORTAL_R));
  g.lookAt(0, 0, 0);

  // estrado y escalones
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.55, PLAT_H, 10), darkStoneMat);
  dais.position.set(0, PLAT_H / 2, -0.6);
  const daisRim = new THREE.Mesh(new THREE.TorusGeometry(3.32, 0.07, 6, 40), goldMat);
  daisRim.rotation.x = Math.PI / 2; daisRim.position.set(0, PLAT_H, -0.6);
  g.add(dais, daisRim);
  for (let k = 0; k < 3; k++) {
    const h = (k + 1) * 0.5;
    const z = 2.7 + (2 - k) * 0.75;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.4, h, 0.75), stoneMat);
    step.position.set(0, h / 2, z);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.08), goldMat);
    trim.position.set(0, h, z + 0.36);
    g.add(step, trim);
  }

  // plataforma luminosa bajo la esfera
  const padMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', emissive: p.color, emissiveIntensity: 0.9, roughness: 0.4 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.12, 48), padMat);
  pad.position.set(0, PLAT_H + 0.06, SPHERE_Z);
  const padRim = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.1, 8, 48), goldMat);
  padRim.rotation.x = Math.PI / 2; padRim.position.set(0, PLAT_H + 0.12, SPHERE_Z);
  g.add(pad, padRim);

  // barandas doradas que bajan por la escalera
  for (const s of [-1, 1]) {
    const top = new THREE.Vector3(s * 2.45, PLAT_H + 1.2, 1.7);
    const mid = new THREE.Vector3(s * 2.6, 1.9, 3.2);
    const low = new THREE.Vector3(s * 2.75, 1.0, 4.7);
    g.add(taperedTube([top, mid, low], 0.08, 0.08, goldMat, 20, 8));
    g.add(taperedTube([top.clone().setY(top.y - 0.55), mid.clone().setY(mid.y - 0.5), low.clone().setY(low.y - 0.45)], 0.05, 0.05, goldMat, 20, 6));
    for (const [pt, baseY] of [[top, PLAT_H], [low, 0]]) {
      g.add(beamBetween(pt.clone().setY(baseY), pt, 0.09, goldMat, 8));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), goldMat);
      knob.position.copy(pt).setY(pt.y + 0.12);
      g.add(knob);
    }
  }

  // cortina con emblema y cenefa dorada
  const curtainGeo = new THREE.PlaneGeometry(6.4, 8.6, 40, 1);
  const cp = curtainGeo.attributes.position;
  for (let k = 0; k < cp.count; k++) cp.setZ(k, Math.sin(cp.getX(k) * 4.4) * 0.16);
  curtainGeo.computeVertexNormals();
  const curtain = new THREE.Mesh(curtainGeo, new THREE.MeshStandardMaterial({ map: curtainTexture(p.color), roughness: 0.85, side: THREE.DoubleSide }));
  curtain.position.set(0, PLAT_H + 4.3, -3.4);
  const valance = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.4, 0.4), goldMat);
  valance.position.set(0, PLAT_H + 8.6, -3.3);
  g.add(curtain, valance);

  // arco de colmillos
  for (const s of [-1, 1]) {
    g.add(taperedTube([
      new THREE.Vector3(s * 3.3, 0, -1.8), new THREE.Vector3(s * 3.75, 3.6, -1.6),
      new THREE.Vector3(s * 3.2, 7.4, -1.3), new THREE.Vector3(s * 1.4, 9.9, -1.0),
    ], 0.62, 0.06, boneMat, 32, 12));
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.7, 8), ironMat);
    socket.position.set(s * 3.3, 0.35, -1.8);
    g.add(socket);
  }

  // esfera de energía
  const emblem = emblemTexture(p.name, p.color);
  const sphereMat = portalSphereMaterial({ color: p.color, deep: p.colorB, emblem, radius: SPHERE_R });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 64, 48), sphereMat);
  sphere.position.set(0, SPHERE_Y, SPHERE_Z);
  sphere.scale.set(1, 1.1, 1);
  animated.push(sphereMat);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R * 1.22, 48, 32), haloMaterial(p.color));
  halo.position.copy(sphere.position);
  halo.scale.copy(sphere.scale);
  g.add(sphere, halo);

  const sparks = orbitSparks(p.color, reducedMotion ? 30 : 80, SPHERE_R + 0.35);
  sparks.position.copy(sphere.position);
  g.add(sparks);
  animated.push(sparks.material);

  // canalizadores
  const casters = [];
  for (const s of [-1, 1]) {
    const c = channeler({ robe: robeMat, trim: goldMat, color: p.color });
    const x = s * 2.45, z = 1.0;
    c.group.position.set(x, PLAT_H, z);
    c.group.rotation.y = Math.atan2(-x, SPHERE_Z - z);
    g.add(c.group);
    casters.push(c);
  }

  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(p.name, p.color), transparent: true, depthWrite: false, opacity: 0.85 }));
  label.scale.set(4.8, 1.2, 1);
  label.position.set(0, PLAT_H + 9.6, -0.5);
  g.add(label);

  const light = new THREE.PointLight(p.color, 26, 15, 2);
  light.position.set(0, SPHERE_Y, 2.2);
  g.add(light);

  const hit = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 11), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 5.2, 0.8);
  hit.userData.index = i;
  g.add(hit);

  scene.add(g);

  // haces de las manos a la esfera (en coordenadas de mundo)
  g.updateMatrixWorld(true);
  const center = sphere.getWorldPosition(new THREE.Vector3());
  for (const c of casters) {
    for (const h of c.hands) {
      const from = h.getWorldPosition(new THREE.Vector3());
      const to = center.clone().addScaledVector(from.clone().sub(center).normalize(), SPHERE_R * 1.02);
      const bm = beamMaterial(p.color);
      scene.add(beamBetween(from, to, 0.05, bm, 6));
      animated.push(bm);
    }
  }

  return { project: p, group: g, sphere, halo, sparks, label, light, hit, center, hover: 0, angle };
}

// ---------- UI ----------
const card = document.getElementById('card');
const cardName = document.getElementById('card-name');
const cardTagline = document.getElementById('card-tagline');
const cardStack = document.getElementById('card-stack');
const menu = document.getElementById('menu');
const veil = document.getElementById('veil');
const loader = document.getElementById('loader');

let hovered = -1;
let entering = null;
let intro = { t: 0, from: camera.position.clone() };

function setHovered(i) {
  if (i === hovered || entering) return;
  hovered = i;
  document.body.classList.toggle('hovering', i >= 0);
  [...menu.children].forEach((b, k) => b.classList.toggle('active', k === i));
  if (i < 0) { card.hidden = true; return; }
  const p = portals[i].project;
  card.style.setProperty('--accent', p.color);
  cardName.textContent = p.name;
  cardTagline.textContent = p.tagline;
  cardStack.replaceChildren(...p.stack.map((s) => Object.assign(document.createElement('li'), { textContent: s })));
  card.hidden = false;
}

function buildMenu() {
  portals.forEach((pt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = pt.project.name;
    b.style.setProperty('--c', pt.project.color);
    b.addEventListener('mouseenter', () => setHovered(i));
    b.addEventListener('focus', () => setHovered(i));
    b.addEventListener('mouseleave', () => setHovered(-1));
    b.addEventListener('click', () => enter(i));
    menu.appendChild(b);
  });
}

// ---------- Interacción ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pick(e) {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(portals.map((p) => p.hit), false)[0];
  return hit ? hit.object.userData.index : -1;
}

canvas.addEventListener('pointermove', (e) => { if (!entering && e.pointerType === 'mouse') setHovered(pick(e)); });
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || entering) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;
  const i = pick(e);
  if (i < 0) { setHovered(-1); return; }
  // en táctil, primer toque muestra la tarjeta y el segundo entra
  if (e.pointerType !== 'mouse' && hovered !== i) { setHovered(i); return; }
  enter(i);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setHovered(-1); });

// ---------- Inmersión ----------
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function enter(i) {
  if (entering || intro) return;
  setHovered(i);
  const pt = portals[i];
  const center = pt.center.clone();
  const normal = new THREE.Vector3(-pt.group.position.x, 0, -pt.group.position.z).normalize();
  entering = {
    pt, t: 0,
    duration: reducedMotion ? 0.9 : 3.4,
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: center.clone().addScaledVector(normal, 7),
    p2: center.clone().addScaledVector(normal, -0.6),
    center,
    beyond: center.clone().addScaledVector(normal, -12),
  };
  pt.sphere.material.side = THREE.DoubleSide;
  pt.sphere.material.needsUpdate = true;
  controls.enabled = false;
  document.body.classList.add('entering');
  document.body.classList.remove('hovering');
  veil.style.setProperty('--accent', pt.project.color);
}

function updateEntering(dt) {
  const e = entering;
  e.t = dbgAt ?? Math.min(1, e.t + dt / e.duration);
  const t = e.t;
  const u = e.pt.sphere.material.uniforms;
  if (reducedMotion) {
    veil.style.opacity = String(t);
  } else {
    const a = clamp01(t / 0.42), b = clamp01((t - 0.42) / 0.58);
    if (t < 0.42) {
      const k = easeInOut(a);
      camera.position.lerpVectors(e.p0, e.p1, k);
      controls.target.lerpVectors(e.t0, e.center, k);
    } else {
      const k = easeIn(b);
      camera.position.lerpVectors(e.p1, e.p2, k);
      controls.target.lerpVectors(e.center, e.beyond, k);
      const shake = 0.06 * b;
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
    }
    camera.fov = baseFov + 70 * easeIn(b);
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    u.uSpeed.value = 1 + 9 * easeIn(t);
    u.uBoost.value = 1.6 * easeIn(t);
    e.pt.halo.material.uniforms.uBoost.value = 2 * easeIn(t);
    e.pt.sparks.material.uniforms.uSpeed.value = 1 + 8 * t;
    bloom.strength = 0.75 + 2.2 * easeIn(b);
    renderer.toneMappingExposure = 1.1 + 0.8 * easeIn(b);
    veil.style.opacity = String(clamp01((t - 0.62) / 0.3));
  }
  if (t >= 1 && !e.done && dbgAt === null) {
    e.done = true;
    window.location.assign(e.pt.project.url);
  }
}

// Al volver con el botón "atrás" (bfcache) se recarga para resetear la escena.
window.addEventListener('pageshow', (ev) => { if (ev.persisted) window.location.reload(); });

// ---------- Bucle ----------
const clock = new THREE.Clock();

function updateBanners(time) {
  for (const b of banners) {
    const pos = b.geometry.attributes.position;
    const base = b.userData.base;
    for (let k = 0; k < pos.count; k++) {
      const x = base[k * 3], y = base[k * 3 + 1];
      const w = (3.75 - y) / 7.5;
      pos.array[k * 3 + 2] = Math.sin(time * 1.3 + x * 1.2 + y * 0.8 + b.userData.phase) * 0.18 * w;
    }
    pos.needsUpdate = true;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  for (const m of animated) m.uniforms.uTime.value = time;
  for (const f of flickers) {
    f.light.intensity = f.base * (0.82 + 0.12 * Math.sin(time * 9 + f.seed) + 0.08 * Math.sin(time * 23 + f.seed * 3));
  }
  grateMat.emissiveIntensity = 0.42 + 0.08 * Math.sin(time * 2.3) + 0.05 * Math.sin(time * 7.1);
  if (!reducedMotion) updateBanners(time);

  portals.forEach((pt, i) => {
    const target = i === hovered ? 1 : 0;
    pt.hover += (target - pt.hover) * Math.min(1, dt * 8);
    pt.sphere.material.uniforms.uHover.value = pt.hover;
    pt.halo.material.uniforms.uHover.value = pt.hover;
    const s = 1 + pt.hover * 0.04 + Math.sin(time * 1.7 + i) * 0.006;
    pt.sphere.scale.set(s, 1.1 * s, s);
    pt.halo.scale.copy(pt.sphere.scale);
    pt.label.material.opacity = 0.75 + pt.hover * 0.25;
    pt.label.position.y = PLAT_H + 9.6 + Math.sin(time * 1.5 + i) * 0.12;
    pt.light.intensity = 26 + pt.hover * 30 + Math.sin(time * 3 + i) * 3;
  });

  if (intro) {
    intro.t = Math.min(1, intro.t + dt / (reducedMotion ? 0.01 : 3.5));
    const k = 1 - Math.pow(1 - intro.t, 3);
    camera.position.lerpVectors(intro.from, CAM_HOME, k);
    camera.lookAt(controls.target);
    if (intro.t >= 1) { intro = null; controls.enabled = true; }
  } else if (entering) {
    updateEntering(dt);
  } else {
    controls.update();
  }

  composer.render();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  fitCamera();
  if (!entering) camera.fov = baseFov;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});

// ---------- Arranque ----------
async function start() {
  // Etiquetas y emblemas se dibujan en canvas: esperar a la fuente.
  try { await Promise.race([document.fonts.load('700 120px Cinzel'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fuente opcional */ }
  projects.forEach((p, i) => portals.push(buildSanctuary(p, i)));
  // columnas detrás, entre santuarios y en los extremos; braseros delante
  const step = n > 1 ? spread / (n - 1) : 0.42;
  for (let k = 0; k <= n; k++) {
    const a = -spread / 2 + (k - 0.5) * step;
    const col = ropeColumn({ height: 13, radius: 0.85, wood: woodMat, rope: ropeMat, iron: ironMat });
    col.position.copy(onArc(a, PORTAL_R + 2.6));
    scene.add(col);
    if (k > 0 && k < n) addBrazier(onArc(a, PORTAL_R - 2.2), k % 2 === 1);
  }
  addBrazier(new THREE.Vector3(-12, 0, 5), true, 1.2);
  addBrazier(new THREE.Vector3(12, 0, 5), true, 1.2);
  buildMenu();
  camera.lookAt(controls.target);
  intro.from.copy(camera.position);
  if (dbgAt !== null) intro.t = 1;
  tick();
  requestAnimationFrame(() => loader.classList.add('done'));
}

start();

// Enlace directo: ?portal=<id> cruza ese portal al terminar la entrada.
const deep = new URLSearchParams(window.location.search).get('portal');
if (deep) {
  const wait = () => {
    const i = portals.findIndex((p) => p.project.id === deep);
    if (intro || i < 0) { if (portals.length === 0 || intro) requestAnimationFrame(wait); return; }
    enter(i);
  };
  requestAnimationFrame(wait);
}
