import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Pantalla de cruce: nebulosa arremolinada del color del proyecto, estrellas en salto
// hiperespacial y el círculo mágico girando. Se mezcla con la escena según uProgress.
const TransitionShader = {
  uniforms: {
    tDiffuse: { value: null },
    tCircle: { value: null },
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uColor: { value: new THREE.Color('#ffffff') },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tCircle; uniform float uProgress, uTime, uAspect; uniform vec3 uColor;
    varying vec2 vUv;
    float hash(float n){ return fract(sin(n*127.1)*43758.5453); }
    float hash2(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
      return mix(mix(hash2(i),hash2(i+vec2(1,0)),u.x), mix(hash2(i+vec2(0,1)),hash2(i+vec2(1,1)),u.x), u.y); }
    float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
    mat2 rot(float a){ return mat2(cos(a),-sin(a),sin(a),cos(a)); }
    void main(){
      vec3 scene = texture2D(tDiffuse, vUv).rgb;
      float p = uProgress;
      if (p <= 0.0) { gl_FragColor = vec4(scene, 1.0); return; }
      vec2 c = (vUv - 0.5)*vec2(uAspect, 1.0);
      float r = length(c);
      float a = atan(c.y, c.x);

      // estrellas estirándose hacia afuera (salto)
      float bins = 220.0;
      float fa = (a/6.2831853 + 0.5)*bins;
      float id = floor(fa);
      float h = hash(id);
      float z = fract(h*7.13 + uTime*(0.25 + h*0.6)*(0.4 + p*3.5));
      float len = 0.012 + p*0.12;
      float streak = smoothstep(len, 0.0, abs(r - z*1.3))*step(0.72, hash(id + 3.7));
      // grosor constante en pantalla, sin importar la distancia al centro
      float across = abs(fract(fa) - 0.5)/bins*6.2831853*r;
      streak *= smoothstep(0.0022, 0.0, across)*smoothstep(0.03, 0.15, r);

      // nebulosa arremolinada
      vec2 q = rot(uTime*0.25 + 1.4/(r + 0.25))*c;
      float n = fbm(q*3.2 + vec2(uTime*0.08, -uTime*0.05));
      float m = fbm(q*1.6 - uTime*0.04);
      vec3 neb = mix(vec3(0.015, 0.015, 0.06), uColor*0.55, smoothstep(0.3, 0.85, n));
      neb += vec3(0.25, 0.16, 0.6)*smoothstep(0.45, 0.9, m)*0.6;
      neb += vec3(0.9, 0.92, 1.0)*step(0.996, hash2(floor(vUv*vec2(uAspect, 1.0)*420.0)))*0.8;

      // círculo mágico girando en el centro
      vec2 cu = rot(uTime*0.4)*c/(0.62 + 0.03*sin(uTime*2.0)) + 0.5;
      vec4 mc = (cu.x > 0.0 && cu.x < 1.0 && cu.y > 0.0 && cu.y < 1.0) ? texture2D(tCircle, cu) : vec4(0.0);
      vec2 cu2 = rot(-uTime*0.25)*c/0.95 + 0.5;
      vec4 mc2 = (cu2.x > 0.0 && cu2.x < 1.0 && cu2.y > 0.0 && cu2.y < 1.0) ? texture2D(tCircle, cu2) : vec4(0.0);

      vec3 over = neb;
      over += uColor*streak*0.9 + vec3(1.0)*streak*0.25;
      over += mc.rgb*mc.a*1.1*smoothstep(0.55, 0.9, p) + mc2.rgb*mc2.a*0.35*smoothstep(0.6, 1.0, p);
      over += uColor*exp(-r*7.0)*(0.35 + 0.2*sin(uTime*3.0))*smoothstep(0.5, 1.0, p);
      over *= mix(0.55, 1.0, smoothstep(0.9, 0.25, r));

      // primero las estrellas sobre la escena, luego la nebulosa la cubre
      vec3 col = scene + (uColor*0.9 + 0.3)*streak*smoothstep(0.15, 0.45, p);
      col = mix(col, over, smoothstep(0.45, 0.82, p));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createTransitionPass() {
  return new ShaderPass(TransitionShader);
}
