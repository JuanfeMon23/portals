import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- Texturas de mármol ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function veins(ctx, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = `rgba(90,95,120,${Math.random() * alpha})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (Math.random() - 0.4) * 60; y += (Math.random() - 0.5) * 30; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

export function marbleTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#e9e6ee'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 200 + Math.random() * 55;
      ctx.fillStyle = `rgba(${v},${v},${v + 8},0.25)`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    veins(ctx, w, h, 22, 0.35);
  });
}

// Sillares (muros de bloques), como en las ilustraciones de referencia.
export function ashlarTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9a98a6'; ctx.fillRect(0, 0, w, h);
    const rowH = 32;
    for (let r = 0; r * rowH < h; r++) {
      let x = r % 2 ? -40 : 0;
      while (x < w) {
        const bw = 60 + Math.random() * 40;
        const v = 205 + Math.random() * 35;
        ctx.fillStyle = `rgb(${v},${v - 2},${v + 6})`;
        ctx.fillRect(x + 2, r * rowH + 2, bw - 4, rowH - 4);
        x += bw;
      }
    }
    veins(ctx, w, h, 14, 0.3);
  }, [2, 2]);
}

export function rockTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a5e3e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const v = 90 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v + 40},${v + 20},${v - 10},0.5)`;
      ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 6 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    for (let i = 0; i < 40; i++) {
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath(); let x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 70; y += Math.random() * 50; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }, [3, 2]);
}

export function glyphTexture(glyph, color) {
  const t = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '170px "Segoe UI Symbol", "Noto Sans Symbols", "DejaVu Sans", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffd77a';
    ctx.fillText(glyph + '︎', w / 2, h / 2 + 8);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- Puerta luminosa (el portal de cada casa) ----------
export function doorMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uHover: { value: 0 }, uBoost: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uHover, uBoost; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv - vec2(0.5, 0.35);
        float d = length(p*vec2(1.6, 1.0));
        float glow = exp(-d*3.2)*(0.55 + 0.25*sin(uTime*2.0) + uHover*0.7 + uBoost*3.0);
        float rays = 0.5 + 0.5*sin(atan(p.y, p.x)*9.0 + uTime*1.5);
        vec3 col = vec3(0.02, 0.01, 0.04) + uColor*glow*(1.2 + rays*0.4) + vec3(1.0)*pow(glow, 3.0)*0.5;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ---------- Piezas ----------
// ---------- Columnas: fuste estriado + basa ática + capitel, fusionados e instanciados ----------
function flutedShaft(h, r, flutes = 20) {
  const g = new THREE.CylinderGeometry(r * 0.86, r, h, flutes * 3, 10);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), z = p.getZ(k);
    if (Math.hypot(x, z) < 1e-4) continue;
    const a = Math.atan2(z, x);
    const f = 1 - 0.07 * Math.pow(0.5 + 0.5 * Math.cos(a * flutes), 2);
    p.setX(k, x * f); p.setZ(k, z * f);
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

const at = (geo, x, y, z) => geo.translate(x, y, z);

function atticBase(r) {
  return [
    at(new THREE.BoxGeometry(r * 2.6, r * 0.35, r * 2.6), 0, r * 0.175, 0),
    at(new THREE.TorusGeometry(r * 1.1, r * 0.16, 8, 24).rotateX(Math.PI / 2), 0, r * 0.47, 0),
    at(new THREE.TorusGeometry(r * 0.98, r * 0.11, 8, 24).rotateX(Math.PI / 2), 0, r * 0.74, 0),
  ];
}

function capital(order, h, r) {
  const parts = [];
  if (order === 'doric') {
    parts.push(at(new THREE.TorusGeometry(r * 0.9, r * 0.06, 6, 24).rotateX(Math.PI / 2), 0, h - r * 1.05, 0));
    parts.push(at(new THREE.CylinderGeometry(r * 1.32, r * 0.88, r * 0.5, 24), 0, h - r * 0.67, 0));
    parts.push(at(new THREE.BoxGeometry(r * 2.8, r * 0.4, r * 2.8), 0, h - r * 0.2, 0));
  } else if (order === 'ionic') {
    parts.push(at(new THREE.CylinderGeometry(r * 1.05, r * 0.88, r * 0.35, 24), 0, h - r * 0.6, 0));
    for (const s of [-1, 1]) {
      parts.push(at(new THREE.CylinderGeometry(r * 0.36, r * 0.36, r * 2.2, 16).rotateX(Math.PI / 2), s * r * 1.15, h - r * 0.52, 0));
      for (const fz of [-1, 1]) parts.push(at(new THREE.TorusGeometry(r * 0.24, r * 0.07, 6, 16), s * r * 1.15, h - r * 0.52, fz * r * 1.1));
    }
    parts.push(at(new THREE.BoxGeometry(r * 2.7, r * 0.22, r * 2.3), 0, h - r * 0.11, 0));
  } else {
    // corintio: campana con dos coronas de hojas
    parts.push(at(new THREE.CylinderGeometry(r * 1.25, r * 0.88, r * 1.3, 24), 0, h - r * 0.9, 0));
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + row * (Math.PI / 8);
        const leaf = new THREE.ConeGeometry(r * 0.24, r * (0.75 + row * 0.25), 5);
        leaf.rotateX(0.35).rotateY(-a + Math.PI / 2);
        const rr = r * (0.98 + row * 0.12);
        parts.push(at(leaf, Math.cos(a) * rr, h - r * (1.2 - row * 0.4), Math.sin(a) * rr));
      }
    }
    parts.push(at(new THREE.BoxGeometry(r * 2.8, r * 0.28, r * 2.8), 0, h - r * 0.14, 0));
  }
  return parts;
}

