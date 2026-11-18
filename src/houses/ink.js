import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Rampa de 4 tonos para el sombreado tipo anime.
export function toonGradient() {
  const data = new Uint8Array([70, 135, 200, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Contornos de tinta (bordes de profundidad, normal y silueta) y tramado de plumilla en las sombras.
const InkShader = {
  uniforms: {
    tDiffuse: { value: null },
    tNormal: { value: null },
    tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uNear: { value: 0.1 },
    uFar: { value: 900 },
    uInk: { value: new THREE.Color('#120a26') },
    uThickness: { value: 1 },
    uHatch: { value: 1 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tNormal, tDepth;
    uniform vec2 uResolution; uniform float uNear, uFar, uThickness, uHatch; uniform vec3 uInk;
    varying vec2 vUv;
    float lin(vec2 uv){ float z = texture2D(tDepth, uv).x*2.0 - 1.0; return (2.0*uNear*uFar)/(uFar + uNear - z*(uFar - uNear)); }
    vec4 nrm(vec2 uv){ vec4 n = texture2D(tNormal, uv); return vec4(n.rgb*2.0 - 1.0, n.a); }
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      vec2 px = uThickness/uResolution;
      vec2 o[4]; o[0] = vec2(px.x, 0.0); o[1] = vec2(-px.x, 0.0); o[2] = vec2(0.0, px.y); o[3] = vec2(0.0, -px.y);
      float d0 = lin(vUv); vec4 n0 = nrm(vUv);
      float dE = 0.0, nE = 0.0, aE = 0.0, aMax = n0.a;
      for (int i = 0; i < 4; i++) {
        vec4 ni = nrm(vUv + o[i]);
        dE += abs(lin(vUv + o[i]) - d0);
        nE += distance(ni.rgb, n0.rgb)*min(ni.a, n0.a);
        aE += abs(ni.a - n0.a);
        aMax = max(aMax, ni.a);
      }
      // de lejos solo quedan las siluetas, más finas; las líneas interiores (estrías, dentículos) se desvanecen
      float farF = smoothstep(25.0, 110.0, d0);
      float edgeD = smoothstep(0.03, 0.09, dE/d0)*(1.0 - farF*0.7);
      float edgeN = smoothstep(0.5, 1.1, nE)*(1.0 - smoothstep(18.0, 55.0, d0));
      float edgeS = smoothstep(0.25, 1.0, aE)*0.85;
      float edge = max(max(edgeD, edgeN), edgeS);
      edge *= aMax*mix(1.0, 0.5, farF);
      // tramado diagonal en zonas oscuras (solo sobre geometría)
      float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      vec2 sp = gl_FragCoord.xy;
      float l1 = 1.0 - smoothstep(0.4, 1.2, abs(mod(sp.x + sp.y, 6.0) - 3.0));
      float l2 = 1.0 - smoothstep(0.4, 1.2, abs(mod(sp.x - sp.y, 6.0) - 3.0));
      float hatch = (l1*(1.0 - smoothstep(0.06, 0.16, lum)) + l2*(1.0 - smoothstep(0.02, 0.07, lum)))*n0.a*uHatch;
      hatch *= 1.0 - smoothstep(20.0, 50.0, d0);
      col.rgb = mix(col.rgb, uInk, clamp(hatch*0.55, 0.0, 1.0));
      col.rgb = mix(col.rgb, uInk, edge*0.92);
      gl_FragColor = col;
    }
  `,
};

// Rayos de luz desde el núcleo galáctico, tapados por la geometría; más viñeta y gradación.
const RaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    tMask: { value: null },
    uLight: { value: new THREE.Vector2(0.5, 0.5) },
    uStrength: { value: 0.0 },
    uTint: { value: new THREE.Color('#c9b4ff') },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask; uniform vec2 uLight; uniform float uStrength; uniform vec3 uTint;
    varying vec2 vUv;
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      vec3 acc = vec3(0.0);
      if (uStrength > 0.0) {
        vec2 delta = (vUv - uLight)*0.9/48.0;
        vec2 c = vUv; float illum = 1.0;
        for (int i = 0; i < 48; i++) {
          c -= delta;
          vec3 s = texture2D(tDiffuse, c).rgb;
          float occ = 1.0 - texture2D(tMask, c).a;
          float b = max(0.0, dot(s, vec3(0.333)) - 0.45);
          acc += uTint*b*occ*illum;
          illum *= 0.955;
        }
        acc *= uStrength/48.0;
      }
      vec3 col = base + acc;
      // gradación: sombras hacia violeta, luces hacia cálido
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col*vec3(0.92, 0.9, 1.08), col*vec3(1.05, 1.0, 0.94), smoothstep(0.2, 0.8, l));
      float v = smoothstep(0.95, 0.35, length(vUv - 0.5));
      col *= mix(0.62, 1.0, v);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createInkPipeline({ renderer, scene, camera, coreDir, noInk }) {
  const size = new THREE.Vector2();
  const makeTarget = () => {
    renderer.getDrawingBufferSize(size);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y) });
    rt.texture.minFilter = rt.texture.magFilter = THREE.NearestFilter;
    return rt;
  };
  let target = makeTarget();
  const normalMat = new THREE.MeshNormalMaterial();

  const ink = new ShaderPass(InkShader);
  const rays = new ShaderPass(RaysShader);
  const bind = () => {
    ink.uniforms.tNormal.value = target.texture;
    ink.uniforms.tDepth.value = target.depthTexture;
    ink.uniforms.uResolution.value.copy(size);
    ink.uniforms.uThickness.value = Math.max(1, renderer.getPixelRatio());
    rays.uniforms.tMask.value = target.texture;
  };
  bind();

  const clear = new THREE.Color();
  const tmp = new THREE.Vector3();
  // Render de normales y profundidad para los contornos (sin cielo, partículas ni sprites).
  function beforeRender() {
    ink.uniforms.uNear.value = camera.near;
    ink.uniforms.uFar.value = camera.far;
    const hidden = noInk.filter((o) => o.visible);
    hidden.forEach((o) => { o.visible = false; });
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    scene.overrideMaterial = normalMat;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, prevAlpha);
    scene.overrideMaterial = null;
    hidden.forEach((o) => { o.visible = true; });

    // posición en pantalla del núcleo galáctico
    tmp.copy(camera.position).addScaledVector(coreDir, 300).project(camera);
    const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.6 && Math.abs(tmp.y) < 1.6;
    rays.uniforms.uLight.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
    const edge = THREE.MathUtils.clamp(Math.max(Math.abs(tmp.x), Math.abs(tmp.y)) - 0.6, 0, 1);
    rays.uniforms.uStrength.value = onScreen ? 0.5 * (1 - edge) : 0;
  }

  function setSize() {
    target.dispose();
    target = makeTarget();
    bind();
  }

  return { ink, rays, beforeRender, setSize, depth: () => target.depthTexture, size: () => size };
}
