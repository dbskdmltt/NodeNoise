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
  goHome: () => void;
}

const MOVE_SPEED = 3.6;
const ARRIVE_EPSILON = 0.08;
const RUN_DISTANCE = 4.5; // clicks farther than this trigger the run cycle instead of walk
const CAMERA_OFFSET = new THREE.Vector3(0, 6.3, 7.4);
const LOOK_OFFSET = new THREE.Vector3(0, 0.9, 0);
const CAMERA_FOLLOW_SPEED = 3.5;

// 카메라 궤도 회전: CAMERA_OFFSET(캐릭터 기준 카메라 위치)을 구면좌표로 분해해서
// 기본값으로 삼고, 왼쪽 드래그로 여기에 yaw/pitch를 더한다.
const BASE_YAW = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
const BASE_HORIZONTAL = Math.hypot(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
const BASE_PITCH = Math.atan2(CAMERA_OFFSET.y, BASE_HORIZONTAL);
const BASE_RADIUS = Math.hypot(BASE_HORIZONTAL, CAMERA_OFFSET.y);
const MIN_PITCH = 0.15; // 거의 지면 높이로 내려가는 것 방지
const MAX_PITCH = 1.45; // 거의 정수리 뷰(짐벌 플립 직전)까지만 허용
const ORBIT_SENSITIVITY = 0.006; // 드래그 1px당 회전 라디안
const DRAG_THRESHOLD = 6; // 이 픽셀 이상 움직여야 "클릭"이 아닌 "드래그"로 판정

// 줌: BASE_RADIUS에 곱하는 배율. 웹은 마우스 휠, 모바일은 두 손가락 핀치로 조절한다.
const MIN_ZOOM = 0.4; // 캐릭터 바로 뒤까지 당겨 붙는 한계
const MAX_ZOOM = 2.5; // 마을이 넓게 보이는 한계
const WHEEL_ZOOM_SENSITIVITY = 0.0015; // 휠 deltaY 1당 배율 변화

// On load, pull the camera up and back for a wide establishing shot of the whole
// village before settling into the normal over-the-shoulder follow camera.
const INTRO_DURATION = 6; // seconds
const INTRO_CAMERA_OFFSET = new THREE.Vector3(0, 27, -25);

function easeInOutSmooth(t: number) {
  return t * t * (3 - 2 * t);
}

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

  // 인트로 조망은 마을 순환로가 화면을 채우는 정도만: 순환로 중심(0, -23)보다 살짝
  // 남쪽을 바라봐 진입로 초입이 함께 걸리게 한다.
  const villageCenter = new THREE.Vector3(0, 0, -20);
  camera.position.copy(villageCenter).add(INTRO_CAMERA_OFFSET);
  camera.lookAt(villageCenter);

  let moveTarget: THREE.Vector3 | null = null;
  let pendingPostboxInteract = false;
  let checkpointPassed = false;
  let resumeToPostbox = false;
  let tripRunning = false;
  let introElapsed = 0;
  let introActive = true;

  let orbitYaw = 0;
  let orbitPitch = 0;
  let zoom = 1;

  function getFollowOffset(): THREE.Vector3 {
    const yaw = BASE_YAW + orbitYaw;
    const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, BASE_PITCH + orbitPitch));
    const radius = BASE_RADIUS * zoom;
    const horizontal = radius * Math.cos(pitch);
    return new THREE.Vector3(horizontal * Math.sin(yaw), radius * Math.sin(pitch), horizontal * Math.cos(yaw));
  }

  function clampToWalkBounds(point: THREE.Vector3) {
    point.x = Math.min(env.walkBounds.maxX, Math.max(env.walkBounds.minX, point.x));
    point.z = Math.min(env.walkBounds.maxZ, Math.max(env.walkBounds.minZ, point.z));
    return point;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function moveToScreenPoint(clientX: number, clientY: number) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const postboxHit = raycaster.intersectObject(env.postbox, true);
    if (postboxHit.length > 0) {
      moveTarget = env.postboxStandPoint.clone();
      pendingPostboxInteract = true;
      tripRunning = moveTarget.distanceTo(character.group.position) > RUN_DISTANCE;
      return;
    }

    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
      moveTarget = clampToWalkBounds(hitPoint);
      pendingPostboxInteract = false;
      tripRunning = moveTarget.distanceTo(character.group.position) > RUN_DISTANCE;
    }
  }

  // 왼쪽 버튼(또는 손가락 하나)을 누른 채 드래그하면 카메라 궤도 회전, 드래그
  // 없이 그냥 클릭/탭하면 기존처럼 그 지점으로 이동한다 — pointerdown/up만으로는
  // 구분이 안 되므로 이동 거리 임계값(DRAG_THRESHOLD)으로 판정한다. 손가락이
  // 두 개가 되면(핀치) 궤도 회전은 멈추고 두 점 사이 거리 변화로 줌을 조절한다.
  let isPointerDown = false;
  let didDrag = false;
  let pointerDownPos = { x: 0, y: 0 };
  let lastPointerPos = { x: 0, y: 0 };

  const activeTouches = new Map<number, { x: number; y: number }>();
  let pinching = false;
  let lastPinchDist = 0;

  function applyZoom(factor: number) {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
  }

  function pinchDistance(): number {
    const pts = Array.from(activeTouches.values());
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  function handlePointerDown(event: PointerEvent) {
    if (introActive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
      // 일부 포인터 디바이스/타이밍에서 캡처가 거부될 수 있음 — 드래그 판정 자체는
      // pointermove 리스너로 계속 동작하므로 무시해도 안전하다.
    }

    if (event.pointerType === "touch") {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size === 2) {
        // 두 번째 손가락이 닿는 순간 진행 중이던 한 손가락 드래그/클릭은 취소한다.
        isPointerDown = false;
        didDrag = true;
        pinching = true;
        lastPinchDist = pinchDistance();
        return;
      }
      if (activeTouches.size > 2) return;
    }

    isPointerDown = true;
    didDrag = false;
    pointerDownPos = { x: event.clientX, y: event.clientY };
    lastPointerPos = { ...pointerDownPos };
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch" && activeTouches.has(event.pointerId)) {
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pinching && activeTouches.size === 2) {
      const dist = pinchDistance();
      if (lastPinchDist > 0) applyZoom(lastPinchDist / dist);
      lastPinchDist = dist;
      return;
    }

    if (!isPointerDown) return;
    const dx = event.clientX - lastPointerPos.x;
    const dy = event.clientY - lastPointerPos.y;
    lastPointerPos = { x: event.clientX, y: event.clientY };

    if (!didDrag) {
      const totalDx = event.clientX - pointerDownPos.x;
      const totalDy = event.clientY - pointerDownPos.y;
      if (Math.hypot(totalDx, totalDy) < DRAG_THRESHOLD) return;
      didDrag = true;
    }

    orbitYaw -= dx * ORBIT_SENSITIVITY;
    orbitPitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbitPitch - dy * ORBIT_SENSITIVITY));
  }

  function handlePointerUp(event: PointerEvent) {
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // setPointerCapture와 대칭: 캡처가 없었다면 해제도 조용히 무시한다.
    }

    if (event.pointerType === "touch") {
      activeTouches.delete(event.pointerId);
      if (activeTouches.size < 2) pinching = false;
      if (activeTouches.size > 0) return; // 아직 다른 손가락이 남아있으면 클릭 판정 보류
    }

    if (!isPointerDown) return;
    isPointerDown = false;
    if (didDrag) return;
    moveToScreenPoint(event.clientX, event.clientY);
  }

  function handleWheel(event: WheelEvent) {
    if (introActive) return;
    event.preventDefault();
    applyZoom(1 + event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  }

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointercancel", handlePointerUp);
  renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

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
        character.face(dx, dz, dt);
        character.setMoving(true, { running: tripRunning });

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

    const followPos = character.group.position.clone().add(getFollowOffset());
    const followLook = character.group.position.clone().add(LOOK_OFFSET);

    if (introActive) {
      introElapsed += dt;
      const t = Math.min(introElapsed / INTRO_DURATION, 1);
      const eased = easeInOutSmooth(t);
      const introPos = villageCenter.clone().add(INTRO_CAMERA_OFFSET);
      camera.position.lerpVectors(introPos, followPos, eased);
      camera.lookAt(villageCenter.clone().lerp(followLook, eased));
      if (t >= 1) introActive = false;
    } else {
      const followT = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * dt);
      camera.position.lerp(followPos, followT);
      camera.lookAt(followLook);
    }

    outlinePipeline.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  return {
    dispose() {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      renderer.domElement.removeEventListener("wheel", handleWheel);
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
    goHome() {
      introActive = false;
      moveTarget = null;
      pendingPostboxInteract = false;
      resumeToPostbox = false;
      tripRunning = false;
      character.group.position.copy(env.spawnPoint);
      character.setMoving(false);
      // 순간이동이므로 카메라도 즉시 따라붙인다 — 러프하게 두면 맵 반대편에서 날아온다.
      camera.position.copy(env.spawnPoint).add(getFollowOffset());
      camera.lookAt(env.spawnPoint.clone().add(LOOK_OFFSET));
    },
  };
}
