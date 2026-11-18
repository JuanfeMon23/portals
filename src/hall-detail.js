import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seeded, rockGeometry, mistMaterial } from './nature.js';

// ---------- Utilidades de geometría con color por vértice ----------
function tint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const c = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    fn(col, p.getX(k), p.getY(k), p.getZ(k), n.getY(k));
    c.set([col.r, col.g, col.b], k * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const clean = (g) => {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!['position', 'normal', 'color'].includes(name)) out.deleteAttribute(name);
  return out;
};
const merge = (parts) => mergeGeometries(parts.map(clean), false);

// ---------- Piezas de la sala ----------
function barrelGeometry() {
  const prof = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; prof.push(new THREE.Vector2(0.42 + Math.sin(t * Math.PI) * 0.09, t * 1.1)); }
  const body = tint(new THREE.LatheGeometry(prof, 18), (c, x, y, z) => {
    const a = Math.atan2(z, x);
    c.set('#6b4a2e').lerp(new THREE.Color('#3a2616'), 0.5 + 0.5 * Math.sin(a * 18) > 0.85 ? 0.7 : 0.15 * Math.sin(y * 9 + a * 3));
  });
  const lid = tint(new THREE.CircleGeometry(0.43, 18).rotateX(-Math.PI / 2).translate(0, 1.1, 0), (c) => c.set('#4a321e'));
  const bands = [0.18, 0.92].map((y) => tint(new THREE.TorusGeometry(0.48, 0.025, 6, 24).rotateX(Math.PI / 2).translate(0, y, 0), (c) => c.set('#2b2724')));
  return merge([body, lid, ...bands]);
}

function crateGeometry() {
  const box = tint(new THREE.BoxGeometry(1, 1, 1, 4, 4, 4).translate(0, 0.5, 0), (c, x, y, z) => {
    const plank = Math.abs(Math.sin((y + 0.5) * Math.PI * 4)) < 0.12 ? 0.55 : 1;
    const edge = Math.max(Math.abs(x), Math.abs(y - 0.5), Math.abs(z)) > 0.46 ? 0.7 : 1;
    c.set('#7a5634').multiplyScalar(plank * edge);
  });
  return merge([box]);
}

function skullGeometry() {
  const head = tint(new THREE.SphereGeometry(0.22, 14, 10).scale(1, 0.9, 1.1).translate(0, 0.2, 0), (c, x, y, z) => {
    c.set('#e2d6b8');
    // cuencas y nariz oscuras en la cara frontal
    if (z > 0.12 && y > 0.18 && y < 0.3 && Math.abs(Math.abs(x) - 0.08) < 0.05) c.set('#1a120c');
    if (z > 0.15 && y > 0.1 && y < 0.17 && Math.abs(x) < 0.03) c.set('#2a1d14');
  });
  const jaw = tint(new THREE.BoxGeometry(0.22, 0.08, 0.16).translate(0, 0.05, 0.08), (c) => c.set('#d4c7a6'));
  return merge([head, jaw]);
}

function boneGeometry() {
  const shaft = tint(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8).rotateZ(Math.PI / 2), (c) => c.set('#ddd1b0'));
  const ends = [-0.36, 0.36].flatMap((x) => [-0.04, 0.04].map((z) => tint(new THREE.SphereGeometry(0.06, 8, 6).translate(x, 0, z), (c) => c.set('#e6dbbd'))));
  return merge([shaft, ...ends]).translate(0, 0.06, 0);
}

