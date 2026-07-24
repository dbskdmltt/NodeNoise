import * as THREE from "three";
import { toonMaterial } from "./toon";

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Environment {
  postbox: THREE.Object3D;
  walkBounds: WalkBounds;
  spawnPoint: THREE.Vector3;
  postboxStandPoint: THREE.Vector3;
  checkpointZ: number;
}

const HOUSE_ZS = [-8, -4, 0, 4, 8];
const ROW_X = 4.5;
const ROOF_COLORS = ["#a8503a", "#7a5a8a", "#4a7a8a", "#8a7a4a", "#8a4a5a"];
const STREET_LENGTH = 22;
const POSTBOX_Z = 9.6;
const CHECKPOINT_Z = 8.7;

function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  return new THREE.Mesh(geometry, toonMaterial(color));
}

function buildSkyDome(scene: THREE.Scene) {
  const geometry = new THREE.SphereGeometry(90, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color("#8fd7d1") },
      bottomColor: { value: new THREE.Color("#e7f4ee") },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geometry, material);
  scene.add(sky);
}

function buildHouse(
  scene: THREE.Scene,
  x: number,
  z: number,
  rotationY: number,
  roofColor: string,
  isMaiHouse = false
) {
  const house = new THREE.Group();

  const body = mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), isMaiHouse ? "#f2e9cd" : "#e8d9b8");
  body.position.set(0, 0.8, 0);
  house.add(body);

  const roof = mesh(new THREE.ConeGeometry(1.75, 1, 4), roofColor);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 1.6 + 0.5, 0);
  house.add(roof);

  const door = mesh(new THREE.BoxGeometry(0.55, 0.95, 0.06), "#6b4a30");
  door.position.set(0, 0.48, 1.13);
  house.add(door);

  house.rotation.y = rotationY;
  house.position.set(x, 0, z);
  scene.add(house);
}

function buildDriveway(scene: THREE.Scene, side: number, z: number) {
  const driveway = mesh(new THREE.PlaneGeometry(4.6, 1.0), "#d8cba4");
  driveway.rotation.x = -Math.PI / 2;
  driveway.position.set(side * 2.3, 0.012, z);
  scene.add(driveway);
}

function buildVillage(scene: THREE.Scene) {
  let colorIndex = 0;
  HOUSE_ZS.forEach((z, i) => {
    buildHouse(scene, -ROW_X, z, Math.PI / 2, ROOF_COLORS[colorIndex % ROOF_COLORS.length], i === 0);
    buildDriveway(scene, -1, z);
    colorIndex++;

    buildHouse(scene, ROW_X, z, -Math.PI / 2, ROOF_COLORS[colorIndex % ROOF_COLORS.length]);
    buildDriveway(scene, 1, z);
    colorIndex++;
  });
}

function buildTree(scene: THREE.Scene, x: number, z: number, scale = 1) {
  const tree = new THREE.Group();

  const trunk = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.9, 8), "#6b4a30");
  trunk.position.set(0, 0.45, 0);
  tree.add(trunk);

  const foliageLow = mesh(new THREE.SphereGeometry(0.55, 10, 10), "#4c8a49");
  foliageLow.position.set(0, 1.05, 0);
  tree.add(foliageLow);

  const foliageTop = mesh(new THREE.SphereGeometry(0.4, 10, 10), "#5f9a5a");
  foliageTop.position.set(0, 1.5, 0);
  tree.add(foliageTop);

  tree.scale.setScalar(scale);
  tree.position.set(x, 0, z);
  scene.add(tree);
}

function buildTrees(scene: THREE.Scene) {
  const spots: Array<[number, number, number]> = [
    [-7.4, -9.2, 1.05],
    [7.6, -8.4, 0.95],
    [-7.8, -1.5, 1.1],
    [7.9, 1.8, 1.0],
    [-7.4, 6.6, 1.05],
    [7.6, 9.0, 0.95],
  ];
  spots.forEach(([x, z, scale]) => buildTree(scene, x, z, scale));
}

function buildStreet(scene: THREE.Scene) {
  const street = mesh(new THREE.PlaneGeometry(1.6, STREET_LENGTH), "#c9b98f");
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, 0.011, 0.3);
  scene.add(street);
}

function buildCheckpoint(scene: THREE.Scene) {
  const checkpoint = new THREE.Group();

  const postLeft = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), "#7a7a72");
  postLeft.position.set(-0.9, 0.55, 0);
  checkpoint.add(postLeft);

  const postRight = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 8), "#7a7a72");
  postRight.position.set(0.9, 0.55, 0);
  checkpoint.add(postRight);

  const barrierArm = mesh(new THREE.BoxGeometry(1.9, 0.1, 0.1), "#c0392b");
  barrierArm.position.set(0, 1.0, 0);
  checkpoint.add(barrierArm);

  const booth = mesh(new THREE.BoxGeometry(0.9, 1.3, 0.9), "#dcd3bd");
  booth.position.set(1.7, 0.65, -0.6);
  checkpoint.add(booth);

  const boothRoof = mesh(new THREE.ConeGeometry(0.75, 0.6, 4), "#7a5a8a");
  boothRoof.rotation.y = Math.PI / 4;
  boothRoof.position.set(1.7, 1.6, -0.6);
  checkpoint.add(boothRoof);

  checkpoint.position.set(0, 0, CHECKPOINT_Z);
  scene.add(checkpoint);
}

function buildPostbox(scene: THREE.Scene): THREE.Object3D {
  const postbox = new THREE.Group();

  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), "#7a7a72");
  pole.position.set(0, 0.45, 0);
  postbox.add(pole);

  const box = mesh(new THREE.BoxGeometry(0.4, 0.32, 0.55), "#c0392b");
  box.position.set(0, 1.0, 0);
  postbox.add(box);

  const lid = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 12, 1, false, 0, Math.PI), "#a83224");
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  lid.position.set(0, 1.16, 0);
  postbox.add(lid);

  const flag = mesh(new THREE.BoxGeometry(0.03, 0.16, 0.1), "#e0b23c");
  flag.position.set(0.22, 1.05, 0.15);
  postbox.add(flag);

  postbox.position.set(0, 0, POSTBOX_Z);
  scene.add(postbox);
  return postbox;
}

function buildGround(scene: THREE.Scene) {
  const ground = mesh(new THREE.PlaneGeometry(24, 26), "#8fbf7a");
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0.3);
  scene.add(ground);
}

export function buildEnvironment(scene: THREE.Scene): Environment {
  buildSkyDome(scene);
  buildGround(scene);
  buildStreet(scene);
  buildVillage(scene);
  buildTrees(scene);
  buildCheckpoint(scene);
  const postbox = buildPostbox(scene);

  const hemi = new THREE.HemisphereLight("#ffffff", "#8fbf7a", 1.1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff6e0", 1.8);
  sun.position.set(6, 9, 5);
  scene.add(sun);

  const fill = new THREE.AmbientLight("#ffffff", 0.5);
  scene.add(fill);

  return {
    postbox,
    walkBounds: { minX: -5.5, maxX: 5.5, minZ: -9.3, maxZ: 9.2 },
    spawnPoint: new THREE.Vector3(-2.0, 0, -8),
    postboxStandPoint: new THREE.Vector3(0, 0, 9.3),
    checkpointZ: CHECKPOINT_Z,
  };
}
