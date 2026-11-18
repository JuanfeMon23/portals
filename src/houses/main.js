import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '../style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { toonGradient, createInkPipeline } from './ink.js';
import { projects } from '../projects.js';
import { marbleTexture, ashlarTexture, rockTexture, buildHouse, goddessStatue } from './temples.js';
import { nebulaSky, cosmicDust, constellations, CORE_DIR } from './cosmos.js';
import { magicCircleTexture } from './nature.js';
import { buildMountain } from './mountain.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Solo en dev: ?at=0..1 congela la inmersión en ese instante.
const dbgAt = import.meta.env.DEV && new URLSearchParams(window.location.search).has('at')
  ? Number(new URLSearchParams(window.location.search).get('at')) : null;

// Cada proyecto custodia una casa del zodiaco; el orden del camino sigue el zodiaco.
const HOUSES = {
  vladimir: { style: 'aries', glyph: '♈', title: 'Casa de Aries', order: 1 },
  taurus: { style: 'taurus', glyph: '♉', title: 'Casa de Tauro', order: 2 },
  leo: { style: 'leo', glyph: '♌', title: 'Casa de Leo', order: 5 },
  incubus: { style: 'scorpio', glyph: '♏', title: 'Casa de Escorpio', order: 8 },
  acuarius: { style: 'aquarius', glyph: '♒', title: 'Casa de Acuario', order: 11 },
  andromeda: { style: 'pisces', glyph: '♓', title: 'Casa de Piscis', order: 12 },
};
const fallbackHouse = { style: 'default', glyph: '✦', title: 'Casa sin signo', order: 99 };
const ordered = [...projects]
  .map((p) => ({ project: p, house: HOUSES[p.id] ?? fallbackHouse }))
  .sort((a, b) => a.house.order - b.house.order);

const CAM_HOME = new THREE.Vector3(0, 30, 104);
const TARGET_HOME = new THREE.Vector3(0, 36, -10);
let baseFov = 50;

function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  CAM_HOME.z = Math.min(140, 104 + Math.max(0, 1.6 - aspect) * 30);
  baseFov = 50 + Math.max(0, 1.2 - aspect) * 30;
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
scene.fog = new THREE.FogExp2('#1a2150', 0.0055);

const camera = new THREE.PerspectiveCamera(baseFov, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 40, 75);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET_HOME);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 30;
controls.maxDistance = 150;
controls.minAzimuthAngle = -0.6;
controls.maxAzimuthAngle = 0.6;
controls.minPolarAngle = 1.05;
controls.maxPolarAngle = 1.62;
controls.rotateSpeed = 0.45;
controls.enabled = false;

