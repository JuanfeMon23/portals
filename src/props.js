import * as THREE from 'three';
import { flameMaterial } from './fx.js';
import { fireParticles } from './shaders.js';

// ---------- Texturas nuevas ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function ropeTexture() {
  const t = canvasTex(128, 32, (ctx, w, h) => {
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(40,24,10,0.8)'; ctx.lineWidth = 4;
    for (let x = -h; x < w + h; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(230,200,140,0.35)'; ctx.lineWidth = 2;
    for (let x = -h + 5; x < w + h; x += 12) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
  });
  t.repeat.set(6, 1);
  return t;
}

export function grateTexture() {
  return canvasTex(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#ffb347'); g.addColorStop(0.5, '#ff5a10'); g.addColorStop(1, '#7a1500');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#120806';
    const step = 42;
    for (let x = 0; x < w; x += step) ctx.fillRect(x, 0, 14, h);
    for (let y = 0; y < h; y += step) ctx.fillRect(0, y, w, 14);
  });
}

export function curtainTexture(accent) {
  return canvasTex(512, 1024, (ctx, w, h) => {
    const folds = 9;
    for (let i = 0; i < folds; i++) {
      const x = (i / folds) * w, fw = w / folds;
      const g = ctx.createLinearGradient(x, 0, x + fw, 0);
      g.addColorStop(0, '#3a0404'); g.addColorStop(0.5, '#9a1410'); g.addColorStop(1, '#3a0404');
      ctx.fillStyle = g; ctx.fillRect(x, 0, fw + 1, h);
    }
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0.55)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    // franja central con rombo dorado y gema del color del proyecto
    ctx.fillStyle = 'rgba(20,4,2,0.55)'; ctx.fillRect(w / 2 - 70, 0, 140, h);
    ctx.strokeStyle = '#d6a64a'; ctx.lineWidth = 6;
    ctx.strokeRect(w / 2 - 70, -10, 140, h * 0.62);
    const cx = w / 2, cy = 150;
    ctx.fillStyle = '#d6a64a';
    ctx.beginPath(); ctx.moveTo(cx, cy - 90); ctx.lineTo(cx + 60, cy); ctx.lineTo(cx, cy + 90); ctx.lineTo(cx - 60, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a0a04';
    ctx.beginPath(); ctx.moveTo(cx, cy - 66); ctx.lineTo(cx + 42, cy); ctx.lineTo(cx, cy + 66); ctx.lineTo(cx - 42, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx + 24, cy); ctx.lineTo(cx, cy + 40); ctx.lineTo(cx - 24, cy); ctx.closePath(); ctx.fill();
    // flecos dorados abajo
    ctx.fillStyle = '#b8863a';
    for (let x = 0; x < w; x += 10) ctx.fillRect(x, h - 40, 5, 40);
  });
}

// Emblema del destino que se ve dentro de la esfera.
export function emblemTexture(name, color) {
  const t = canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 230);
    g.addColorStop(0, 'rgba(255,230,190,0.22)'); g.addColorStop(0.5, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 172, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.save(); ctx.translate(cx + Math.cos(a) * 161, cy + Math.sin(a) * 161); ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#ffd98a' : color; ctx.fillRect(-2, -7, 4, 14); ctx.restore();
    }
    ctx.font = '700 210px Cinzel, Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 40;
    ctx.fillStyle = color; ctx.fillText(name[0].toUpperCase(), cx, cy + 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff2d0'; ctx.fillText(name[0].toUpperCase(), cx, cy + 12);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- Geometría ----------
// Tubo que se afina a lo largo de la curva (colmillos y cuernos).
export function taperedTube(points, r0, r1, mat, segments = 32, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const c = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, Math.pow(t, 0.9));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

export function beamBetween(a, b, radius, mat, radial = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, dir.length(), radial, 1, true), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// Columna gruesa de madera con amarres de cuerda y punta de hierro.
export function ropeColumn({ height, radius, wood, rope, iron }) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.92, radius, height, 14), wood);
  col.position.y = height / 2;
  g.add(col);
  const bands = [0.12, 0.17, 0.62, 0.67, 0.72];
  for (const b of bands) {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.02, radius * 0.13, 8, 28), rope);
    tor.rotation.x = Math.PI / 2;
    tor.position.y = height * b;
    g.add(tor);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 1.05, radius * 0.6, 8), iron);
  cap.position.y = height;
  const spike = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.5, radius * 2, 8), iron);
  spike.position.y = height + radius * 1.3;
  g.add(cap, spike);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.12, radius * 0.7, 6), iron);
    s.position.set(Math.cos(a) * radius * 1.1, height * 0.645, Math.sin(a) * radius * 1.1);
    s.rotation.z = -Math.PI / 2; s.rotation.y = -a;
    g.add(s);
  }
  return g;
}

