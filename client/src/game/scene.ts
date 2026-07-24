import * as THREE from "three";
import { buildEnvironment } from "./environment";
import { createCharacter } from "./character";
import { createOutlinePipeline } from "./outlinePipeline";

export interface SceneCallbacks {
  onPostboxReached: () => void;
  onCheckpointReached: () => void;
}

export interface SceneHandle {
  dispose: () => void;
  resumeAfterCheckpoint: () => void;
}

const MOVE_SPEED = 3.6;
const ARRIVE_EPSILON = 0.08;
const CAMERA_OFFSET = new THREE.Vector3(0, 7.4, 8.6);
const LOOK_OFFSET = new THREE.Vector3(0, 0.6, 0.6);
const CAMERA_FOLLOW_SPEED = 3.5;

export function buildScene(container: HTMLDivElement, callbacks: SceneCallbacks): SceneHandle {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  container.appendChild(renderer.domElement);

  const outlinePipeline = createOutlinePipeline(renderer);

  const env = buildEnvironment(scene);
  const character = createCharacter();
  character.group.position.copy(env.spawnPoint);
  scene.add(character.group);

  camera.position.copy(env.spawnPoint).add(CAMERA_OFFSET);
  camera.lookAt(env.spawnPoint.clone().add(LOOK_OFFSET));

  let moveTarget: THREE.Vector3 | null = null;
  let pendingPostboxInteract = false;
  let checkpointPassed = false;
  let resumeToPostbox = false;

  function clampToWalkBounds(point: THREE.Vector3) {
    point.x = Math.min(env.walkBounds.maxX, Math.max(env.walkBounds.minX, point.x));
    point.z = Math.min(env.walkBounds.maxZ, Math.max(env.walkBounds.minZ, point.z));
    return point;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function handlePointerDown(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const postboxHit = raycaster.intersectObject(env.postbox, true);
    if (postboxHit.length > 0) {
      moveTarget = env.postboxStandPoint.clone();
      pendingPostboxInteract = true;
      return;
    }

    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      moveTarget = clampToWalkBounds(hitPoint);
      pendingPostboxInteract = false;
    }
  }

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const pixelRatio = renderer.getPixelRatio();
    outlinePipeline.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  let rafId = 0;
  let lastTime = performance.now();

  function tick(now: number) {
    const dt = Math.min((now - lastTime) / 1000, 0.2);
    lastTime = now;

    if (moveTarget) {
      const pos = character.group.position;
      const prevZ = pos.z;
      const dx = moveTarget.x - pos.x;
      const dz = moveTarget.z - pos.z;
      const distance = Math.hypot(dx, dz);

      if (distance < ARRIVE_EPSILON) {
        character.setMoving(false);
        const arrivedForPostbox = pendingPostboxInteract;
        moveTarget = null;
        pendingPostboxInteract = false;
        if (arrivedForPostbox) callbacks.onPostboxReached();
      } else {
        const step = Math.min(MOVE_SPEED * dt, distance);
        pos.x += (dx / distance) * step;
        pos.z += (dz / distance) * step;
        character.group.rotation.y = Math.atan2(dx, dz);
        character.setMoving(true);

        if (!checkpointPassed && prevZ < env.checkpointZ && pos.z >= env.checkpointZ) {
          checkpointPassed = true;
          resumeToPostbox = pendingPostboxInteract;
          moveTarget = null;
          pendingPostboxInteract = false;
          character.setMoving(false);
          callbacks.onCheckpointReached();
        }
      }
    }

    character.update(dt);

    const desiredCameraPos = character.group.position.clone().add(CAMERA_OFFSET);
    const followT = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * dt);
    camera.position.lerp(desiredCameraPos, followT);
    camera.lookAt(character.group.position.clone().add(LOOK_OFFSET));

    outlinePipeline.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      outlinePipeline.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    },
    resumeAfterCheckpoint() {
      if (resumeToPostbox) {
        moveTarget = env.postboxStandPoint.clone();
        pendingPostboxInteract = true;
        resumeToPostbox = false;
      }
    },
  };
}
