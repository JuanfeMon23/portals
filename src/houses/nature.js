import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Generador pseudoaleatorio con semilla (resultados estables entre recargas).
export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Ruido 3D barato a base de senos, suficiente para deformar formas orgánicas.
function n3(x, y, z, s) {
  return (
    Math.sin(x * 1.7 + s) * Math.sin(y * 2.3 + s * 1.3) * Math.sin(z * 1.9 + s * 0.7) +
    0.5 * Math.sin(x * 3.7 + s * 2.1) * Math.sin(y * 4.1 + s) * Math.sin(z * 3.3 + s * 1.7) +
    0.25 * Math.sin(x * 7.9 + s) * Math.sin(y * 8.3 + s * 0.3) * Math.sin(z * 7.1 + s * 2.9)
  );
}

function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    fn(col, p.getX(k), p.getY(k), p.getZ(k), n.getX(k), n.getY(k), n.getZ(k));
    c.set([col.r, col.g, col.b], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}

function displace(geo, fn) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k);
    fn(v);
    p.setXYZ(k, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Deja solo posición, normal y color para poder fusionar piezas distintas.
const clean = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(name)) out.deleteAttribute(name);
  return out;
};

// ---------- Rocas: icosfera tallada, base plana, musgo arriba ----------
export function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 2);
  displace(g, (v) => {
    const r = 1 + 0.32 * n3(v.x * 1.4, v.y * 1.4, v.z * 1.4, seed) + 0.12 * Math.abs(n3(v.x * 4, v.y * 4, v.z * 4, seed * 3));
    v.multiplyScalar(r);
    v.y *= 0.72;
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.25;
    // estratos
    v.y += Math.sin(v.y * 9 + seed) * 0.03;
  });
  const stone = new THREE.Color('#77738c'), dark = new THREE.Color('#3f3b52'), moss = new THREE.Color('#4f6b45');
  return paint(g, (c, x, y, z, nx, ny) => {
    c.copy(stone).lerp(dark, Math.max(0, -y * 1.2) + 0.25 * (0.5 + 0.5 * Math.sin(x * 6 + z * 5 + seed)));
    if (ny > 0.55) c.lerp(moss, Math.min(1, (ny - 0.55) * 2.2) * (0.5 + 0.5 * Math.sin(x * 3 + seed)));
  });
}

// ---------- Ciprés: columna de cúmulos de follaje ----------
export function cypressGeometry(seed) {
  const rand = seeded(seed * 991 + 7);
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.1, 0.18, 1.4, 6).translate(0, 0.7, 0);
  paint(trunk, (c) => c.set('#3a2a22'));
  parts.push(trunk);
  const layers = 7;
  const lean = (rand() - 0.5) * 0.25;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const r = 0.95 * (1 - t * 0.75) + 0.12;
    const blob = new THREE.SphereGeometry(r, 9, 7);
    const s = seed * 13 + k * 5.1;
    displace(blob, (v) => {
      const d = 1 + 0.28 * n3(v.x * 3, v.y * 3, v.z * 3, s);
      v.multiplyScalar(d);
      v.y *= 1.45;
    });
    blob.translate((rand() - 0.5) * 0.15 + lean * t * 2, 1.4 + t * 5.2, (rand() - 0.5) * 0.15);
    parts.push(paint(blob, (c, x, y, z, nx, ny) => {
      const tip = 0.5 + 0.5 * Math.sin(x * 9 + y * 7 + z * 8 + s);
      c.set('#1f3a33').lerp(new THREE.Color('#3f6a4c'), tip * 0.55 + Math.max(0, ny) * 0.25 + t * 0.15);
    }));
  }
  return mergeGeometries(parts.map(clean), false);
}

