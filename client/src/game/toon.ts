import * as THREE from "three";

let gradientMap: THREE.Texture | null = null;

export function createToonGradientMap(): THREE.Texture {
  if (gradientMap) return gradientMap;

  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const shades = ["#8a8a8a", "#b3b3b3", "#dedede", "#ffffff"];
  shades.forEach((shade, i) => {
    ctx.fillStyle = shade;
    ctx.fillRect(i, 0, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  gradientMap = texture;
  return texture;
}

export function toonMaterial(color: THREE.ColorRepresentation) {
  return new THREE.MeshToonMaterial({ color, gradientMap: createToonGradientMap() });
}

// Inverted-hull silhouette outline. The post-process edge pipeline (outlinePipeline.ts) handles
// flat-shaded low-poly props well, but smooth/organic models (loaded glTF characters) have
// gradual per-pixel normal changes that neighbor-diff edge detection can't reliably catch — this
// per-mesh silhouette trick is the right tool for those instead.
const outlineMaterial = new THREE.MeshBasicMaterial({
  color: "#2b2f3a",
  side: THREE.BackSide,
});

export function addOutline(mesh: THREE.Mesh, scale = 1.04) {
  const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outline.scale.setScalar(scale);
  mesh.add(outline);
  return outline;
}

// 스캔/생성된 GLB 텍스처를 캔버스에 CSS filter로 한 번 구워 색을 보정한 새 텍스처를
// 만든다. material.color를 곱하는 방식과 달리 텍스처 자체를 고치므로 채도/색조가
// 실제로 바뀐다. flipY 등 샘플링 관련 설정은 원본 텍스처에서 그대로 복사해 UV가
// 틀어지지 않게 한다.
export function recolorTexture(source: THREE.Texture, filter: string): THREE.Texture {
  const image = source.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = filter;
  ctx.drawImage(image, 0, 0);

  const recolored = new THREE.CanvasTexture(canvas);
  recolored.colorSpace = source.colorSpace;
  recolored.wrapS = source.wrapS;
  recolored.wrapT = source.wrapT;
  recolored.flipY = source.flipY;
  recolored.repeat.copy(source.repeat);
  recolored.offset.copy(source.offset);
  recolored.center.copy(source.center);
  recolored.rotation = source.rotation;
  recolored.needsUpdate = true;
  return recolored;
}
