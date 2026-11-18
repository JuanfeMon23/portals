import * as THREE from 'three';

export const CORE_DIR = new THREE.Vector3(-0.55, 0.6, -1).normalize();

// Cielo de nebulosa con núcleo galáctico y estrellas, todo en un shader.
export function nebulaSky(radius = 400) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCore: { value: CORE_DIR } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uCore; varying vec3 vDir;
      float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm3(vec3 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise3(p); p *= 2.07; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float n = fbm3(d*2.6 + vec3(0.0, 0.0, uTime*0.004));
        float m = fbm3(d*5.0 + vec3(3.1, 1.7, 0.0));
        vec3 col = mix(vec3(0.01, 0.015, 0.06), vec3(0.06, 0.06, 0.3), smoothstep(0.35, 0.75, n));
        col = mix(col, vec3(0.2, 0.14, 0.55), smoothstep(0.55, 0.85, n*m*1.6));
        col += vec3(0.05, 0.18, 0.45)*smoothstep(0.6, 0.9, m)*0.6;
        float c = max(dot(d, uCore), 0.0);
        col += vec3(1.0, 0.95, 1.0)*pow(c, 300.0)*1.6 + vec3(0.7, 0.6, 1.0)*pow(c, 30.0)*0.3 + vec3(0.3, 0.2, 0.75)*pow(c, 6.0)*0.18;
        // estrellas
        vec3 cell = floor(d*260.0);
        float h = hash3(cell);
        float star = step(0.985, h)*(0.5 + 0.5*sin(uTime*2.0 + h*80.0));
        vec3 fc = fract(d*260.0) - 0.5;
        star *= smoothstep(0.5, 0.0, length(fc));
        col += vec3(0.9, 0.92, 1.0)*star*1.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  sky.frustumCulled = false;
  return sky;
}

// Constelaciones: cadenas de estrellas unidas por líneas tenues.
export function constellations(count = 8, radius = 360) {
  const g = new THREE.Group();
  let s = 777;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const lines = [], stars = [];
  for (let c = 0; c < count; c++) {
    const az = -1.1 + (c / (count - 1)) * 2.2 + (rand() - 0.5) * 0.2;
    const el = 0.35 + rand() * 0.55;
    let prev = null;
    const nStars = 5 + Math.floor(rand() * 3);
    for (let k = 0; k < nStars; k++) {
      const a = az + (rand() - 0.5) * 0.28 + k * 0.03, e = el + (rand() - 0.5) * 0.22;
      const v = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(radius);
      stars.push(v);
      if (prev) lines.push(prev, v);
      prev = v;
    }
  }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(lines);
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: '#9fb6ff', transparent: true, opacity: 0.22, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
  const starGeo = new THREE.BufferGeometry().setFromPoints(stars);
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#e8eeff', size: 5, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));
  g.frustumCulled = false;
  return g;
}

// Polvo cósmico azulado que flota.
export function cosmicDust(count = 900, spread = 90) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread * 1.5;
    pos[i * 3 + 1] = Math.random() * spread * 0.6 - 10;
    pos[i * 3 + 2] = -Math.random() * spread + 20;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uPixel; varying float vA;
      void main(){
        vec3 p = position;
        p.y += sin(uTime*0.3 + aSeed*30.0)*0.6;
        p.x += cos(uTime*0.2 + aSeed*20.0)*0.6;
        vA = 0.35 + 0.65*sin(uTime*2.0 + aSeed*60.0)*0.5 + 0.3;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = (4.0 + aSeed*7.0)*uPixel*12.0/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.7, 0.75, 1.0)*1.6, smoothstep(0.5, 0.0, d)*vA); }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