// Reparte objetos por la sala con tono propio por ejemplar.
export function hallClutter({ hallRadius, avoid, reduced }) {
  const group = new THREE.Group();
  const rand = seeded(4242);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const free = (x, z) => avoid.every((a) => Math.hypot(x - a.x, z - a.z) > a.r);
  const ringPoints = (count, rMin, rMax) => {
    const out = [];
    let tries = 0;
    while (out.length < count && tries++ < count * 50) {
      const a = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (free(x, z)) out.push(new THREE.Vector3(x, 0, z));
    }
    return out;
  };
  const place = (geo, pts, scaleFn, { tilt = 0, colorFn } = {}) => {
    const inst = new THREE.InstancedMesh(geo, mat, pts.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), c = new THREE.Color();
    pts.forEach((p, k) => {
      const sc = scaleFn();
      q.setFromEuler(e.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt));
      inst.setMatrixAt(k, m.compose(p, q, s.setScalar(sc)));
      const b = 0.8 + rand() * 0.3;
      if (colorFn) colorFn(c, b); else c.setRGB(b, b, b);
      inst.setColorAt(k, c);
    });
    group.add(inst);
  };
  const edge = hallRadius - 1.5;
  // escombros: rocas talladas, teñidas hacia la piedra rojiza de la sala
  const rockPts = ringPoints(reduced ? 40 : 120, edge - 4, edge);
  [0, 1, 2, 3].forEach((v) => place(rockGeometry(v * 3.1 + 2), rockPts.filter((_, k) => k % 4 === v).map((p) => p.setY(0.1)), () => 0.25 + rand() ** 2 * 1.4, {
    tilt: 0.6, colorFn: (c, b) => c.setRGB(b * 1.35, b * 0.85, b * 0.7),
  }));
  // barriles y cajas apilados junto a los muros y a los lados de la cámara
  const barrelPts = [...ringPoints(reduced ? 8 : 22, edge - 3, edge - 0.5), ...[[-14, 9], [-15.2, 8.2], [14.5, 8.6], [15.4, 9.8]].map(([x, z]) => new THREE.Vector3(x, 0, z))];
  place(barrelGeometry(), barrelPts, () => 0.9 + rand() * 0.3);
  const cratePts = ringPoints(reduced ? 8 : 20, edge - 3, edge - 0.5);
  [[-16, 6.5], [15.8, 6.4]].forEach(([x, z]) => { cratePts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.1, 1, z + 0.05)); });
  place(crateGeometry(), cratePts, () => 0.8 + rand() * 0.4);
  // huesos y cráneos esparcidos
  place(skullGeometry(), ringPoints(reduced ? 10 : 30, 8, edge), () => 0.9 + rand() * 0.5, { tilt: 0.4 });
  place(boneGeometry(), ringPoints(reduced ? 20 : 70, 8, edge), () => 0.8 + rand() * 0.6, { tilt: 0.2 });
  return group;
}

// ---------- Humo y neblina con fundido suave ----------
// Prepase de profundidad para que la neblina se funda donde toca el suelo o los objetos.
export function createDepthPrepass(renderer, scene, camera, hidden) {
  const size = new THREE.Vector2();
  let target;
  const make = () => {
    renderer.getDrawingBufferSize(size);
    if (target) target.dispose();
    target = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y) });
  };
  make();
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  return {
    render() {
      const vis = hidden.filter((o) => o.visible);
      vis.forEach((o) => { o.visible = false; });
      scene.overrideMaterial = depthOnly;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      scene.overrideMaterial = null;
      vis.forEach((o) => { o.visible = true; });
    },
    depth: () => target.depthTexture,
    size: () => size,
    setSize: make,
  };
}

export function hallMist({ hallRadius, reduced }) {
  const rand = seeded(99);
  const group = new THREE.Group();
  const planes = [];
  const add = (count, y0, y1, color, opacity, rMin, rMax, size) => {
    for (let k = 0; k < count; k++) {
      const mat = mistMaterial(color, opacity * (0.7 + rand() * 0.5));
      const sc = size * (0.7 + rand() * 0.6);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc * 0.35), mat);
      const a = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin);
      m.position.set(Math.cos(a) * r, y0 + rand() * (y1 - y0), Math.sin(a) * r);
      m.userData.baseX = m.position.x;
      m.userData.phase = rand() * 10;
      group.add(m);
      planes.push(m);
    }
  };
  // neblina baja sobre el suelo y humo acumulado bajo el techo
  add(reduced ? 6 : 14, 0.8, 2.2, '#7a5446', 0.4, 6, hallRadius - 6, 26);
  add(reduced ? 4 : 10, 13, 18, '#4a3a38', 0.45, 0, hallRadius - 4, 34);
  return {
    group,
    materials: planes.map((p) => p.material),
    update(time, camera) {
      for (const m of planes) {
        m.position.x = m.userData.baseX + Math.sin(time * 0.06 + m.userData.phase) * 3;
        m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), 0);
      }
    },
  };
}

// ---------- Círculo rúnico (pantalla de cruce) ----------
export function runeCircleTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const cx = 256;
  const rand = seeded(31);
  ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.lineCap = 'round';
  for (const [r, w] of [[240, 4], [224, 1.5], [158, 3], [144, 1.5], [70, 2]]) { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke(); }
  // runas angulosas dibujadas con trazos (no dependen de ninguna fuente)
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    ctx.save(); ctx.translate(cx + Math.cos(a) * 191, cx + Math.sin(a) * 191); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(0, 13);
    for (let s = 0; s < 2; s++) {
      const y = -10 + rand() * 16, dir = rand() < 0.5 ? -1 : 1;
      ctx.moveTo(0, y); ctx.lineTo(dir * 9, y + (rand() - 0.5) * 12);
    }
    ctx.stroke(); ctx.restore();
  }
  // hachas cruzadas estilizadas en el centro
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(cx - s * 100, cx + 100); ctx.lineTo(cx + s * 100, cx - 100); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + s * 100, cx - 100, 30, Math.PI * (s > 0 ? 0.25 : 0.75) - 1.2, Math.PI * (s > 0 ? 0.25 : 0.75) + 1.2); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
