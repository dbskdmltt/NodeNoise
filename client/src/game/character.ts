import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { addOutline, toonMaterial } from "./toon";

export interface Character {
  group: THREE.Group;
  setMoving: (moving: boolean, opts?: { running?: boolean }) => void;
  face: (dx: number, dz: number, dt: number) => void;
  update: (dt: number) => void;
}

const TARGET_HEIGHT = 1.7; // world units — roughly matches the village's human scale

// Meshy exports this character as one file per animation, all sharing the same rig
// ("...with_a__biped_Animation_<name>_withSkin.glb"). We display the Idle mesh and pull the
// rest of the clips out of their own files, then bind everything to one AnimationMixer.
const MODEL_DIR = "/models/Meshy_AI_Young_Barista_with_a__biped_Animation_";
const CLIP_FILES: Record<string, string> = {
  idle: `${MODEL_DIR}Idle_15_withSkin.glb`,
  walk: `${MODEL_DIR}Walking_withSkin.glb`,
  run: `${MODEL_DIR}Running_withSkin.glb`,
  turnLeft: `${MODEL_DIR}Walk_Turn_Left_withSkin.glb`,
  mirror: `${MODEL_DIR}Mirror_Viewing_withSkin.glb`,
  sitTransition: `${MODEL_DIR}Step_to_Sit_Transition_withSkin.glb`,
};

const TURN_THRESHOLD = 2.0; // radians — only play the turn-left clip for a sharp reversal
const TURN_LERP_SPEED = 9;
const IDLE_VARIATION_MIN = 6;
const IDLE_VARIATION_MAX = 12;

// Many exported walk/run cycles bake forward translation into the root/hip bone ("root motion").
// We drive world position ourselves via click-to-move, so keep only the rotation tracks (the
// actual limb articulation) — otherwise the two translations stack and the clip's loop point
// visibly snaps the model back to its start-of-clip offset every cycle.
function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => !track.name.endsWith(".position"));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function shortestAngleDiff(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
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

  let bodyForBob = fallback; // whichever visual root we bob up/down while walking (fallback only)
  const legs: THREE.Object3D[] = [fallback.children[0], fallback.children[1]]; // leftLeg, rightLeg

  let mixer: THREE.AnimationMixer | null = null;
  const actions: Partial<Record<keyof typeof CLIP_FILES, THREE.AnimationAction>> = {};
  let currentAction: THREE.AnimationAction | null = null;
  let modelReady = false;

  function play(name: keyof typeof CLIP_FILES, fade = 0.25) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    currentAction?.fadeOut(fade);
    currentAction = next;
  }

  const loader = new GLTFLoader();

  loader.load(
    CLIP_FILES.idle,
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

      fallback.visible = false;
      group.add(model);
      bodyForBob = model;
      modelReady = true;

      mixer = new THREE.AnimationMixer(model);
      if (gltf.animations[0]) {
        actions.idle = mixer.clipAction(stripRootMotion(gltf.animations[0]));
        play("idle", 0);
      }

      // Pull the remaining clips from their own files and bind them to the same mixer/skeleton
      // (all six files share the same rig, so retargeting is just a name-matched bind).
      const remaining = (Object.keys(CLIP_FILES) as (keyof typeof CLIP_FILES)[]).filter(
        (name) => name !== "idle"
      );
      for (const name of remaining) {
        loader.load(
          CLIP_FILES[name],
          (clipGltf) => {
            const clip = clipGltf.animations[0];
            if (!clip || !mixer) return;
            const action = mixer.clipAction(stripRootMotion(clip));
            action.clampWhenFinished = name === "turnLeft";
            action.loop = name === "turnLeft" ? THREE.LoopOnce : THREE.LoopRepeat;
            actions[name] = action;
          },
          undefined,
          (err) => console.error("[character] failed to load clip", name, err)
        );
      }
    },
    undefined,
    (err) => console.error("[character] failed to load", CLIP_FILES.idle, err)
  );

  let moving = false;
  let running = false;
  let t = 0;
  let heading = 0; // current facing, radians
  let turnTimer = 0; // >0 while the turn-left clip is playing out
  let idleVariationTimer = IDLE_VARIATION_MIN + Math.random() * (IDLE_VARIATION_MAX - IDLE_VARIATION_MIN);

  return {
    group,
    setMoving(value, opts) {
      const wasMoving = moving;
      moving = value;
      running = value ? Boolean(opts?.running) : false;

      if (!value) {
        t = 0;
        legs[0].rotation.x = 0;
        legs[1].rotation.x = 0;
        group.position.y = 0;
        if (modelReady) play("idle");
        idleVariationTimer = IDLE_VARIATION_MIN + Math.random() * (IDLE_VARIATION_MAX - IDLE_VARIATION_MIN);
        return;
      }

      if (!wasMoving && modelReady) {
        const diff = Math.abs(shortestAngleDiff(heading, group.rotation.y));
        if (diff > TURN_THRESHOLD && actions.turnLeft) {
          turnTimer = actions.turnLeft.getClip().duration;
          play("turnLeft", 0.15);
        } else {
          play(running && actions.run ? "run" : "walk");
        }
      }
    },
    face(dx, dz, dt) {
      const target = Math.atan2(dx, dz);
      if (!modelReady) {
        group.rotation.y = target;
        heading = target;
        return;
      }
      const diff = shortestAngleDiff(group.rotation.y, target);
      const lerpT = 1 - Math.exp(-TURN_LERP_SPEED * dt);
      group.rotation.y += diff * lerpT;
      heading = target;
    },
    update(dt) {
      if (mixer) {
        // Idle personality: after a while standing still, glance in the mirror and settle back.
        if (!moving && currentAction === actions.idle) {
          idleVariationTimer -= dt;
          if (idleVariationTimer <= 0 && actions.mirror) {
            play("mirror", 0.4);
            idleVariationTimer = actions.mirror.getClip().duration + 1;
          } else if (currentAction === actions.mirror && !actions.mirror?.isRunning()) {
            play("idle", 0.4);
          }
        }

        if (moving && turnTimer > 0) {
          turnTimer -= dt;
          if (turnTimer <= 0) play(running && actions.run ? "run" : "walk");
        }

        mixer.update(dt);
      }

      if (!moving) return;

      if (mixer && modelReady) return; // clip drives the walk/run cycle — skip the manual bob below

      t += dt * 8;
      if (bodyForBob === fallback) {
        legs[0].rotation.x = Math.sin(t) * 0.5;
        legs[1].rotation.x = -Math.sin(t) * 0.5;
      }
      group.position.y = Math.abs(Math.sin(t)) * 0.03;
    },
  };
}
