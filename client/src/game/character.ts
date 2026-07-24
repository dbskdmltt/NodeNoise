import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { addOutline, toonMaterial } from "./toon";

export interface Character {
  group: THREE.Group;
  setMoving: (moving: boolean) => void;
  update: (dt: number) => void;
}

const TARGET_HEIGHT = 1.7; // world units — roughly matches the village's human scale
const MODEL_URL = "/models/Untitled.glb";

// Many exported walk cycles bake forward translation into the root/hip bone ("root motion").
// We drive world position ourselves via click-to-move, so keep only the rotation tracks (the
// actual limb articulation) — otherwise the two translations stack and the clip's loop point
// visibly snaps the model back to its start-of-clip offset every cycle.
function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const m = new THREE.Mesh(geometry, toonMaterial(color));
  addOutline(m);
  return m;
}

function buildPrimitiveFallback(): THREE.Group {
  const fallback = new THREE.Group();

  const SKIN = "#f0c8a0";
  const HAIR = "#2b2320";
  const TOP = "#d68a4c";
  const APRON = "#f2ece1";
  const PANTS = "#4a4438";
  const SHOES = "#2b2320";

  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10);
  const leftLeg = mesh(legGeo, PANTS);
  leftLeg.position.set(-0.12, 0.25, 0);
  const rightLeg = mesh(legGeo, PANTS);
  rightLeg.position.set(0.12, 0.25, 0);
  fallback.add(leftLeg, rightLeg);

  const shoeGeo = new THREE.BoxGeometry(0.13, 0.07, 0.22);
  const leftShoe = mesh(shoeGeo, SHOES);
  leftShoe.position.set(-0.12, 0.035, 0.05);
  const rightShoe = mesh(shoeGeo, SHOES);
  rightShoe.position.set(0.12, 0.035, 0.05);
  fallback.add(leftShoe, rightShoe);

  const torsoGeo = new THREE.CylinderGeometry(0.2, 0.23, 0.5, 12);
  const torso = mesh(torsoGeo, TOP);
  torso.position.set(0, 0.75, 0);
  fallback.add(torso);

  const apronGeo = new THREE.BoxGeometry(0.28, 0.34, 0.04);
  const apron = mesh(apronGeo, APRON);
  apron.position.set(0, 0.7, 0.16);
  fallback.add(apron);

  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8);
  const leftArm = mesh(armGeo, TOP);
  leftArm.position.set(-0.27, 0.78, 0);
  leftArm.rotation.z = 0.12;
  const rightArm = mesh(armGeo, TOP);
  rightArm.position.set(0.27, 0.78, 0);
  rightArm.rotation.z = -0.12;
  fallback.add(leftArm, rightArm);

  const headGeo = new THREE.SphereGeometry(0.19, 16, 16);
  const head = mesh(headGeo, SKIN);
  head.position.set(0, 1.19, 0);
  fallback.add(head);

  const hairGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const hair = mesh(hairGeo, HAIR);
  hair.scale.set(1, 0.9, 1.05);
  hair.position.set(0, 1.24, -0.03);
  fallback.add(hair);

  const bunGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const bun = mesh(bunGeo, HAIR);
  bun.position.set(0, 1.3, -0.16);
  fallback.add(bun);

  return fallback;
}

export function createCharacter(): Character {
  const group = new THREE.Group();

  const fallback = buildPrimitiveFallback();
  group.add(fallback);

  let bodyForBob = fallback; // whichever visual root we bob up/down while walking
  const legs: THREE.Object3D[] = [fallback.children[0], fallback.children[1]]; // leftLeg, rightLeg

  let mixer: THREE.AnimationMixer | null = null;
  let walkAction: THREE.AnimationAction | null = null;

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;

      // Auto-fit: real export scale/units are unknown, so normalize by bounding box.
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
      model.scale.setScalar(scale);

      // Re-measure after scaling, then sit the model's feet on y=0.
      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.y -= scaledBox.min.y;

      const meshes: THREE.Mesh[] = [];
      model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh);
      });
      for (const meshObj of meshes) {
        meshObj.castShadow = false;
        meshObj.receiveShadow = false;
        addOutline(meshObj);
      }

      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const rawClip =
          gltf.animations.find((clip) => /walk/i.test(clip.name)) ?? gltf.animations[0];
        walkAction = mixer.clipAction(stripRootMotion(rawClip));
        walkAction.play();
        walkAction.paused = true;
      }

      fallback.visible = false;
      group.add(model);
      bodyForBob = model;
    },
    undefined,
    (err) => console.error("[character] failed to load", MODEL_URL, err)
  );

  let moving = false;
  let t = 0;

  return {
    group,
    setMoving(value: boolean) {
      if (!value) {
        t = 0;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        group.position.y = 0;
        if (walkAction) walkAction.paused = true;
      }
      moving = value;
    },
    update(dt: number) {
      if (!moving) return;

      if (mixer && walkAction) {
        walkAction.paused = false;
        mixer.update(dt);
        return; // the clip drives its own motion — skip the manual bob/leg-swing below
      }

      t += dt * 8;
      if (bodyForBob === fallback) {
        legs[0].rotation.x = Math.sin(t) * 0.5;
        legs[1].rotation.x = -Math.sin(t) * 0.5;
      }
      group.position.y = Math.abs(Math.sin(t)) * 0.03;
    },
  };
}