const columnCache = new Map();
function columnGeometry(order, h, r) {
  const key = `${order}:${h}:${r}`;
  if (!columnCache.has(key)) {
    const parts = [flutedShaft(h - r * 0.9, r), ...atticBase(r), ...capital(order, h, r)];
    parts[0].translate(0, r * 0.82, 0);
    columnCache.set(key, mergeGeometries(parts, false));
  }
  return columnCache.get(key);
}

function colonnade(positions, h, r, order, mat) {
  const inst = new THREE.InstancedMesh(columnGeometry(order, h, r), mat, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach((p, k) => inst.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z)));
  return inst;
}

// Fila de piezas repetidas (triglifos, dentículos) a lo largo de un segmento.
function repeatAlong(geo, mat, from, to, spacing) {
  const len = from.distanceTo(to);
  const count = Math.max(2, Math.floor(len / spacing));
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (let k = 0; k < count; k++) inst.setMatrixAt(k, m.makeTranslation(p.lerpVectors(from, to, (k + 0.5) / count)));
  return inst;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function stylobate(w, d, mats, tiers = 3, th = 0.4) {
  const g = new THREE.Group();
  for (let k = 0; k < tiers; k++) {
    const inset = (tiers - k) * 0.6;
    g.add(box(w + inset * 2, th, d + inset * 2, mats.marble, 0, th / 2 + k * th, 0));
  }
  return { group: g, top: tiers * th };
}

function frontStairs(width, height, z0, mats, steps = 6) {
  const g = new THREE.Group();
  const sh = height / steps, sd = 0.45;
  for (let k = 0; k < steps; k++) {
    g.add(box(width, sh * (k + 1), sd, mats.marble, 0, (sh * (k + 1)) / 2, z0 + (steps - k) * sd - sd / 2));
  }
  for (const s of [-1, 1]) g.add(box(0.4, height + 0.2, steps * sd, mats.marble, s * (width / 2 + 0.2), (height + 0.2) / 2, z0 + (steps * sd) / 2));
  return g;
}

function gableRoof(w, d, rise, mats) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, mats.marble);
}

