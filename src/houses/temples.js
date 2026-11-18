import * as THREE from 'three';

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
function column(h, r, mats) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 16), mats.marble);
  shaft.position.y = h / 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, r * 0.5, r * 2.6), mats.marble);
  base.position.y = r * 0.25;
  const torus = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.18, 6, 16), mats.marble);
  torus.rotation.x = Math.PI / 2; torus.position.y = r * 0.6;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.7, r * 0.45, r * 2.7), mats.marble);
  cap.position.y = h - r * 0.22;
  const echinus = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.25, r * 0.9, r * 0.45, 16), mats.marble);
  echinus.position.y = h - r * 0.65;
  g.add(shaft, base, torus, echinus, cap);
  return g;
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

// Escalinata frontal desde el suelo hasta el estilóbato.
function frontStairs(width, height, z0, mats, steps = 6) {
  const g = new THREE.Group();
  const sh = height / steps, sd = 0.45;
  for (let k = 0; k < steps; k++) {
    g.add(box(width, sh * (k + 1), sd, mats.marble, 0, (sh * (k + 1)) / 2, z0 + (steps - k) * sd - sd / 2));
  }
  return g;
}

// Techo a dos aguas: un prisma triangular que forma también los frontones.
function gableRoof(w, d, rise, mats) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, mats.marble);
}

function lion(mats) {
  const g = new THREE.Group();
  g.add(box(0.7, 0.55, 1.3, mats.marble, 0, 0.45, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mats.marble);
  head.position.set(0, 0.95, 0.55);
  const mane = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.14, 8, 16), mats.marble);
  mane.position.set(0, 0.95, 0.48);
  g.add(head, mane, box(0.9, 0.2, 1.6, mats.marble, 0, 0.1, 0));
  return g;
}

// ---------- Templos ----------
// Todos miran hacia +z. Devuelven el grupo, la puerta (malla) y la altura total.
function rectangularTemple({ w, d, colH, colR, front, side, prostyle, mats, color, glyph, dome = false, lions = false, roses = false }) {
  const g = new THREE.Group();
  const { group: base, top } = stylobate(w, d, mats);
  g.add(base);
  g.add(frontStairs(w * 0.45, top, d / 2 + 1.8, mats, 3));

  const xs = (n) => Array.from({ length: n }, (_, k) => -w / 2 + 0.55 + (k * (w - 1.1)) / (n - 1));
  const zs = (n) => Array.from({ length: n }, (_, k) => -d / 2 + 0.55 + (k * (d - 1.1)) / (n - 1));
  const place = (x, z) => { const c = column(colH, colR, mats); c.position.set(x, top, z); g.add(c); };
  for (const x of xs(front)) place(x, d / 2 - 0.55);
  if (prostyle) {
    place(-w / 2 + 0.55, d / 2 - 2.0); place(w / 2 - 0.55, d / 2 - 2.0);
  } else {
    for (const x of xs(front)) place(x, -d / 2 + 0.55);
    for (const z of zs(side).slice(1, -1)) { place(-w / 2 + 0.55, z); place(w / 2 - 0.55, z); }
  }

  // cella con puerta luminosa
  const cw = prostyle ? w - 0.4 : w - 2.6;
  const cd = prostyle ? d - 3.0 : d - 3.2;
  const cz = prostyle ? -1.4 : 0;
  g.add(box(cw, colH, cd, mats.ashlar, 0, top + colH / 2, cz));
  const doorH = colH * 0.62, doorW = Math.min(2.2, cw * 0.32);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), doorMaterial(color));
  door.position.set(0, top + doorH / 2, cz + cd / 2 + 0.02);
  g.add(door);
  g.add(box(doorW + 0.5, 0.35, 0.3, mats.marble, 0, top + doorH + 0.17, cz + cd / 2 + 0.1));

  // entablamento, cornisa y techo
  const eY = top + colH;
  g.add(box(w + 0.1, 0.7, d + 0.1, mats.marble, 0, eY + 0.35, 0));
  g.add(box(w + 0.5, 0.22, d + 0.5, mats.marble, 0, eY + 0.81, 0));
  const rise = w * 0.2;
  const roof = gableRoof(w + 0.5, d + 0.5, rise, mats);
  roof.position.y = eY + 0.92;
  g.add(roof);
  const glyphPlane = new THREE.Mesh(new THREE.PlaneGeometry(rise * 1.1, rise * 1.1), new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, color), transparent: true, depthWrite: false }));
  glyphPlane.position.set(0, eY + 0.92 + rise * 0.42, (d + 0.5) / 2 + 0.03);
  g.add(glyphPlane);
  let height = eY + 0.92 + rise;

  if (dome) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.9, 20), mats.marble);
    drum.position.set(0, height - 0.2, -d * 0.15);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(1.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.marble);
    cup.position.set(0, height + 0.25, -d * 0.15);
    g.add(drum, cup);
    height += 1.6;
  }
  if (lions) {
    for (const s of [-1, 1]) {
      const l = lion(mats);
      l.position.set(s * (w * 0.32), 0, d / 2 + 2.4);
      g.add(l);
    }
  }
  if (roses) {
    const roseMat = new THREE.MeshStandardMaterial({ color: '#c0102a', emissive: '#4a0010', roughness: 0.6 });
    for (let k = 0; k < 40; k++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), roseMat);
      r.position.set((Math.random() - 0.5) * w * 0.9, 0.12 + Math.random() * 0.05, d / 2 + 0.6 + Math.random() * 2.5);
      g.add(r);
    }
  }
  return { group: g, door, height, width: w, depth: d };
}