// objetos que no llevan contorno de tinta (cielo, partículas, sprites, relieves)
const noInk = [];
const pipeline = createInkPipeline({ renderer, scene, camera, coreDir: CORE_DIR, noInk });
// render base con MSAA (el compositor no lo trae por defecto)
const msaaTarget = new THREE.WebGLRenderTarget(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio(), { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, msaaTarget);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(pipeline.ink);
composer.addPass(pipeline.rays);
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const dpr = renderer.getPixelRatio();
const smaa = new SMAAPass(window.innerWidth * dpr, window.innerHeight * dpr);
composer.addPass(smaa);

// ---------- Materiales ----------
const gradient = toonGradient();
const mats = {
  gradient,
  marble: new THREE.MeshToonMaterial({ map: marbleTexture(), color: '#f4f2fa', gradientMap: gradient }),
  ashlar: new THREE.MeshToonMaterial({ map: ashlarTexture(), color: '#e8e6f2', gradientMap: gradient }),
  rock: new THREE.MeshToonMaterial({ map: rockTexture(), color: '#c9a882', gradientMap: gradient }),
  gold: new THREE.MeshToonMaterial({ color: '#e7b85a', emissive: '#3a2200', gradientMap: gradient }),
};

const animated = [];

// ---------- Cosmos ----------
const sky = nebulaSky();
scene.add(sky);
animated.push(sky.material);
noInk.push(sky);
const dust = cosmicDust(reducedMotion ? 300 : 1000, 110);
scene.add(dust);
animated.push(dust.material);
noInk.push(dust);
const stars = constellations();
scene.add(stars);
noInk.push(stars);
const circles = [];

scene.add(new THREE.HemisphereLight('#9a8cff', '#2a1640', 0.9));
const moon = new THREE.DirectionalLight('#dfe4ff', 1.6);
moon.position.set(-30, 60, 40);
scene.add(moon);
const coreLight = new THREE.DirectionalLight('#b48cff', 0.9);
coreLight.position.set(10, 20, -80);
scene.add(coreLight);

// ---------- Camino de las casas ----------
const houses = [];
const n = ordered.length;
let mountain = null;

function auraTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const auraTex = auraTexture();

function buildHouseOnPath({ project: p, house }, i) {
  const pos = mountain.houses[i].center;

  // círculo mágico en el suelo, frente a la casa
  const circle = new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), new THREE.MeshBasicMaterial({
    map: magicCircleTexture(p.color), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  circle.rotation.x = -Math.PI / 2;

  const t = buildHouse(house.style, { mats, color: p.color, glyph: house.glyph });
  t.group.position.copy(pos);
  t.group.rotation.y = Math.atan2(CAM_HOME.x - pos.x, CAM_HOME.z - pos.z) * 0.8;
  scene.add(t.group);
  animated.push(t.door.material);
  t.group.traverse((o) => { if (o.userData.noInk) noInk.push(o); });

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: p.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.12 }));
  aura.scale.set(22, 18, 1);
  aura.position.copy(pos).add(new THREE.Vector3(0, t.height * 0.45, -3));
  scene.add(aura);
  noInk.push(aura);

  // etiqueta en HTML: nítida y sin que la tinta del postproceso la pise
  const label = document.createElement('div');
  label.className = 'house-label';
  label.style.setProperty('--c', p.color);
  label.innerHTML = `<strong></strong><span></span>`;
  label.querySelector('strong').textContent = p.name;
  label.querySelector('span').textContent = `${house.glyph}︎ ${house.title}`;
  labelLayer.appendChild(label);
  const labelAnchor = pos.clone().add(new THREE.Vector3(0, t.height + 1.6, -1));

  t.group.updateMatrixWorld(true);
  const door = t.door.getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(t.group.quaternion);
  // el círculo va delante de la escalinata, apoyado en el terreno
  circle.position.copy(door).addScaledVector(forward, 5.8);
  circle.position.y = mountain.sampleHeight(circle.position.x, circle.position.z) + 0.2;
  scene.add(circle);
  noInk.push(circle);
  circles.push(circle);

  const light = new THREE.PointLight(p.color, 14, 14, 2);
  light.position.copy(door).addScaledVector(forward, 4).add(new THREE.Vector3(0, 1, 0));
  scene.add(light);

  // zona de click: caja invisible que envuelve el templo
  const hit = new THREE.Mesh(new THREE.BoxGeometry(t.width + 3, t.height + 3, t.depth + 4), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(t.group.position).add(new THREE.Vector3(0, (t.height + 3) / 2, 1));
  hit.rotation.y = t.group.rotation.y;
  hit.userData.index = i;
  scene.add(hit);

  return { project: p, house, temple: t, aura, label, labelAnchor, light, hit, door, forward, hover: 0 };
}