// Cornisas inclinadas que enmarcan el tímpano, más acroteras.
function pedimentFrame(w, rise, z, y, mats, g) {
  const half = w / 2;
  const len = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) {
    const b = box(len + 0.3, 0.26, 0.45, mats.marble, s * half / 2, y + rise / 2 + 0.05, z);
    b.rotation.z = -s * ang;
    g.add(b);
  }
  const apex = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 8), mats.gold);
  apex.position.set(0, y + rise + 0.5, z);
  g.add(apex);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), mats.gold);
    c.position.set(s * half, y + 0.35, z);
    g.add(c);
  }
}

// Relieve del signo en el tímpano: textura del glifo como relieve dorado.
function glyphRelief(glyph, color, size, mats) {
  const tex = glyphTexture(glyph, color);
  const mat = new THREE.MeshToonMaterial({
    color: '#ffe6a8', alphaMap: tex, transparent: true, bumpMap: tex, bumpScale: 6,
    emissive: new THREE.Color(color), emissiveIntensity: 0.9, gradientMap: mats.gradient, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}

function lion(mats) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.5, 2.0, mats.marble, 0, 0.25, 0));
  const y0 = 0.5;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 6, 14), mats.marble);
  body.rotation.x = Math.PI / 2; body.position.set(0, y0 + 0.38, -0.15);
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), mats.marble);
  haunch.position.set(0, y0 + 0.4, -0.6);
  g.add(body, haunch);
  for (const s of [-1, 1]) {
    g.add(box(0.18, 0.5, 0.2, mats.marble, s * 0.2, y0 + 0.25, 0.5));
    g.add(box(0.22, 0.12, 0.34, mats.marble, s * 0.2, y0 + 0.06, 0.66));
  }
  // melena: esfera indexada con ondulación continua (sin facetas que la tinta remarque)
  const maneGeo = new THREE.SphereGeometry(0.5, 24, 16);
  const mp = maneGeo.attributes.position;
  for (let k = 0; k < mp.count; k++) {
    const x = mp.getX(k), y = mp.getY(k), z = mp.getZ(k);
    const j = 1 + 0.1 * Math.sin(x * 14) * Math.sin(y * 14) + 0.06 * Math.sin(z * 22);
    mp.setXYZ(k, x * j, y * j, z * j);
  }
  maneGeo.computeVertexNormals();
  const mane = new THREE.Mesh(maneGeo, mats.marble);
  mane.scale.set(1, 1, 0.75); mane.position.set(0, y0 + 0.95, 0.45);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mats.marble);
  head.position.set(0, y0 + 0.98, 0.72);
  const snout = box(0.24, 0.18, 0.22, mats.marble, 0, y0 + 0.88, 0.98);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, y0 + 0.4, -0.95), new THREE.Vector3(0.3, y0 + 0.15, -1.1), new THREE.Vector3(0.5, y0 + 0.08, -0.7),
  ]), 12, 0.05, 6), mats.marble);
  g.add(mane, head, snout, tail);
  return g;
}

// ---------- Templos ----------
const ORDER = { aries: 'ionic', taurus: 'doric', leo: 'corinthian', scorpio: 'doric', aquarius: 'ionic', pisces: 'corinthian', default: 'doric' };