// ---------- Olivo: tronco retorcido con ramas y copas en racimos ----------
export function oliveGeometry(seed) {
  const rand = seeded(seed * 557 + 3);
  const parts = [];
  const bark = (g) => paint(g, (c, x, y) => c.set('#4a3a2e').lerp(new THREE.Color('#2c211b'), 0.5 + 0.5 * Math.sin(y * 14 + x * 9)));
  const base = new THREE.Vector3(0, 0, 0);
  const fork = new THREE.Vector3((rand() - 0.5) * 0.6, 1.5 + rand() * 0.4, (rand() - 0.5) * 0.6);
  parts.push(bark(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, new THREE.Vector3(0.2, 0.7, -0.1), fork]), 10, 0.2, 6)));
  const tips = [];
  const branches = 3 + Math.floor(rand() * 2);
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + rand();
    const tip = fork.clone().add(new THREE.Vector3(Math.cos(a) * (0.9 + rand() * 0.5), 0.6 + rand() * 0.6, Math.sin(a) * (0.9 + rand() * 0.5)));
    const mid = fork.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.15, 0));
    parts.push(bark(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([fork, mid, tip]), 6, 0.09, 5)));
    tips.push(tip);
  }
  tips.push(fork.clone().add(new THREE.Vector3(0, 1.2, 0)));
  const leafA = new THREE.Color('#465f4a'), leafB = new THREE.Color('#7d9a82');
  tips.forEach((tip, i) => {
    const r = 0.75 + rand() * 0.4;
    const blob = new THREE.SphereGeometry(r, 10, 8);
    const s = seed * 7 + i * 3.3;
    displace(blob, (v) => { v.multiplyScalar(1 + 0.3 * n3(v.x * 3.2, v.y * 3.2, v.z * 3.2, s)); v.y *= 0.75; });
    blob.translate(tip.x, tip.y + 0.2, tip.z);
    parts.push(paint(blob, (c, x, y, z, nx, ny) => c.copy(leafA).lerp(leafB, Math.max(0, ny) * 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(x * 11 + y * 9 + z * 10 + s)))));
  });
  return mergeGeometries(parts.map(clean), false);
}

// ---------- Arbusto ----------
export function bushGeometry(seed) {
  const rand = seeded(seed * 211 + 1);
  const parts = [];
  for (let k = 0; k < 4; k++) {
    const blob = new THREE.SphereGeometry(0.45 + rand() * 0.25, 8, 6);
    const s = seed + k * 2.7;
    displace(blob, (v) => { v.multiplyScalar(1 + 0.3 * n3(v.x * 4, v.y * 4, v.z * 4, s)); v.y *= 0.8; });
    blob.translate((rand() - 0.5) * 0.9, 0.35 + rand() * 0.2, (rand() - 0.5) * 0.9);
    parts.push(paint(blob, (c, x, y, z, nx, ny) => c.set('#2e4a3c').lerp(new THREE.Color('#5d7d55'), Math.max(0, ny) * 0.6)));
  }
  return mergeGeometries(parts.map(clean), false);
}

// ---------- Pasto: matas de hojas planas cruzadas ----------
export function grassTuftGeometry() {
  const parts = [];
  for (let k = 0; k < 7; k++) {
    const h = 0.35 + (k % 3) * 0.15;
    const blade = new THREE.BufferGeometry();
    const a = (k / 7) * Math.PI * 2, r = 0.12;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const lean = 0.18;
    blade.setAttribute('position', new THREE.Float32BufferAttribute([
      bx - 0.03, 0, bz, bx + 0.03, 0, bz, bx + Math.cos(a) * lean, h, bz + Math.sin(a) * lean,
    ], 3));
    blade.computeVertexNormals();
    blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    parts.push(paint(blade, (c, x, y) => c.set('#2f4a3a').lerp(new THREE.Color('#a7b98a'), Math.pow(y / h, 0.8))));
  }
  return mergeGeometries(parts.map(clean), false);
}

