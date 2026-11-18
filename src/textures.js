import * as THREE from 'three';

// Texturas procedurales en canvas: piedra rojiza, madera, cuero y estandartes.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx, w, h, rnd, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v * 0.8},${v * 0.6},${rnd() * alpha})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

function cracks(ctx, w, h, rnd, n) {
  ctx.strokeStyle = 'rgba(20,8,4,0.55)';
  for (let i = 0; i < n; i++) {
    ctx.lineWidth = 0.5 + rnd() * 1.2;
    ctx.beginPath();
    let x = rnd() * w, y = rnd() * h;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

export function floorTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const rnd = seeded(7);
    ctx.fillStyle = '#2a1209'; ctx.fillRect(0, 0, w, h);
    const cell = 128;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const off = (y / cell) % 2 ? cell / 2 : 0;
        const r = 95 + rnd() * 45, g = 48 + rnd() * 22, b = 28 + rnd() * 14;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const j = () => (rnd() - 0.5) * 10;
        ctx.beginPath();
        ctx.moveTo(x + off + 4 + j(), y + 4 + j());
        ctx.lineTo(x + off + cell - 4 + j(), y + 4 + j());
        ctx.lineTo(x + off + cell - 4 + j(), y + cell - 4 + j());
        ctx.lineTo(x + off + 4 + j(), y + cell - 4 + j());
        ctx.closePath(); ctx.fill();
        if (off) { ctx.save(); ctx.translate(-w, 0); ctx.fill(); ctx.restore(); }
        const grd = ctx.createRadialGradient(x + off + cell / 2, y + cell / 2, 5, x + off + cell / 2, y + cell / 2, cell * 0.8);
        grd.addColorStop(0, 'rgba(255,180,120,0.07)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = grd; ctx.fillRect(x + off, y, cell, cell);
      }
    }
    speckle(ctx, w, h, rnd, 26000, 0.18);
    cracks(ctx, w, h, rnd, 40);
  }, { repeat: [7, 7] });
}

export function wallTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const rnd = seeded(13);
    ctx.fillStyle = '#1e0c06'; ctx.fillRect(0, 0, w, h);
    const rowH = 64;
    for (let row = 0; row * rowH < h; row++) {
      let x = row % 2 ? -60 : 0;
      while (x < w) {
        const bw = 110 + rnd() * 90;
        const r = 110 + rnd() * 50, g = 50 + rnd() * 25, b = 30 + rnd() * 12;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 3, row * rowH + 3, bw - 6, rowH - 6);
        const grd = ctx.createLinearGradient(0, row * rowH, 0, row * rowH + rowH);
        grd.addColorStop(0, 'rgba(255,200,150,0.1)'); grd.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = grd; ctx.fillRect(x + 3, row * rowH + 3, bw - 6, rowH - 6);
        x += bw;
      }
    }
    speckle(ctx, w, h, rnd, 18000, 0.2);
    cracks(ctx, w, h, rnd, 30);
  }, { repeat: [6, 2] });
}

export function woodTexture() {
  return canvasTexture(256, 1024, (ctx, w, h) => {
    const rnd = seeded(21);
    ctx.fillStyle = '#3b1f10'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${20 + rnd() * 50},${8 + rnd() * 20},${4 + rnd() * 8},${0.3 + rnd() * 0.5})`;
      ctx.lineWidth = 1 + rnd() * 3;
      const x = rnd() * w;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= h; y += 64) ctx.lineTo(x + Math.sin(y * 0.01 + i) * 6, y);
      ctx.stroke();
    }
    speckle(ctx, w, h, rnd, 4000, 0.15);
  });
}

export function leatherTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    const rnd = seeded(33);
    ctx.fillStyle = '#4a2414'; ctx.fillRect(0, 0, w, h);
    const panels = 8;
    for (let i = 0; i < panels; i++) {
      const x = (i / panels) * w;
      const grd = ctx.createLinearGradient(x, 0, x + w / panels, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.45)'); grd.addColorStop(0.5, 'rgba(255,160,100,0.08)'); grd.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grd; ctx.fillRect(x, 0, w / panels, h);
      ctx.strokeStyle = 'rgba(220,180,120,0.35)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 6, 0); ctx.lineTo(x + 6, h); ctx.stroke();
    }
    ctx.setLineDash([]);
    speckle(ctx, w, h, rnd, 20000, 0.12);
  }, { repeat: [3, 1] });
}

export function boneTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const rnd = seeded(41);
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#efe2c4'); grd.addColorStop(1, '#a8916a');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(90,60,30,${rnd() * 0.25})`;
      ctx.fillRect(0, rnd() * h, w, 1 + rnd() * 3);
    }
    speckle(ctx, w, h, rnd, 3000, 0.12);
  });
}

// Estandarte rojo con un emblema genérico de colmillos (sin marcas de terceros).
export function bannerTexture() {
  return canvasTexture(256, 640, (ctx, w, h) => {
    const rnd = seeded(55);
    ctx.fillStyle = '#7a0d0a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.12})`;
      ctx.fillRect(rnd() * w, 0, 1 + rnd() * 4, h);
    }
    ctx.fillStyle = '#1a0503';
    ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w / 2, h - 90); ctx.lineTo(w, h); ctx.fill();
    ctx.strokeStyle = '#c99a45'; ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 120);
    const cx = w / 2, cy = 250;
    ctx.fillStyle = '#140403';
    ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c99a45'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#e9dcbc';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 22, cy + 40);
      ctx.quadraticCurveTo(cx + s * 70, cy + 10, cx + s * 40, cy - 60);
      ctx.quadraticCurveTo(cx + s * 48, cy + 0, cx + s * 6, cy + 30);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#c99a45';
    ctx.beginPath(); ctx.moveTo(cx, cy - 50); ctx.lineTo(cx + 14, cy + 20); ctx.lineTo(cx, cy + 45); ctx.lineTo(cx - 14, cy + 20); ctx.closePath(); ctx.fill();
  });
}

export function labelTexture(text, color) {
  const tex = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '700 120px Cinzel, Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 30;
    ctx.fillStyle = color; ctx.fillText(text.toUpperCase(), w / 2, h / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff4dc'; ctx.fillText(text.toUpperCase(), w / 2, h / 2);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
