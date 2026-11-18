import * as THREE from 'three';

export const CORE_DIR = new THREE.Vector3(-0.35, 0.45, -1).normalize();

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
        vec3 col = mix(vec3(0.01, 0.01, 0.05), vec3(0.08, 0.04, 0.28), smoothstep(0.35, 0.75, n));
        col = mix(col, vec3(0.22, 0.12, 0.6), smoothstep(0.55, 0.85, n*m*1.6));
        col += vec3(0.05, 0.18, 0.45)*smoothstep(0.6, 0.9, m)*0.6;
        float c = max(dot(d, uCore), 0.0);
        col += vec3(1.0, 0.95, 1.0)*pow(c, 260.0)*2.2 + vec3(0.75, 0.6, 1.0)*pow(c, 24.0)*0.45 + vec3(0.35, 0.2, 0.8)*pow(c, 5.0)*0.25;
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

// Isla de roca flotante: plataforma plana arriba y base irregular que se afila hacia abajo.
export function floatingIsland(radius, depth, mats) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.96, 0.8, 14, 1), mats.rock);
  top.position.y = -0.4;
  const under = new THREE.ConeGeometry(radius * 0.97, depth, 14, 6);
  under.rotateX(Math.PI);
  const p = under.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const y = p.getY(k);
    if (y < depth / 2 - 0.01) {
      const j = 1 + (Math.random() - 0.5) * 0.35;
      p.setXYZ(k, p.getX(k) * j, y + (Math.random() - 0.5) * 0.6, p.getZ(k) * j);
    }
  }
  under.computeVertexNormals();
  const base = new THREE.Mesh(under, mats.rock);
  base.position.y = -0.8 - depth / 2;
  g.add(top, base);
  return g;
}

// Escalera de piedra entre dos puntos con losa rota por debajo.
export function stairway(a, b, width, mats) {
  const g = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(b, a);
  const horiz = Math.hypot(dir.x, dir.z);
  const steps = Math.max(4, Math.round(Math.abs(dir.y) / 0.35));
  const yaw = Math.atan2(dir.x, dir.z);
  const sd = horiz / steps;
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps;
    const s = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, sd + 0.04), mats.marble);
    s.position.set(a.x + dir.x * t, a.y + dir.y * t, a.z + dir.z * t);
    s.rotation.y = yaw;
    g.add(s);
  }
  const len = dir.length();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.9, len), mats.rock);
  slab.position.copy(a).addScaledVector(dir, 0.5).add(new THREE.Vector3(0, -0.55, 0));
  slab.lookAt(b.clone().add(new THREE.Vector3(0, -0.55, 0)));
  g.add(slab);
  return g;
}

// Escombros flotantes alrededor del camino.
export function debris(count, bounds, mat) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < count; i++) {
    p.set(
      THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, Math.random()),
      THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, Math.random()),
      THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, Math.random()),
    );
    q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    s.setScalar(0.15 + Math.random() ** 3 * 0.9);
    inst.setMatrixAt(i, m.compose(p, q, s));
  }
  return inst;
}
