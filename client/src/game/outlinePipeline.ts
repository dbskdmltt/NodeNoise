import * as THREE from "three";

// Screen-space edge detection outline, same family of technique found in messenger.abeto.co's
// bundle (normal+depth "info buffer" sampled at neighboring texels). Renders the scene 3x per
// frame: (1) normals+depth, (2) real toon-shaded colors, (3) a fullscreen composite that draws
// dark lines wherever neighboring normals/depths diverge sharply.

const EDGE_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const EDGE_FRAGMENT_SHADER = `
  uniform sampler2D tDiffuse;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform vec3 outlineColor;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float normalThreshold;
  uniform float depthThreshold;
  uniform vec2 outlineFade;
  uniform float paperGrainStrength;
  uniform vec3 warmTint;
  uniform float warmTintStrength;
  uniform float vignetteStrength;
  varying vec2 vUv;

  float linearDepth(float d) {
    float z = d * 2.0 - 1.0;
    return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
  }

  // 시드 텍스처 없이 즉석에서 만드는 종이 결 노이즈 — 픽셀마다 살짝 다른 밝기를
  // 얹어 평평한 카툰 면에 수채화 특유의 우둘투둘한 질감을 흉내낸다.
  float paperGrain(vec2 uv) {
    return fract(sin(dot(uv * 900.0, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 normal = texture2D(tNormal, vUv).rgb * 2.0 - 1.0;
    float depth = linearDepth(texture2D(tDepth, vUv).r);

    float edge = 0.0;
    vec2 offsets[4];
    offsets[0] = vec2(texel.x, 0.0);
    offsets[1] = vec2(-texel.x, 0.0);
    offsets[2] = vec2(0.0, texel.y);
    offsets[3] = vec2(0.0, -texel.y);

    for (int i = 0; i < 4; i++) {
      vec2 uv2 = vUv + offsets[i];
      vec3 n2 = texture2D(tNormal, uv2).rgb * 2.0 - 1.0;
      float d2 = linearDepth(texture2D(tDepth, uv2).r);
      float normalDiff = 1.0 - dot(normal, n2);
      float depthDiff = abs(depth - d2) / depth;
      if (normalDiff > normalThreshold || depthDiff > depthThreshold) {
        edge = 1.0;
      }
    }

    float fade = 1.0 - smoothstep(outlineFade.x, outlineFade.y, depth);
    edge *= fade;

    vec4 color = texture2D(tDiffuse, vUv);
    vec3 result = mix(color.rgb, outlineColor, edge);

    // 수채화풍 마감: 종이 결 + 여름 햇살에 가까운 따뜻한 색보정 + 화면 가장자리를
    // 살짝 눌러주는 비네트. 실제 물감 번짐은 아니지만 손그림에 가까운 질감을 낸다.
    float grain = paperGrain(vUv);
    result += (grain - 0.5) * paperGrainStrength;
    result = mix(result, result * warmTint, warmTintStrength);
    float vignette = smoothstep(0.98, 0.35, length(vUv - 0.5));
    result *= mix(vignetteStrength, 1.0, vignette);

    gl_FragColor = vec4(result, 1.0);
  }
`;

export interface OutlinePipeline {
  render: (scene: THREE.Scene, camera: THREE.PerspectiveCamera) => void;
  setSize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createOutlinePipeline(renderer: THREE.WebGLRenderer): OutlinePipeline {
  const normalMaterial = new THREE.MeshNormalMaterial();

  function makeTargets(w: number, h: number) {
    const colorTarget = new THREE.WebGLRenderTarget(w, h);
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.FloatType;
    const normalTarget = new THREE.WebGLRenderTarget(w, h, { depthTexture });
    return { colorTarget, normalTarget };
  }

  let { colorTarget, normalTarget } = makeTargets(1, 1);

  const edgeMaterial = new THREE.ShaderMaterial({
    vertexShader: EDGE_VERTEX_SHADER,
    fragmentShader: EDGE_FRAGMENT_SHADER,
    uniforms: {
      tDiffuse: { value: colorTarget.texture },
      tNormal: { value: normalTarget.texture },
      tDepth: { value: normalTarget.depthTexture },
      texel: { value: new THREE.Vector2(1, 1) },
      outlineColor: { value: new THREE.Color("#2b2f3a") },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 300 },
      normalThreshold: { value: 0.15 },
      depthThreshold: { value: 0.01 },
      outlineFade: { value: new THREE.Vector2(60, 200) },
      paperGrainStrength: { value: 0.035 },
      warmTint: { value: new THREE.Vector3(1.07, 1.01, 0.9) },
      warmTintStrength: { value: 0.4 },
      vignetteStrength: { value: 0.88 },
    },
    depthTest: false,
    depthWrite: false,
  });

  const fsScene = new THREE.Scene();
  const fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMaterial);
  fsScene.add(fsQuad);

  function setSize(w: number, h: number) {
    colorTarget.dispose();
    normalTarget.dispose();
    const targets = makeTargets(w, h);
    colorTarget = targets.colorTarget;
    normalTarget = targets.normalTarget;
    edgeMaterial.uniforms.tDiffuse.value = colorTarget.texture;
    edgeMaterial.uniforms.tNormal.value = normalTarget.texture;
    edgeMaterial.uniforms.tDepth.value = normalTarget.depthTexture;
    edgeMaterial.uniforms.texel.value.set(1 / w, 1 / h);
  }

  function render(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    edgeMaterial.uniforms.cameraNear.value = camera.near;
    edgeMaterial.uniforms.cameraFar.value = camera.far;

    const prevOverride = scene.overrideMaterial;
    scene.overrideMaterial = normalMaterial;
    renderer.setRenderTarget(normalTarget);
    renderer.render(scene, camera);
    scene.overrideMaterial = prevOverride;

    renderer.setRenderTarget(colorTarget);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.render(fsScene, fsCamera);
  }

  function dispose() {
    colorTarget.dispose();
    normalTarget.dispose();
    normalMaterial.dispose();
    edgeMaterial.dispose();
    fsQuad.geometry.dispose();
  }

  return { render, setSize, dispose };
}
