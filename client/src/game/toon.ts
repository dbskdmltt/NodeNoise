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