// ---------- Ruinas ----------
export function brokenColumnGeometry(seed, height) {
  const r = 0.34;
  const g = new THREE.CylinderGeometry(r * 0.92, r, height, 36, 6, false);
  g.translate(0, height / 2, 0);
  displace(g, (v) => {
    const rad = Math.hypot(v.x, v.z);
    if (rad > 1e-4) {
      const a = Math.atan2(v.z, v.x);
      const f = 1 - 0.08 * Math.pow(0.5 + 0.5 * Math.cos(a * 18), 2);
      v.x *= f; v.z *= f;
    }
    // borde superior roto
    if (v.y > height - 0.01) v.y = height - 0.05 - Math.abs(n3(v.x * 6, 0, v.z * 6, seed)) * 0.55;
  });
  const base = new THREE.BoxGeometry(r * 2.7, r * 0.5, r * 2.7).translate(0, r * 0.25, 0);
  const marble = new THREE.Color('#d9d6e4'), stain = new THREE.Color('#8e8aa0'), moss = new THREE.Color('#5d7552');
  const tint = (geo) => paint(geo, (c, x, y, z) => {
    c.copy(marble).lerp(stain, 0.35 * (0.5 + 0.5 * Math.sin(y * 5 + x * 7 + seed)));
    if (y < 0.5) c.lerp(moss, (0.5 - y) * 0.9);
  });
  return mergeGeometries([tint(g), tint(base)].map(clean), false);
}

export function drumGeometry(seed) {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.7, 28, 1);
  displace(g, (v) => { v.x *= 1 + 0.03 * n3(v.x * 5, v.y * 5, v.z * 5, seed); v.z *= 1 + 0.03 * n3(v.z * 5, v.y * 5, v.x * 5, seed); });
  return clean(paint(g, (c, x, y, z) => c.set('#cfccdc').lerp(new THREE.Color('#7e7a92'), 0.4 * (0.5 + 0.5 * Math.sin(x * 9 + z * 7 + seed)))));
}

export function blockGeometry(seed) {
  const g = new THREE.BoxGeometry(0.9, 0.45, 0.55, 3, 2, 2);
  displace(g, (v) => { v.addScalar(0); v.x += n3(v.x * 3, v.y * 3, v.z * 3, seed) * 0.04; v.y += n3(v.y * 3, v.z * 3, v.x * 3, seed) * 0.04; });
  return clean(paint(g, (c, x, y, z, nx, ny) => c.set('#bdb8cc').lerp(new THREE.Color('#5d7552'), ny > 0.6 ? 0.35 : 0).lerp(new THREE.Color('#6d6982'), 0.3 * (0.5 + 0.5 * Math.sin(x * 11 + z * 13 + seed)))));
}

// ---------- Texturas místicas ----------
export function magicCircleTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  for (const [r, w] of [[240, 4], [222, 2], [160, 3], [146, 1.5], [70, 2]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke(); }
  // runas entre anillos
  ctx.font = '26px "Segoe UI Symbol", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const runes = '♈♉♊♋♌♍♎♏♐♑♒♓';
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ctx.save(); ctx.translate(cx + Math.cos(a) * 191, cx + Math.sin(a) * 191); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(runes[k % 12] + '︎', 0, 0); ctx.restore();
  }
  // estrella de seis puntas
  ctx.lineWidth = 2;
  for (const off of [0, Math.PI / 3]) {
    ctx.beginPath();
    for (let k = 0; k <= 3; k++) { const a = off + (k / 3) * Math.PI * 2 - Math.PI / 2; const x = cx + Math.cos(a) * 146, y = cx + Math.sin(a) * 146; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Neblina animada: plano con ruido que se desplaza, siempre mirando a la cámara.
export function mistMaterial(color, opacity) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uSeed: { value: Math.random() * 50 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uOpacity, uSeed; uniform vec3 uColor; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; } return v; }
      void main(){
        vec2 p = vUv*vec2(3.0, 1.2) + vec2(uSeed + uTime*0.012, uTime*0.004);
        float n = fbm(p + fbm(p*1.7 + uTime*0.01));
        float edge = smoothstep(0.0, 0.3, vUv.x)*smoothstep(1.0, 0.7, vUv.x)*smoothstep(0.0, 0.35, vUv.y)*smoothstep(1.0, 0.55, vUv.y);
        float a = smoothstep(0.35, 0.8, n)*edge*uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
}