// ---------- UI ----------
const labelLayer = document.createElement('div');
labelLayer.className = 'label-layer';
document.body.appendChild(labelLayer);
const projected = new THREE.Vector3();
function placeLabel(h) {
  projected.copy(h.labelAnchor).project(camera);
  const visible = projected.z < 1;
  h.label.style.display = visible ? '' : 'none';
  if (!visible) return;
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  h.label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${0.85 + h.hover * 0.2})`;
  h.label.classList.toggle('active', h.hover > 0.5);
}

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
  const { project: p, house } = houses[i];
  card.style.setProperty('--accent', p.color);
  cardName.textContent = `${house.glyph}︎ ${p.name}`;
  cardTagline.textContent = `${house.title} · ${p.tagline}`;
  cardStack.replaceChildren(...p.stack.map((s) => Object.assign(document.createElement('li'), { textContent: s })));
  card.hidden = false;
}

function buildMenu() {
  houses.forEach((h, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `${h.house.glyph}︎ ${h.project.name}`;
    b.style.setProperty('--c', h.project.color);
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
  const hit = raycaster.intersectObjects(houses.map((h) => h.hit), false)[0];
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
  if (e.pointerType !== 'mouse' && hovered !== i) { setHovered(i); return; }
  enter(i);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setHovered(-1); });

// ---------- Inmersión: la cámara sube a la casa y cruza su puerta ----------
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function enter(i) {
  if (entering || intro) return;
  setHovered(i);
  const h = houses[i];
  entering = {
    h, t: 0,
    duration: reducedMotion ? 0.9 : 3.6,
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: h.door.clone().addScaledVector(h.forward, 11).add(new THREE.Vector3(0, 2.5, 0)),
    p2: h.door.clone().addScaledVector(h.forward, -1.5),
    look: h.door.clone(),
    beyond: h.door.clone().addScaledVector(h.forward, -12),
  };
  controls.enabled = false;
  document.body.classList.add('entering');
  document.body.classList.remove('hovering');
  veil.style.setProperty('--accent', h.project.color);
}

function updateEntering(dt) {
  const e = entering;
  e.t = dbgAt ?? Math.min(1, e.t + dt / e.duration);
  const t = e.t;
  const u = e.h.temple.door.material.uniforms;
  if (reducedMotion) {
    veil.style.opacity = String(t);
  } else {
    const a = clamp01(t / 0.5), b = clamp01((t - 0.5) / 0.5);
    if (t < 0.5) {
      const k = easeInOut(a);
      camera.position.lerpVectors(e.p0, e.p1, k);
      controls.target.lerpVectors(e.t0, e.look, k);
    } else {
      const k = easeIn(b);
      camera.position.lerpVectors(e.p1, e.p2, k);
      controls.target.lerpVectors(e.look, e.beyond, k);
    }
    camera.fov = baseFov + 60 * easeIn(b);
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
    u.uBoost.value = 2 * easeIn(t);
    e.h.aura.material.opacity = 0.12 + 0.6 * easeIn(t);
    bloom.strength = 0.7 + 2.0 * easeIn(b);
    renderer.toneMappingExposure = 1.1 + 0.8 * easeIn(b);
    veil.style.opacity = String(clamp01((t - 0.7) / 0.25));
  }
  if (t >= 1 && !e.done && dbgAt === null) {
    e.done = true;
    window.location.assign(e.h.project.url);
  }
}

window.addEventListener('pageshow', (ev) => { if (ev.persisted) window.location.reload(); });

// ---------- Bucle ----------
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;
  for (const m of animated) m.uniforms.uTime.value = time;
  if (mountain) mountain.update(reducedMotion ? 0 : time, camera);
  circles.forEach((c, i) => {
    c.rotation.z = reducedMotion ? 0 : time * 0.15 * (i % 2 ? 1 : -1);
    c.material.opacity = 0.45 + (houses[i] ? houses[i].hover * 0.45 : 0);
  });

  houses.forEach((h, i) => {
    const target = i === hovered ? 1 : 0;
    h.hover += (target - h.hover) * Math.min(1, dt * 8);
    h.temple.door.material.uniforms.uHover.value = h.hover;
    if (!entering || entering.h !== h) h.aura.material.opacity = 0.12 + h.hover * 0.35 + Math.sin(time * 1.3 + i) * 0.02;
    placeLabel(h);
    h.light.intensity = 14 + h.hover * 26;
  });

  if (intro) {
    intro.t = Math.min(1, intro.t + dt / (reducedMotion ? 0.01 : 4));
    const k = 1 - Math.pow(1 - intro.t, 3);
    camera.position.lerpVectors(intro.from, CAM_HOME, k);
    camera.lookAt(controls.target);
    if (intro.t >= 1) { intro = null; controls.enabled = true; }
  } else if (entering) {
    updateEntering(dt);
  } else {
    controls.update();
  }

  pipeline.beforeRender();
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
  pipeline.setSize();
  smaa.setSize(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
  bloom.resolution.set(window.innerWidth, window.innerHeight);
});

// ---------- Arranque ----------
async function start() {
  try { await Promise.race([document.fonts.load('700 120px Cinzel'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fuente opcional */ }
  // una sola montaña con el sendero que sube por las casas
  mountain = buildMountain({ houseCount: n, mats, reduced: reducedMotion });
  scene.add(mountain.group);
  animated.push(...mountain.animated);
  noInk.push(...mountain.noInk);
  ordered.forEach((entry, i) => houses.push(buildHouseOnPath(entry, i)));

  // cima: templo de la diosa y su estatua delante
  const summit = mountain.summit;
  const face = Math.atan2(CAM_HOME.x - summit.x, CAM_HOME.z - summit.z);
  const shrine = buildHouse('default', { mats, color: '#ffd77a', glyph: '✦' });
  shrine.group.position.copy(summit).add(new THREE.Vector3(0, 0, -4));
  shrine.group.rotation.y = face;
  scene.add(shrine.group);
  animated.push(shrine.door.material);
  shrine.group.traverse((o) => { if (o.userData.noInk) noInk.push(o); });
  const statue = goddessStatue(mats);
  statue.position.copy(summit).add(new THREE.Vector3(0, 0, 4.5));
  statue.rotation.y = face;
  scene.add(statue);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: '#ffd77a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
  halo.scale.set(22, 22, 1);
  halo.position.copy(summit).add(new THREE.Vector3(0, 7, 2));
  scene.add(halo);
  noInk.push(halo);

  buildMenu();
  camera.lookAt(controls.target);
  intro.from.copy(camera.position);
  if (dbgAt !== null) intro.t = 1;
  tick();
  requestAnimationFrame(() => loader.classList.add('done'));
}

start();

// Enlace directo: ?portal=<id> entra en esa casa al terminar la entrada.
const deep = new URLSearchParams(window.location.search).get('portal');
if (deep) {
  const wait = () => {
    const i = houses.findIndex((h) => h.project.id === deep);
    if (intro || i < 0) { if (houses.length === 0 || intro) requestAnimationFrame(wait); return; }
    enter(i);
  };
  requestAnimationFrame(wait);
}