function rectangularTemple({ w, d, colH, colR, front, side, prostyle, mats, color, glyph, order, dome = false, lions = false, roses = false }) {
  const g = new THREE.Group();
  const { group: base, top } = stylobate(w, d, mats);
  g.add(base);
  g.add(frontStairs(w * 0.45, top, d / 2 + 1.8, mats, 3));

  const xs = (n) => Array.from({ length: n }, (_, k) => -w / 2 + 0.55 + (k * (w - 1.1)) / (n - 1));
  const zs = (n) => Array.from({ length: n }, (_, k) => -d / 2 + 0.55 + (k * (d - 1.1)) / (n - 1));
  const cols = [];
  for (const x of xs(front)) cols.push(new THREE.Vector3(x, top, d / 2 - 0.55));
  if (prostyle) {
    cols.push(new THREE.Vector3(-w / 2 + 0.55, top, d / 2 - 2.0), new THREE.Vector3(w / 2 - 0.55, top, d / 2 - 2.0));
  } else {
    for (const x of xs(front)) cols.push(new THREE.Vector3(x, top, -d / 2 + 0.55));
    for (const z of zs(side).slice(1, -1)) cols.push(new THREE.Vector3(-w / 2 + 0.55, top, z), new THREE.Vector3(w / 2 - 0.55, top, z));
  }
  g.add(colonnade(cols, colH, colR, order, mats.marble));

  // cella con pilastras, marco de puerta y puerta luminosa
  const cw = prostyle ? w - 0.4 : w - 2.6;
  const cd = prostyle ? d - 3.0 : d - 3.2;
  const cz = prostyle ? -1.4 : 0;
  g.add(box(cw, colH, cd, mats.ashlar, 0, top + colH / 2, cz));
  for (const s of [-1, 1]) g.add(box(0.5, colH, 0.3, mats.marble, s * (cw / 2 - 0.2), top + colH / 2, cz + cd / 2 + 0.1));
  const doorH = colH * 0.62, doorW = Math.min(2.2, cw * 0.32);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), doorMaterial(color));
  door.position.set(0, top + doorH / 2, cz + cd / 2 + 0.02);
  g.add(door);
  for (const s of [-1, 1]) g.add(box(0.28, doorH + 0.2, 0.3, mats.marble, s * (doorW / 2 + 0.14), top + (doorH + 0.2) / 2, cz + cd / 2 + 0.1));
  g.add(box(doorW + 0.9, 0.4, 0.4, mats.marble, 0, top + doorH + 0.3, cz + cd / 2 + 0.12));

  // entablamento: arquitrabe, friso con triglifos, dentículos, cornisa
  const eY = top + colH;
  g.add(box(w + 0.1, 0.45, d + 0.1, mats.marble, 0, eY + 0.225, 0));
  g.add(box(w - 0.05, 0.42, d - 0.05, mats.ashlar, 0, eY + 0.66, 0));
  const tri = new THREE.BoxGeometry(0.26, 0.4, 0.08);
  const triS = new THREE.BoxGeometry(0.08, 0.4, 0.26);
  const fz = (d - 0.05) / 2 + 0.03, fx = (w - 0.05) / 2 + 0.03;
  g.add(repeatAlong(tri, mats.marble, new THREE.Vector3(-w / 2, eY + 0.66, fz), new THREE.Vector3(w / 2, eY + 0.66, fz), 0.7));
  g.add(repeatAlong(tri, mats.marble, new THREE.Vector3(-w / 2, eY + 0.66, -fz), new THREE.Vector3(w / 2, eY + 0.66, -fz), 0.7));
  g.add(repeatAlong(triS, mats.marble, new THREE.Vector3(fx, eY + 0.66, -d / 2), new THREE.Vector3(fx, eY + 0.66, d / 2), 0.7));
  g.add(repeatAlong(triS, mats.marble, new THREE.Vector3(-fx, eY + 0.66, -d / 2), new THREE.Vector3(-fx, eY + 0.66, d / 2), 0.7));
  const dent = new THREE.BoxGeometry(0.14, 0.12, 0.14);
  const dz = (d + 0.3) / 2, dx = (w + 0.3) / 2;
  g.add(repeatAlong(dent, mats.marble, new THREE.Vector3(-dx, eY + 0.93, dz), new THREE.Vector3(dx, eY + 0.93, dz), 0.3));
  g.add(repeatAlong(dent, mats.marble, new THREE.Vector3(-dx, eY + 0.93, -dz), new THREE.Vector3(dx, eY + 0.93, -dz), 0.3));
  g.add(repeatAlong(dent, mats.marble, new THREE.Vector3(dx, eY + 0.93, -dz), new THREE.Vector3(dx, eY + 0.93, dz), 0.3));
  g.add(repeatAlong(dent, mats.marble, new THREE.Vector3(-dx, eY + 0.93, -dz), new THREE.Vector3(-dx, eY + 0.93, dz), 0.3));
  g.add(box(w + 0.6, 0.22, d + 0.6, mats.marble, 0, eY + 1.1, 0));

  const rise = w * 0.2;
  const roofY = eY + 1.21;
  const roof = gableRoof(w + 0.5, d + 0.5, rise, mats);
  roof.position.y = roofY;
  g.add(roof);
  const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, d + 0.6, 8).rotateX(Math.PI / 2), mats.marble);
  ridge.position.y = roofY + rise;
  g.add(ridge);
  for (const z of [(d + 0.5) / 2 + 0.12, -(d + 0.5) / 2 - 0.12]) pedimentFrame(w + 0.5, rise, z, roofY, mats, g);
  const relief = glyphRelief(glyph, color, rise * 1.1, mats);
  relief.position.set(0, roofY + rise * 0.4, (d + 0.5) / 2 + 0.04);
  relief.userData.noInk = true;
  g.add(relief);
  let height = roofY + rise + 0.9;

  if (dome) {
    const dz0 = -d * 0.15;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.0, 24), mats.ashlar);
    drum.position.set(0, roofY + rise - 0.1, dz0);
    g.add(drum);
    g.add(colonnade(Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 1.5, roofY + rise - 0.6, dz0 + Math.sin(a) * 1.5);
    }), 1.0, 0.1, 'doric', mats.marble));
    const cup = new THREE.Mesh(new THREE.SphereGeometry(1.45, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.marble);
    cup.position.set(0, roofY + rise + 0.4, dz0);
    const finial = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 8), mats.gold);
    finial.position.set(0, roofY + rise + 2.1, dz0);
    g.add(cup, finial);
    height += 1.6;
  }
  if (lions) {
    for (const s of [-1, 1]) {
      const l = lion(mats);
      l.position.set(s * (w * 0.33), 0, d / 2 + 2.6);
      g.add(l);
    }
  }
  if (roses) {
    const roseMat = new THREE.MeshToonMaterial({ color: '#d0102a', emissive: '#4a0010', gradientMap: mats.gradient });
    const rose = new THREE.IcosahedronGeometry(0.11, 0);
    const inst = new THREE.InstancedMesh(rose, roseMat, 70);
    const m = new THREE.Matrix4();
    for (let k = 0; k < 70; k++) inst.setMatrixAt(k, m.makeTranslation((Math.random() - 0.5) * w * 0.95, 0.12, d / 2 + 0.4 + Math.random() * 3));
    g.add(inst);
  }
  return { group: g, door, height, width: w, depth: d };
}