function roundTemple({ mats, color, glyph }) {
  const g = new THREE.Group();
  const th = 0.4;
  for (let k = 0; k < 3; k++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(5.2 - k * 0.5, 5.4 - k * 0.5, th, 40), mats.marble);
    t.position.y = th / 2 + k * th;
    g.add(t);
  }
  const top = 3 * th;
  g.add(frontStairs(3, top, 4.6, mats, 3));
  const colH = 5.2;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const c = column(colH, 0.3, mats);
    c.position.set(Math.cos(a) * 4.0, top, Math.sin(a) * 4.0);
    g.add(c);
  }
  const cella = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, colH, 32), mats.ashlar);
  cella.position.y = top + colH / 2;
  g.add(cella);
  const doorH = colH * 0.62;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, doorH), doorMaterial(color));
  door.position.set(0, top + doorH / 2, 2.52);
  g.add(door);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.75, 40), mats.marble);
  ring.position.y = top + colH + 0.37;
  g.add(ring);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.3, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.marble);
  dome.scale.y = 0.62;
  dome.position.y = top + colH + 0.75;
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 12), mats.marble);
  lantern.position.y = top + colH + 0.75 + 4.3 * 0.62 + 0.3;
  g.add(dome, lantern);
  const glyphPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: glyphTexture(glyph, color), transparent: true, depthWrite: false }));
  glyphPlane.position.set(0, top + colH + 0.37, 4.53);
  g.add(glyphPlane);
  return { group: g, door, height: lantern.position.y + 0.5, width: 10.8, depth: 10.8 };
}

// Estilos por casa, inspirados en las ilustraciones: períptero, próstilo, monóptero.
export function buildHouse(style, { mats, color, glyph }) {
  switch (style) {
    case 'aries': return rectangularTemple({ w: 8, d: 9, colH: 4.8, colR: 0.3, front: 6, side: 7, mats, color, glyph, dome: true });
    case 'taurus': return rectangularTemple({ w: 10.5, d: 9, colH: 5.2, colR: 0.42, front: 6, side: 6, mats, color, glyph });
    case 'leo': return rectangularTemple({ w: 8.5, d: 10, colH: 5.4, colR: 0.32, front: 6, side: 7, mats, color, glyph, lions: true });
    case 'scorpio': return rectangularTemple({ w: 8, d: 10, colH: 6, colR: 0.3, front: 4, side: 6, prostyle: true, mats, color, glyph });
    case 'aquarius': return roundTemple({ mats, color, glyph });
    case 'pisces': return rectangularTemple({ w: 8, d: 9, colH: 5, colR: 0.3, front: 4, side: 6, prostyle: true, mats, color, glyph, roses: true });
    default: return rectangularTemple({ w: 8, d: 9, colH: 5, colR: 0.3, front: 6, side: 7, mats, color, glyph });
  }
}

// Estatua genérica de una diosa con escudo y lanza, en la cima.
export function goddessStatue(mats) {
  const g = new THREE.Group();
  g.add(box(3.2, 1.2, 3.2, mats.marble, 0, 0.6, 0), box(2.6, 0.5, 2.6, mats.marble, 0, 1.45, 0));
  const robe = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(1.0, 0), new THREE.Vector2(0.85, 1.5), new THREE.Vector2(0.62, 3.2),
    new THREE.Vector2(0.75, 3.9), new THREE.Vector2(0.4, 4.3), new THREE.Vector2(0, 4.35),
  ], 24), mats.marble);
  robe.position.y = 1.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mats.marble);
  head.position.y = 6.45;
  const helm = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 10), mats.marble);
  helm.position.set(0, 7.0, -0.1); helm.rotation.x = -0.5;
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.5, 6), mats.marble);
  spear.position.set(1.1, 5.2, 0.2);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), mats.marble);
  tip.position.set(1.1, 9.2, 0.2);
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24), mats.marble);
  shield.rotation.z = Math.PI / 2; shield.rotation.y = 0.3;
  shield.position.set(-1.05, 3.6, 0.3);
  g.add(robe, head, helm, spear, tip, shield);
  return g;
}