// Brasero de hierro con pinchos, llama y chispas. Devuelve los materiales animados.
export function spikedBrazier({ iron, scale = 1, withLight = true, reduced = false }) {
  const g = new THREE.Group();
  const animated = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = beamBetween(new THREE.Vector3(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75), new THREE.Vector3(Math.cos(a) * 0.25, 1.7, Math.sin(a) * 0.25), 0.09, iron, 6);
    g.add(leg);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6), iron);
    spike.position.set(Math.cos(a) * 0.55, 0.6, Math.sin(a) * 0.55);
    spike.rotation.z = -Math.PI / 2; spike.rotation.y = -a;
    g.add(spike);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 20), iron);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.9;
  g.add(ring);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.15, 0), new THREE.Vector2(0.5, 0.15), new THREE.Vector2(0.78, 0.45), new THREE.Vector2(0.86, 0.6), new THREE.Vector2(0.8, 0.62),
  ], 16), iron);
  bowl.material = iron.clone(); bowl.material.side = THREE.DoubleSide;
  bowl.position.y = 1.65;
  g.add(bowl);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6), iron);
    s.position.set(Math.cos(a) * 0.86, 2.4, Math.sin(a) * 0.86);
    s.lookAt(Math.cos(a) * 3, 3.6, Math.sin(a) * 3);
    s.rotateX(Math.PI / 2);
    g.add(s);
  }
  const coals = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), new THREE.MeshStandardMaterial({ color: '#1a0500', emissive: '#ff4a0a', emissiveIntensity: 2 }));
  coals.rotation.x = -Math.PI / 2; coals.position.y = 2.15;
  g.add(coals);
  for (let k = 0; k < 3; k++) {
    const fm = flameMaterial({ intensity: 0.75 });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.0), fm);
    f.position.y = 2.15 + 1.0;
    f.rotation.y = (k / 3) * Math.PI;
    g.add(f);
    animated.push(fm);
  }
  const sparks = fireParticles({ count: reduced ? 30 : 70, radius: 0.45, height: 2.4, size: 140, speed: 0.6 });
  sparks.position.y = 2.2;
  g.add(sparks);
  animated.push(sparks.material);
  let light = null;
  if (withLight) {
    light = new THREE.PointLight('#ff8a3a', 34, 18, 2);
    light.position.y = 3.2;
    g.add(light);
  }
  g.scale.setScalar(scale);
  return { group: g, animated, light };
}

// Figura encapuchada que canaliza energía hacia el portal (silueta genérica).
export function channeler({ robe, trim, color }) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.5, 0.25), new THREE.Vector2(0.36, 0.95),
    new THREE.Vector2(0.3, 1.38), new THREE.Vector2(0.4, 1.58), new THREE.Vector2(0.22, 1.74), new THREE.Vector2(0, 1.76),
  ], 18), robe);
  g.add(body);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.035, 6, 24), trim);
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.06;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 24), trim);
  belt.rotation.x = Math.PI / 2; belt.position.y = 1.2;
  g.add(hem, belt);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), robe);
  hood.scale.set(1, 1.15, 1.2); hood.position.set(0, 1.93, -0.02);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshBasicMaterial({ color: '#050202' }));
  face.position.set(0, 1.9, 0.14); face.scale.set(1, 1.1, 0.6);
  g.add(hood, face);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: 4 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
    eye.position.set(s * 0.06, 1.93, 0.24);
    g.add(eye);
  }
  const hands = [];
  const handMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: 5 });
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Vector3(s * 0.34, 1.58, 0.02);
    const hand = new THREE.Vector3(s * 0.2, 1.78, 0.72);
    g.add(beamBetween(shoulder, hand, 0.1, robe, 8));
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 14), trim);
    cuff.position.copy(hand).lerp(shoulder, 0.12);
    cuff.lookAt(hand.clone().multiplyScalar(2).sub(shoulder));
    g.add(cuff);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), handMat);
    orb.position.copy(hand);
    g.add(orb);
    hands.push(orb);
  }
  return { group: g, hands };
}