function roundTemple({ mats, color, glyph, order }) {
  const g = new THREE.Group();
  const th = 0.4;
  for (let k = 0; k < 3; k++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(5.2 - k * 0.5, 5.4 - k * 0.5, th, 48), mats.marble);
    t.position.y = th / 2 + k * th;
    g.add(t);
  }
  const top = 3 * th;
  g.add(frontStairs(3, top, 4.6, mats, 3));
  const colH = 5.2;
  g.add(colonnade(Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 4.0, top, Math.sin(a) * 4.0);
  }), colH, 0.3, order, mats.marble));
  const cella = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, colH, 40), mats.ashlar);
  cella.position.y = top + colH / 2;
  g.add(cella);
  const doorH = colH * 0.62;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, doorH), doorMaterial(color));
  door.position.set(0, top + doorH / 2, 2.52);
  g.add(door);
  g.add(box(2.4, 0.35, 0.4, mats.marble, 0, top + doorH + 0.2, 2.6));
  const eY = top + colH;
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.5, 48), mats.marble);
  arch.position.y = eY + 0.25;
  const frieze = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.42, 48), mats.ashlar);
  frieze.position.y = eY + 0.71;
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(4.75, 4.75, 0.22, 48), mats.marble);
  cornice.position.y = eY + 1.03;
  g.add(arch, frieze, cornice);
  const dent = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), mats.marble, 80);
  const m = new THREE.Matrix4();
  for (let k = 0; k < 80; k++) { const a = (k / 80) * Math.PI * 2; dent.setMatrixAt(k, m.makeTranslation(Math.cos(a) * 4.62, eY + 0.88, Math.sin(a) * 4.62)); }
  g.add(dent);
  const domeY = eY + 1.14;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.3, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.marble);
  dome.scale.y = 0.62;
  dome.position.y = domeY;
  g.add(dome);
  // nervaduras de la cúpula
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const pts = Array.from({ length: 9 }, (_, j) => {
      const t = (j / 8) * (Math.PI / 2) * 0.93;
      return new THREE.Vector3(Math.cos(a) * Math.cos(t) * 4.35, domeY + Math.sin(t) * 4.3 * 0.62, Math.sin(a) * Math.cos(t) * 4.35);
    });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.08, 5), mats.marble));
  }
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 16), mats.marble);
  lantern.position.y = domeY + 4.3 * 0.62 + 0.35;
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 10), mats.gold);
  finial.position.y = lantern.position.y + 0.9;
  g.add(lantern, finial);
  const relief = glyphRelief(glyph, color, 1.3, mats);
  relief.position.set(0, eY + 0.71, 4.62);
  relief.userData.noInk = true;
  g.add(relief);
  return { group: g, door, height: finial.position.y + 0.5, width: 10.8, depth: 10.8 };
}

