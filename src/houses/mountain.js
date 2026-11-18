import * as THREE from 'three';

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
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 150 + Math.random() * 105;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }, [60, 60]);
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
function mistTexture() {
  const t = canvasTex(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (Math.random() - 0.5) * w * 0.55, y = h / 2 + (Math.random() - 0.5) * h * 0.3;
      const r = 30 + Math.random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  }, [1, 1]);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
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
  const cGrass = new THREE.Color('#2f4a46'), cGrass2 = new THREE.Color('#3d5a3c'), cRock = new THREE.Color('#5d5873'), cRockHi = new THREE.Color('#8a87a6'), cDirt = new THREE.Color('#6e5238'), cStone = new THREE.Color('#8b8698');
  const col = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), z = pos.getZ(k), y = heights[k];
    const slope = 1 - nrm.getY(k);
    col.copy(cGrass).lerp(cGrass2, fbm(x * 0.05, z * 0.05));
    col.lerp(cRock, smooth(0.12, 0.35, slope));
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
  function scatter(count, accept) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const x = (rand() - 0.5) * W * 0.9, z = Z0 + (rand() - 0.5) * D * 0.9;
      const y = sampleHeight(x, z);
      const pd = pathDist(x, z).d;
      if (pd < 3.2) continue;
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
  const leafMat = new THREE.MeshToonMaterial({ color: '#2a4a40', gradientMap: mats.gradient });
  const leafMat2 = new THREE.MeshToonMaterial({ color: '#36533a', gradientMap: mats.gradient });
  const trunkMat = new THREE.MeshToonMaterial({ color: '#3b2a20', gradientMap: mats.gradient });
  const cypressTrunk = new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0);
  const cypressCrown = new THREE.ConeGeometry(0.75, 5.5, 10, 3).translate(0, 3.6, 0);
  const olive = new THREE.SphereGeometry(1.6, 12, 8).scale(1, 0.75, 1).translate(0, 2.2, 0);
  const oliveTrunk = new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6).translate(0, 0.8, 0);
  const lowTrees = scatter(reduced ? 120 : 320, ({ y, slope }) => slope < 1.6 && y < 40);
  const roundTrees = scatter(reduced ? 80 : 240, ({ y, slope }) => slope < 1.2 && y < 30);
  const cs = () => 1.0 + rand() * 0.9, os = () => 0.8 + rand() * 0.7;
  // misma escala para tronco y copa de cada árbol
  const scaleFrom = (list, fn) => list.map(() => fn());
  const cScales = scaleFrom(lowTrees, cs), oScales = scaleFrom(roundTrees, os);
  const fromList = (list) => { let k = 0; return () => list[k++]; };
  group.add(instanced(cypressCrown, leafMat, lowTrees, fromList(cScales)));
  group.add(instanced(cypressTrunk, trunkMat, lowTrees, fromList(cScales)));
  group.add(instanced(olive, leafMat2, roundTrees, fromList(oScales)));
  group.add(instanced(oliveTrunk, trunkMat, roundTrees, fromList(oScales)));

  const rockPts = scatter(reduced ? 80 : 220, ({ slope }) => slope > 0.6);
  const stoneMat = new THREE.MeshToonMaterial({ color: '#6c6884', gradientMap: mats.gradient });
  group.add(instanced(new THREE.DodecahedronGeometry(1, 0), stoneMat, rockPts.map((p) => p.clone().setY(p.y + 0.2)), () => 0.4 + rand() ** 2 * 2.2, 1));

  // ruinas: columnas rotas y caídas junto al sendero
  const ruinPts = [];
  for (let i = 25; i < N - 25; i += 23) {
    const p = pts[i], q = pts[i + 1];
    const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1;
    const s = i % 2 ? 1 : -1;
    const x = p.x - (tz / tl) * 3.6 * s, z = p.z + (tx / tl) * 3.6 * s;
    if (plateaus.some((pl) => Math.hypot(x - pl.c.x, z - pl.c.z) < pl.r + 1)) continue;
    ruinPts.push(new THREE.Vector3(x, sampleHeight(x, z), z));
  }
  const ruinGeo = new THREE.CylinderGeometry(0.32, 0.36, 1, 14).translate(0, 0.5, 0);
  const ruins = new THREE.InstancedMesh(ruinGeo, mats.marble, ruinPts.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
    ruinPts.forEach((p, k) => {
      const fallen = rand() < 0.35;
      q.setFromEuler(e.set(fallen ? Math.PI / 2 : 0, rand() * Math.PI, 0));
      const hgt = fallen ? 2 + rand() * 2 : 0.8 + rand() * 3;
      ruins.setMatrixAt(k, m.compose(fallen ? p.clone().setY(p.y + 0.35) : p, q, s.set(1, hgt, 1)));
    });
  }
  group.add(ruins);

  // 5. Antorchas a lo largo del sendero
  const torchPts = [];
  for (let i = 8; i < N; i += 14) {
    const p = pts[i], q = pts[Math.min(N, i + 1)];
    const tx = q.x - p.x, tz = q.z - p.z, tl = Math.hypot(tx, tz) || 1;
    const s = (i / 14) % 2 < 1 ? 1 : -1;
    const x = p.x - (tz / tl) * 1.9 * s, z = p.z + (tx / tl) * 1.9 * s;
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

  const mistTex = mistTexture();
  const mists = [];
  for (let k = 0; k < (reduced ? 10 : 26); k++) {
    const band = k % 3;
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: band === 2 ? '#b9a6ff' : '#9fb4ff', transparent: true, depthWrite: false, opacity: 0.18 + rand() * 0.14, fog: false }));
    const sc = 45 + rand() * 50;
    m.scale.set(sc, sc * 0.45, 1);
    const ang = rand() * Math.PI * 2, r = 25 + rand() * 50;
    m.position.set(Math.cos(ang) * r, 4 + band * 16 + rand() * 6, ZC + 10 + Math.sin(ang) * r * 0.7);
    m.userData.speed = (rand() - 0.5) * 0.6;
    m.userData.baseX = m.position.x;
    group.add(m); mists.push(m); noInk.push(m);
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

  function update(time) {
    for (const m of mists) m.position.x = m.userData.baseX + Math.sin(time * 0.05 + m.userData.speed * 10) * 8;
  }

  return { group, animated, noInk, houses, summit, sampleHeight, update };
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
