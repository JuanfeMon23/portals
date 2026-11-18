import * as THREE from 'three';

const noise = /* glsl */ `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

// Esfera de energía: cáscara fresnel azulada, rayos en el borde y el
// emblema del destino visible dentro, arremolinado.
export function portalSphereMaterial({ color, deep, emblem, radius }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 1 },
      uHover: { value: 0 },
      uBoost: { value: 0 },
      uRadius: { value: radius },
      uColorA: { value: new THREE.Color(color) },
      uDeep: { value: new THREE.Color(deep) },
      uShell: { value: new THREE.Color('#5fb4ff') },
      uEmblem: { value: emblem },
    },
    vertexShader: /* glsl */ `
      varying vec3 vLocal; varying vec3 vN; varying vec3 vV;
      void main(){
        vLocal = position;
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        vN = normalize(normalMatrix*normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix*mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSpeed, uHover, uBoost, uRadius;
      uniform vec3 uColorA, uDeep, uShell;
      uniform sampler2D uEmblem;
      varying vec3 vLocal; varying vec3 vN; varying vec3 vV;
      ${noise}
      void main(){
        float t = uTime*uSpeed;
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - facing, 2.2);
        vec2 p = vLocal.xy/uRadius;
        float r = length(p);
        float ang = t*0.25 + 1.6*(1.0 - r) + uBoost*r*2.0;
        vec2 q = mat2(cos(ang),-sin(ang),sin(ang),cos(ang))*p;

        // interior: niebla de energía y el emblema del destino
        float n = fbm(q*2.4 + vec2(t*0.12, -t*0.08));
        vec3 inner = mix(uDeep*0.25, uColorA*0.3, n*n);
        float wob = 0.12*sin(t*0.6)*(1.0 - r) + uBoost*1.5*(1.0 - r);
        vec2 pe = mat2(cos(wob),-sin(wob),sin(wob),cos(wob))*p;
        vec2 euv = pe*0.62*(1.0 - uBoost*0.25) + 0.5 + (vec2(n) - 0.5)*0.03;
        vec4 emb = texture2D(uEmblem, euv);
        inner = mix(inner, emb.rgb*1.15, emb.a*0.85);

        // vetas que giran por la superficie
        float a = atan(p.y, p.x);
        float streak = smoothstep(0.55, 0.95, fbm(vec2(cos(a), sin(a))*2.5 + vec2(r*3.0 - t*0.8, t*0.3)));
        vec3 shellCol = mix(uShell, uColorA, 0.35);
        vec3 col = inner*(1.0 - fres*0.6) + shellCol*(fres*1.4 + streak*0.35*(0.3 + fres));

        // rayos que recorren el contorno
        float line = abs(fbm(vec2(cos(a), sin(a))*4.0 + vec2(t*2.5, -t*1.7)) - 0.5);
        float bolt = smoothstep(0.025, 0.0, line)*smoothstep(0.35, 0.8, fres);
        col += vec3(0.75, 0.9, 1.0)*bolt*2.2;

        col *= 1.0 + uHover*0.45 + uBoost*1.6;
        col += vec3(1.0)*smoothstep(0.6, 0.0, r)*uBoost*uBoost*0.8;
        float alpha = clamp(0.2 + fres*0.7 + emb.a*0.55 + streak*0.12 + bolt + uBoost*0.6, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

// Halo exterior aditivo alrededor de la esfera.
export function haloMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uBoost: { value: 0 }, uHover: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uBoost, uHover; varying vec3 vN; varying vec3 vV;
      void main(){
        // caras traseras: dot < 0 en el centro, ~0 en el contorno -> anillo de brillo
        float f = pow(clamp(0.72 + dot(normalize(vN), normalize(vV)), 0.0, 1.0), 3.0)*1.6;
        gl_FragColor = vec4(mix(uColor, vec3(0.4,0.7,1.0), 0.4)*f*(0.28 + uHover*0.35 + uBoost*2.0), f);
      }
    `,
  });
}

// Haz de energía que sale de las manos de los canalizadores.
export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uSeed: { value: Math.random() * 10 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed; uniform vec3 uColor; varying vec2 vUv;
      ${noise}
      void main(){
        float flow = noise(vec2(vUv.y*10.0 - uTime*12.0, uSeed + uTime*2.0));
        float edge = 1.0 - abs(vUv.x - 0.5)*2.0;
        float a = (0.35 + 0.65*flow)*edge*(0.6 + 0.4*sin(uTime*17.0 + uSeed));
        gl_FragColor = vec4((uColor*2.2 + 0.4)*a, a);
      }
    `,
  });
}

// Llama volumétrica barata: planos cruzados con ruido que sube.
export function flameMaterial({ hot = '#ffd77a', cold = '#ff3a08', intensity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uSeed: { value: Math.random() * 20 }, uI: { value: intensity },
      uHot: { value: new THREE.Color(hot) }, uCold: { value: new THREE.Color(cold) },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSeed, uI; uniform vec3 uHot, uCold; varying vec2 vUv;
      ${noise}
      void main(){
        float y = vUv.y;
        float x = (vUv.x - 0.5)*2.0;
        float n = fbm(vec2(vUv.x*3.0 + uSeed, y*2.2 - uTime*2.6));
        float width = (1.0 - y)*(0.35 + 0.65*smoothstep(0.0, 0.3, y)) + 0.02;
        float d = abs(x + (n - 0.5)*0.9*y)/width;
        float body = smoothstep(1.0, 0.25, d)*smoothstep(1.0, 0.55, y + (n - 0.5)*0.5);
        vec3 col = mix(uHot*1.5, uCold*1.1, smoothstep(0.05, 0.75, y + d*0.35));
        gl_FragColor = vec4(col*body*uI, body);
      }
    `,
  });
}
