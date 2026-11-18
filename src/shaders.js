import * as THREE from 'three';

const noise = /* glsl */ `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

const pixelRatio = () => Math.min(window.devicePixelRatio, 2);

// Llamas y chispas como partículas aditivas (posición calculada en GPU).
export function fireParticles({ count = 160, radius = 0.6, height = 2.6, size = 450, speed = 0.9, hot = '#ffd56a', cold = '#ff2a05' } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const off = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * radius;
    off[i * 3] = Math.cos(a) * rr; off[i * 3 + 1] = Math.random(); off[i * 3 + 2] = Math.sin(a) * rr;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aOffset', new THREE.BufferAttribute(off, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }, uHeight: { value: height }, uSize: { value: size }, uSpeed: { value: speed },
      uPixel: { value: pixelRatio() },
      uHot: { value: new THREE.Color(hot) }, uCold: { value: new THREE.Color(cold) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aOffset; attribute float aSeed;
      uniform float uTime, uHeight, uSize, uSpeed, uPixel;
      varying float vLife;
      void main(){
        float life = fract(uTime*uSpeed*(0.7+aSeed*0.6) + aSeed*7.0);
        vec3 p = position;
        float shrink = 1.0 - life*0.85;
        p.x += aOffset.x*shrink + sin(uTime*4.0 + aSeed*30.0)*0.12*life;
        p.z += aOffset.z*shrink + cos(uTime*3.5 + aSeed*20.0)*0.12*life;
        p.y += life*uHeight*(0.6+aOffset.y*0.6);
        vLife = life;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = uSize*(1.0-life*0.8)*uPixel/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHot, uCold; varying float vLife;
      void main(){
        float d = length(gl_PointCoord-0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(uHot*1.8, uCold*0.9, smoothstep(0.0, 0.7, vLife));
        gl_FragColor = vec4(col, a*a*(1.0-vLife));
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Brasas que flotan por toda la sala.
export function embers(count = 500, area = 24, height = 16) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * area;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHeight: { value: height }, uPixel: { value: pixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uHeight, uPixel; varying float vA;
      void main(){
        float life = fract(uTime*0.04*(0.5+aSeed) + aSeed*13.0);
        vec3 p = position;
        p.y = life*uHeight;
        p.x += sin(uTime*0.6 + aSeed*40.0)*0.8;
        p.z += cos(uTime*0.5 + aSeed*25.0)*0.8;
        vA = sin(life*3.14159) * (0.5+0.5*sin(uTime*6.0+aSeed*50.0));
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = (6.0+aSeed*8.0)*uPixel*10.0/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard;
        gl_FragColor = vec4(vec3(1.0,0.45,0.1)*2.5, smoothstep(0.5,0.0,d)*vA); }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Chispas que orbitan el aro de cada portal.
export function orbitSparks(color, count = 90, radius = 2.6) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) seed[i] = Math.random();
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: 1 }, uRadius: { value: radius }, uColor: { value: new THREE.Color(color) }, uPixel: { value: pixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uSpeed, uRadius, uPixel; varying float vA;
      void main(){
        float a = aSeed*6.2831 + uTime*uSpeed*(0.4+aSeed*0.8);
        float r = uRadius + sin(uTime*2.0+aSeed*40.0)*0.25 - fract(uTime*0.3+aSeed)*0.6;
        vec3 p = vec3(cos(a)*r, sin(a)*r, sin(aSeed*90.0+uTime)*0.3);
        vA = 0.4+0.6*sin(uTime*5.0+aSeed*60.0);
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        gl_PointSize = (10.0+aSeed*14.0)*uPixel*6.0/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vA;
      void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard;
        gl_FragColor = vec4(uColor*2.5+0.3, smoothstep(0.5,0.0,d)*vA); }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}
