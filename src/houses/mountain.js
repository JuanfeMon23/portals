import * as THREE from 'three';
import { rockGeometry, cypressGeometry, oliveGeometry, bushGeometry, grassTuftGeometry, brokenColumnGeometry, drumGeometry, blockGeometry, mistMaterial } from './nature.js';

// ---------- Ruido ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
function fbm(x, z, oct = 5) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return v; }
function ridged(x, z, oct = 5) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(vnoise(x * f, z * f) * 2 - 1); v += n * n * a; f *= 2.1; a *= 0.5; } return v; }

// ---------- Forma de la montaña ----------
const PEAK = 72, ZC = -40, RAD = 92;
function baseHeight(x, z) {
  const d = Math.hypot(x / 1.35, z - ZC);
  const t = Math.max(0, 1 - d / RAD);
  let h = PEAK * Math.pow(t, 1.75);
  // crestas y acantilados más marcados hacia la cima
  h += ridged(x * 0.035 + 3, z * 0.035) * 17 * (0.2 + t);
  h += Math.max(0, ridged(x * 0.08, z * 0.08) - 0.45) * 12 * t;
  h += fbm(x * 0.09, z * 0.09) * 2.2;
  h += fbm(x * 0.016 + 7, z * 0.016) * 7 - 3;
  return h;
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------- Texturas ----------
function canvasTex(w, h, draw, repeat) {
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
function grainTexture() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d0d0d0'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 6, v = Math.floor(140 + Math.random() * 115);
      ctx.strokeStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - l); ctx.stroke();
    }
    for (let i = 0; i < 5000; i++) { const v = Math.floor(120 + Math.random() * 135); ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  }, [70, 70]);
}
function dirtTexture() {
  return canvasTex(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a5c3c'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const v = 90 + Math.random() * 90;
      ctx.fillStyle = `rgba(${v + 30},${v + 10},${v - 20},0.6)`;
      ctx.beginPath(); ctx.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(40,25,10,0.35)';
    ctx.fillRect(0, 0, 10, h); ctx.fillRect(w - 10, 0, 10, h);
  }, [1, 1]);
}
// ---------- Construcción ----------
// Devuelve el terreno, el sendero, los puntos de cada casa y la cima.
export function buildMountain({ houseCount, mats, reduced }) {
  const group = new THREE.Group();
  const animated = [];
  const noInk = [];

  // 1. Sendero en zigzag: pasa por una terraza por casa, alternando lados, hasta la cima.
  const spots = [];
  for (let i = 0; i < houseCount; i++) {
    const t = (i + 0.5) / houseCount;
    const side = i % 2 === 0 ? -1 : 1;
    spots.push(new THREE.Vector3(side * THREE.MathUtils.lerp(27, 11, t), 0, THREE.MathUtils.lerp(30, -30, t)));
  }
  const summitXZ = new THREE.Vector3(0, 0, ZC + 2);
  const ctrl = [new THREE.Vector3(4, 0, 58), new THREE.Vector3(10, 0, 44)];
  spots.forEach((s, i) => {
    ctrl.push(s.clone());
    const next = i < spots.length - 1 ? spots[i + 1] : summitXZ;
    const mid = s.clone().lerp(next, 0.5);
    mid.x += Math.sin(i * 2.3) * 6;
    mid.z += Math.cos(i * 1.7) * 3;
    ctrl.push(mid);
  });
  ctrl.push(summitXZ);
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
  const N = 700;
  const pts = curve.getSpacedPoints(N);
  // alturas del sendero: terreno suavizado y siempre subiendo
  let ys = pts.map((p) => baseHeight(p.x, p.z));
  for (let pass = 0; pass < 3; pass++) ys = ys.map((_, i) => { let s = 0, c = 0; for (let k = -12; k <= 12; k++) { const j = i + k; if (j >= 0 && j <= N) { s += ys[j]; c++; } } return s / c; });
  for (let i = 1; i <= N; i++) ys[i] = Math.max(ys[i], ys[i - 1]);
  pts.forEach((p, i) => { p.y = ys[i]; });

  const nearestIdx = (v) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const d = (p.x - v.x) ** 2 + (p.z - v.z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  const houses = spots.map((s) => {
    const y = pts[nearestIdx(s)].y;
    return { center: new THREE.Vector3(s.x, y, s.z - 4), pathPoint: new THREE.Vector3(s.x, y, s.z) };
  });
  const summit = new THREE.Vector3(summitXZ.x, pts[N].y + 0.5, summitXZ.z - 4);

  // índice espacial del sendero para buscar distancias rápido
  const CELL = 6, grid = new Map();
  const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  pts.forEach((p, i) => { const k = key(p.x, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  function pathDist(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    let bd = Infinity, by = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const list = grid.get(`${cx + a},${cz + b}`);
      if (!list) continue;
      for (const i of list) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; by = pts[i].y; } }
    }
    return { d: Math.sqrt(bd), y: by };
  }
  const plateaus = [...houses.map((h) => ({ c: h.center, r: 10.5 })), { c: summit, r: 11 }];

  function finalHeight(x, z) {
    let h = baseHeight(x, z);
    const p = pathDist(x, z);
    if (p.d < 5.5) h = THREE.MathUtils.lerp(p.y - 0.2, h, smooth(2.0, 5.5, p.d));
    for (const pl of plateaus) {
      const d = Math.hypot(x - pl.c.x, z - pl.c.z);
      if (d < pl.r + 5) h = THREE.MathUtils.lerp(pl.c.y - 0.05, h, smooth(pl.r, pl.r + 5, d));
    }
    return { h, path: p.d };
  }

  // 2. Terreno
  const W = 240, D = 200, SX = 240, SZ = 200, Z0 = -15;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, Z0);
  const pos = geo.attributes.position;
  const heights = new Float32Array(pos.count);
  const pathD = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) {
    const r = finalHeight(pos.getX(k), pos.getZ(k));
    heights[k] = r.h; pathD[k] = r.path;
    pos.setY(k, r.h);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color('#2f4a46'), cGrass2 = new THREE.Color('#3d5a3c'), cRock = new THREE.Color('#5d5873'), cRockHi = new THREE.Color('#8a87a6'), cDirt = new THREE.Color('#6e5238'), cStone = new THREE.Color('#8b8698'), cDry = new THREE.Color('#5d5a3e'), cStrata = new THREE.Color('#3e3a52');
  const col = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k), y = heights[k];
    const slope = 1 - nrm.getY(k);
    col.copy(cGrass).lerp(cGrass2, fbm(x * 0.05, z * 0.05));
    col.lerp(cDry, smooth(0.55, 0.8, fbm(x * 0.03 + 9, z * 0.03)) * 0.6);
    col.lerp(cRock, smooth(0.12, 0.35, slope));
    // estratos en la roca
    col.lerp(cStrata, smooth(0.2, 0.45, slope) * (0.5 + 0.5 * Math.sin(y * 2.2 + fbm(x * 0.1, z * 0.1) * 5)) * 0.45);
    // oclusión: los pliegues cóncavos más oscuros
    const ix = k % (SX + 1), iz = Math.floor(k / (SX + 1));
    let avg = 0, cnt = 0;
    for (const [da, db] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { const jx = ix + da, jz = iz + db; if (jx >= 0 && jx <= SX && jz >= 0 && jz <= SZ) { avg += heights[jz * (SX + 1) + jx]; cnt++; } }
    const concave = cnt ? avg / cnt - y : 0;
    col.multiplyScalar(1 - THREE.MathUtils.clamp(concave * 0.35, 0, 0.45));
    // grano fino: manchas de pasto, tierra y musgo
    col.multiplyScalar(0.86 + 0.28 * fbm(x * 0.35, z * 0.35, 3));
    col.lerp(cRockHi, smooth(30, 60, y) * 0.6);
    col.lerp(cDirt, 1 - smooth(1.6, 3.2, pathD[k]));
    for (const pl of plateaus) if (Math.hypot(x - pl.c.x, z - pl.c.z) < pl.r - 0.5) col.lerp(cStone, 0.8);
    colors.set([col.r, col.g, col.b], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrainMat = new THREE.MeshToonMaterial({ vertexColors: true, map: grainTexture(), gradientMap: mats.gradient });
  const terrain = new THREE.Mesh(geo, terrainMat);
  group.add(terrain);

  // altura del terreno por interpolación bilineal de la malla
  function sampleHeight(x, z) {
    const gx = ((x + W / 2) / W) * SX, gz = ((z - Z0 + D / 2) / D) * SZ;
    const ix = Math.min(SX - 1, Math.max(0, Math.floor(gx))), iz = Math.min(SZ - 1, Math.max(0, Math.floor(gz)));
    const fx = gx - ix, fz = gz - iz;
    const at = (a, b) => heights[b * (SX + 1) + a];
    return (at(ix, iz) * (1 - fx) + at(ix + 1, iz) * fx) * (1 - fz) + (at(ix, iz + 1) * (1 - fx) + at(ix + 1, iz + 1) * fx) * fz;
  }

  // 3. Cinta del sendero de tierra
  {
    const half = 1.3;
    const verts = [], uvs = [], idx = [];
    let along = 0;
    for (let i = 0; i <= N; i++) {
      const p = pts[i];
      const q = pts[Math.min(N, i + 1)], o = pts[Math.max(0, i - 1)];
      const tx = q.x - o.x, tz = q.z - o.z, tl = Math.hypot(tx, tz) || 1;
      const nx = -tz / tl, nz = tx / tl;
      if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
      for (const s of [-1, 1]) {
        const x = p.x + nx * half * s, z = p.z + nz * half * s;
        verts.push(x, sampleHeight(x, z) + 0.07, z);
        uvs.push(s < 0 ? 0 : 1, along / 4);
      }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: dirtTexture(), gradientMap: mats.gradient, polygonOffset: true, polygonOffsetFactor: -2 })));
  }

  // 4. Dispersión: árboles, rocas y ruinas fuera del sendero y de las terrazas
  const rand = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  function scatter(count, accept, minPath = 3.2) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const x = (rand() - 0.5) * W * 0.9, z = Z0 + (rand() - 0.5) * D * 0.9;
      const y = sampleHeight(x, z);
      const pd = pathDist(x, z).d;
      if (pd < minPath) continue;
      if (plateaus.some((pl) => Math.hypot(x - pl.c.x, z - pl.c.z) < pl.r + 1.5)) continue;
      const slope = Math.abs(sampleHeight(x + 1, z) - y) + Math.abs(sampleHeight(x, z + 1) - y);
      if (!accept({ x, y, z, slope, pd })) continue;
      out.push(new THREE.Vector3(x, y, z));
    }
    return out;
  }
  function instanced(geom, mat, points, scaleFn, tilt = 0) {
    const inst = new THREE.InstancedMesh(geom, mat, points.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    points.forEach((p, k) => {
      const sc = scaleFn();
      q.setFromEuler(e.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt));
      inst.setMatrixAt(k, m.compose(p, q, s.set(sc, sc * (0.85 + rand() * 0.4), sc)));
    });
    return inst;
  }
  const natMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: mats.gradient });
  const grassMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: mats.gradient, side: THREE.DoubleSide });
  // reparte los puntos entre variantes y da a cada ejemplar un tono propio
  function variants(geoms, points, scaleFn, { tilt = 0, sink = 0, mat = natMat, pose } = {}) {
    const buckets = geoms.map(() => []);
    points.forEach((pt) => buckets[Math.floor(rand() * geoms.length)].push(pt));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc3 = new THREE.Vector3(), c = new THREE.Color();
    buckets.forEach((list, gi) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(geoms[gi], mat, list.length);
      list.forEach((pt, k) => {
        const sc = scaleFn();
        if (pose) pose(e); else e.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt);
        q.setFromEuler(e);
        inst.setMatrixAt(k, m.compose(pt.clone().setY(pt.y - sink * sc), q, sc3.set(sc, sc * (0.85 + rand() * 0.35), sc)));
        const br = 0.8 + rand() * 0.32;
        c.setRGB(br * (0.94 + rand() * 0.12), br * (0.94 + rand() * 0.12), br * (0.94 + rand() * 0.12));
        inst.setColorAt(k, c);
      });
      group.add(inst);
    });
  }
  const cypressPts = scatter(reduced ? 120 : 320, ({ y, slope }) => slope < 1.6 && y < 46);
  const olivePts = scatter(reduced ? 70 : 200, ({ y, slope }) => slope < 1.2 && y < 32);
  const bushPts = scatter(reduced ? 150 : 480, ({ slope }) => slope < 1.8, 2.4);
  const grassPts = scatter(reduced ? 1200 : 5200, ({ y, slope }) => slope < 1.5 && y < 52, 1.7);
  const rockPts = scatter(reduced ? 90 : 300, ({ slope }) => slope > 0.45, 2.5);
  variants([0, 1, 2].map((k) => cypressGeometry(k + 1)), cypressPts, () => 0.9 + rand() * 0.8);
  variants([0, 1, 2].map((k) => oliveGeometry(k + 1)), olivePts, () => 0.8 + rand() * 0.6);
  variants([0, 1, 2].map((k) => bushGeometry(k + 1)), bushPts, () => 0.6 + rand() * 0.8);
  variants([grassTuftGeometry()], grassPts, () => 1.6 + rand() * 1.8, { mat: grassMat });
  variants([0, 1, 2, 3].map((k) => rockGeometry(k * 2.7 + 1)), rockPts, () => 0.35 + rand() ** 2 * 2.6, { tilt: 0.5, sink: 0.15 });

  // ruinas: grupos con columnas rotas, tambores caídos y bloques de sillar
  const colGeoms = [1.6, 2.6, 3.6, 4.6].map((h, k) => brokenColumnGeometry(k + 3, h));
  const ruinCols = [], drums = [], blocks = [];
  for (let i = 40; i < N - 30; i += 55) {
    const p = pts[i], q2 = pts[i + 1];
    const tx = q2.x - p.x, tz = q2.z - p.z, tl = Math.hypot(tx, tz) || 1;
    const side = (i / 55) % 2 < 1 ? 1 : -1;
    const cx = p.x - (tz / tl) * 6 * side, cz = p.z + (tx / tl) * 6 * side;
    if (plateaus.some((pl) => Math.hypot(cx - pl.c.x, cz - pl.c.z) < pl.r + 3)) continue;
    const at = (dx, dz) => new THREE.Vector3(cx + dx, sampleHeight(cx + dx, cz + dz), cz + dz);
    const cols = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < cols; k++) ruinCols.push(at((k - cols / 2) * 1.6 * (tx / tl), (k - cols / 2) * 1.6 * (tz / tl)));
    for (let k = 0; k < 2; k++) drums.push(at((rand() - 0.5) * 5, (rand() - 0.5) * 5).add(new THREE.Vector3(0, 0.3, 0)));
    for (let k = 0; k < 5; k++) blocks.push(at((rand() - 0.5) * 6, (rand() - 0.5) * 6).add(new THREE.Vector3(0, 0.18, 0)));
  }
  variants(colGeoms, ruinCols, () => 1, { pose: (e) => e.set((rand() - 0.5) * 0.12, rand() * Math.PI, (rand() - 0.5) * 0.12) });
  variants([drumGeometry(1), drumGeometry(2)], drums, () => 1, { pose: (e) => e.set(Math.PI / 2, rand() * Math.PI, 0) });
  variants([blockGeometry(1), blockGeometry(2), blockGeometry(3)], blocks, () => 0.8 + rand() * 0.6, { tilt: 0.4 });

  // 5. Antorchas a lo largo del sendero
  const torchPts = [];
  for (let i = 8; i < N; i += 14) {
    const p = pts[i], q = pts[Math.min(N, i + 1)];
    const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1;
    const s = (i / 14) % 2 < 1 ? 1 : -1;
    const x = p.x - (tz / tl) * 1.9 * s, z = p.z + (tx / tl) * 1.9 * s;
    if (plateaus.some((pl) => Math.hypot(x - pl.c.x, z - pl.c.z) < pl.r + 2)) continue;
    torchPts.push(new THREE.Vector3(x, sampleHeight(x, z), z));
  }
  const postMat = new THREE.MeshToonMaterial({ color: '#2a2230', gradientMap: mats.gradient });
  group.add(instanced(new THREE.CylinderGeometry(0.07, 0.1, 1.6, 6).translate(0, 0.8, 0), postMat, torchPts, () => 1));
  const flames = glowPoints(torchPts.map((p) => p.clone().setY(p.y + 1.75)), { color: '#ffb35a', size: 1000, flicker: 1 });
  group.add(flames); animated.push(flames.material); noInk.push(flames);

  // 6. Misticismo: fuegos fatuos, neblina en bandas y haz de luz en la cima
  const wispPts = [];
  for (let k = 0; k < (reduced ? 120 : 420); k++) {
    const i = Math.floor(rand() * N), p = pts[i];
    const x = p.x + (rand() - 0.5) * 24, z = p.z + (rand() - 0.5) * 24;
    wispPts.push(new THREE.Vector3(x, sampleHeight(x, z) + 0.5 + rand() * 6, z));
  }
  const wisps = glowPoints(wispPts, { color: '#7fe3ff', size: 380, drift: 1 });
  group.add(wisps); animated.push(wisps.material); noInk.push(wisps);

  const mists = [];
  for (let k = 0; k < (reduced ? 8 : 18); k++) {
    const band = k % 3;
    const mat = mistMaterial(band === 2 ? '#b9a6ff' : '#a8bcff', 0.32 + rand() * 0.2);
    const sc = 50 + rand() * 60;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * 0.4), mat);
    const ang = rand() * Math.PI * 2, r = 22 + rand() * 50;
    m.position.set(Math.cos(ang) * r, 3 + band * 15 + rand() * 6, ZC + 12 + Math.sin(ang) * r * 0.7);
    m.userData.baseX = m.position.x;
    m.userData.speed = (rand() - 0.5) * 0.6;
    group.add(m); mists.push(m); noInk.push(m); animated.push(mat);
  }

  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
      void main(){ float a = (1.0 - vUv.y)*(0.35 + 0.1*sin(uTime*1.5 + vUv.y*12.0))*(1.0 - abs(vUv.x - 0.5)*1.4);
        gl_FragColor = vec4(vec3(0.75, 0.82, 1.0)*a, a); }`,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 3.2, 120, 24, 1, true), beamMat);
  beam.position.copy(summit).add(new THREE.Vector3(0, 60, 0));
  group.add(beam); animated.push(beamMat); noInk.push(beam);

  // 7. Cordillera de fondo
  const back = new THREE.PlaneGeometry(900, 260, 220, 60);
  back.rotateX(-Math.PI / 2);
  const bp = back.attributes.position;
  for (let k = 0; k < bp.count; k++) {
    const x = bp.getX(k), z = bp.getZ(k);
    const edge = smooth(-130, 40, -z);
    bp.setY(k, (ridged(x * 0.012, z * 0.012) * 70 + fbm(x * 0.03, z * 0.03) * 10) * edge - 8);
  }
  back.computeVertexNormals();
  const range = new THREE.Mesh(back, new THREE.MeshToonMaterial({ color: '#2a2f55', gradientMap: mats.gradient }));
  range.position.set(0, -6, -190);
  group.add(range);

  function update(time, camera) {
    for (const m of mists) {
      m.position.x = m.userData.baseX + Math.sin(time * 0.05 + m.userData.speed * 10) * 8;
      // giro solo sobre el eje vertical: la neblina no se inclina con la cámara
      m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), 0);
    }
  }

  return { group, animated, noInk, houses, summit, sampleHeight, update, pathPoints: pts, mistMaterials: mists.map((m) => m.material) };
}

// Puntos luminosos aditivos (llamas de antorcha, fuegos fatuos).
function glowPoints(points, { color, size, flicker = 0, drift = 0 }) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const seed = new Float32Array(points.length).map(() => Math.random());
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uFlicker: { value: flicker }, uDrift: { value: drift }, uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uSize, uFlicker, uDrift, uPixel; varying float vA;
      void main(){
        vec3 p = position;
        p += uDrift*vec3(sin(uTime*0.5 + aSeed*40.0), sin(uTime*0.7 + aSeed*25.0)*0.6, cos(uTime*0.4 + aSeed*30.0))*1.2;
        vA = mix(0.5 + 0.5*sin(uTime*1.5 + aSeed*60.0), 0.75 + 0.25*sin(uTime*13.0 + aSeed*90.0), uFlicker);
        vec4 mv = modelViewMatrix*vec4(p, 1.0);
        gl_PointSize = uSize*(0.6 + aSeed*0.6)*uPixel/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4((uColor*1.8 + core*core*0.6)*core*vA, core*vA); }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