export function buildHouse(style, { mats, color, glyph }) {
  const order = ORDER[style] ?? ORDER.default;
  const common = { mats, color, glyph, order };
  switch (style) {
    case 'aries': return rectangularTemple({ w: 8, d: 9, colH: 4.8, colR: 0.3, front: 6, side: 7, dome: true, ...common });
    case 'taurus': return rectangularTemple({ w: 10.5, d: 9, colH: 5.2, colR: 0.42, front: 6, side: 6, ...common });
    case 'leo': return rectangularTemple({ w: 8.5, d: 10, colH: 5.4, colR: 0.32, front: 6, side: 7, lions: true, ...common });
    case 'scorpio': return rectangularTemple({ w: 8, d: 10, colH: 6, colR: 0.3, front: 4, side: 6, prostyle: true, ...common });
    case 'aquarius': return roundTemple(common);
    case 'pisces': return rectangularTemple({ w: 8, d: 9, colH: 5, colR: 0.3, front: 4, side: 6, prostyle: true, roses: true, ...common });
    default: return rectangularTemple({ w: 8, d: 9, colH: 5, colR: 0.3, front: 6, side: 7, ...common });
  }
}

// Estatua genérica de una diosa con escudo y lanza, en la cima.
export function goddessStatue(mats) {
  const g = new THREE.Group();
  g.add(box(3.2, 1.2, 3.2, mats.marble, 0, 0.6, 0), box(2.6, 0.5, 2.6, mats.marble, 0, 1.45, 0));
  const robe = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(1.0, 0), new THREE.Vector2(0.85, 1.5), new THREE.Vector2(0.62, 3.2),
    new THREE.Vector2(0.75, 3.9), new THREE.Vector2(0.4, 4.3), new THREE.Vector2(0, 4.35),
  ], 32), mats.marble);
  robe.position.y = 1.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mats.marble);
  head.position.y = 6.45;
  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 10), mats.gold);
  helm.position.set(0, 7.0, -0.1); helm.rotation.x = -0.5;
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.5, 6), mats.gold);
  spear.position.set(1.1, 5.2, 0.2);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), mats.gold);
  tip.position.set(1.1, 9.2, 0.2);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24), mats.gold);
  shield.rotation.z = Math.PI / 2; shield.rotation.y = 0.3;
  shield.position.set(-1.05, 3.6, 0.3);
  g.add(robe, head, helm, spear, tip, shield);
  return g;
}
