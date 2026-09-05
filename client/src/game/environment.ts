import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { toonMaterial, recolorTexture } from "./toon";
import { VILLAGE_HOUSES, type HousePlacement } from "../data/villageLayout";
import { PLANET_RADIUS, planetPosition, planetTransform } from "./planet";
import { buildNpcs } from "./npc";

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Landmark {
  name: string;
  pos: THREE.Vector2;
  kind?: "building" | "npc";
}

export interface Collider {
  pos: THREE.Vector2;
  radius: number;
}

export interface Environment {
  postbox: THREE.Object3D;
  walkBounds: WalkBounds;
  spawnPoint: THREE.Vector3;
  postboxStandPoint: THREE.Vector3;
  checkpointZ: number;
  landmarks: Landmark[];
  colliders: Collider[];
}

const ROOF_COLORS = ["#c15c3f", "#9370a8", "#5a9db0", "#c9a24f", "#b0607e"];
const HOUSE_BASE_FOOTPRINT = 1.6;
const HOUSE_BASE_ROOF_RADIUS = 1.27;

// ---- 해마루촌 지도 기준 공간 구성 ----
// 북쪽(-Z)에 순환로 두 개(외곽/안쪽)로 이루어진 마을이 있고, 해마루길이 북서쪽
// (교회 앞)에서 마을 중심(버스정류장·해마루촌 표지판)을 지나 남동쪽(이마트24 앞)
// 출구로 빠져나간다. 출구부터는 남쪽(+Z)으로 서쪽으로 크게 감아돌았다가 동쪽으로
// 흘러가는 굽잇길 진입로가 이어지고, 그 끝에 검문소와 우체통이 있다. 마을 동쪽
// (+X)에는 임진강이 남북으로 굽이쳐 흐른다.

const OUTER_LOOP = { cx: 0, cz: -23, rx: 16, rz: 14 };
const INNER_LOOP = { cx: 0, cz: -21, rx: 8.5, rz: 6.5 };

// 해마루길(마을 관통 도로)
const MAIN_STREET_CTRL: [number, number][] = [
  [-19, -35], [-13, -30], [-7, -25], [-3, -21], [1, -17], [4, -12], [7, -6],
];

// 진입로: 마을 출구에서 남쪽으로 내려가며 서쪽으로 크게 감아돌고, 다시 동쪽으로
// 가로질러 검문소까지 (지도 아래쪽 손그림 도로의 S자 굴곡을 옮김).
const ACCESS_ROAD_CTRL: [number, number][] = [
  [7, -6], [8, -1], [7, 4], [2, 8], [-5, 10], [-11, 14], [-14, 19],
  [-13, 24], [-9, 28], [-2, 30], [6, 30], [13, 31], [19, 32], [24, 34], [27, 36],
];

// 임진강: 마을 동쪽을 따라 굽이치는 물길
const RIVER_CTRL: [number, number][] = [
  [21, -46], [24, -38], [22, -30], [25, -22], [23, -14], [26, -6], [24, 2], [26, 10],
];

// 교회를 편의점과 같은 크기(MART_FOOTPRINT)로 키우면서 원래 위치(-16,-32.5)가
// 해마루길 중심선 바로 위였던 자리라 도로를 통째로 덮어버리게 됐다. 도로 접선에
// 수직인 방향으로 10유닛 밀어내 도로·마을 순환로 양쪽 모두와 겹치지 않게 했다.
const CHURCH_POS = new THREE.Vector2(-22.4, -24.8);
const BUS_STOP_POS = new THREE.Vector2(-4.6, -20.5);
const VILLAGE_SIGN_POS = new THREE.Vector2(2.4, -15.8);
const MART_POS = new THREE.Vector2(13, -2);

const SPAWN_POINT = new THREE.Vector3(0, 0, -18);
const CHECKPOINT_POS = new THREE.Vector2(24, 34);
const CHECKPOINT_Z = CHECKPOINT_POS.y;
const POSTBOX_POS = new THREE.Vector2(27.6, 36.6);

function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  return new THREE.Mesh(geometry, toonMaterial(color));
}

function sampleCurve(ctrl: [number, number][], divisions: number): THREE.Vector2[] {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  return curve.getPoints(divisions).map((p) => new THREE.Vector2(p.x, p.z));
}

function sampleLoop(loop: { cx: number; cz: number; rx: number; rz: number }, divisions = 64): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= divisions; i++) {
    const a = (i / divisions) * Math.PI * 2;
    pts.push(new THREE.Vector2(loop.cx + Math.cos(a) * loop.rx, loop.cz + Math.sin(a) * loop.rz));
  }
  return pts;
}

function distToPolyline(p: THREE.Vector2, pts: THREE.Vector2[]): number {
  let min = Infinity;
  for (const q of pts) {
    const d = p.distanceTo(q);
    if (d < min) min = d;
  }
  return min;
}

function buildSkyDome(scene: THREE.Scene) {
  const geometry = new THREE.SphereGeometry(120, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      // 일본 여름 거리 사진 참고 — 짙은 여름 하늘색에서 지평선의 뽀얀 흰빛으로.
      topColor: { value: new THREE.Color("#2f8fd9") },
      bottomColor: { value: new THREE.Color("#eaf5fb") },
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

// 뭉게구름 — 참고 사진 속 여름 적운을 낮은 폴리곤 뭉치로 흉내낸다. 카툰 소품과
// 달리 외곽선을 넣지 않아야 멀리 뜬 뭉실한 구름처럼 보인다.
function buildCloud(scene: THREE.Scene, center: THREE.Vector3, scale: number) {
  const cloud = new THREE.Group();
  const puffMaterial = toonMaterial("#fbfdff");
  const puffCount = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < puffCount; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), puffMaterial);
    const angle = (i / puffCount) * Math.PI * 2;
    puff.position.set(Math.cos(angle) * 1.3, Math.sin(angle * 0.6) * 0.35, Math.sin(angle) * 0.7);
    const puffScale = 0.7 + Math.random() * 0.5;
    puff.scale.setScalar(puffScale);
    cloud.add(puff);
  }
  cloud.scale.setScalar(scale);
  cloud.position.copy(center);
  cloud.lookAt(0, 0, 0);
  scene.add(cloud);
}

function buildClouds(scene: THREE.Scene) {
  const CLOUD_COUNT = 12;
  const CLOUD_ALTITUDE_RADIUS = 105; // 하늘 돔(반지름 120) 가까이 멀리 띄워 작고 가볍게 보이도록
  for (let i = 0; i < CLOUD_COUNT; i++) {
    // 마을 위쪽 하늘에 몰아서, 정수리 근처(극점)는 피해 자연스럽게 흩뿌린다.
    const theta = Math.random() * Math.PI * 2;
    const phi = THREE.MathUtils.degToRad(15 + Math.random() * 50);
    const dir = new THREE.Vector3(Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta));
    const center = dir.multiplyScalar(CLOUD_ALTITUDE_RADIUS);
    buildCloud(scene, center, 2 + Math.random() * 2);
  }
}

// Builds one quad on the planet surface between two (x, z) *design* points, `width`
// wide. Each corner is computed in flat design space (perpendicular offset from the
// segment direction) then mapped onto the sphere individually via planetPosition — since
// segments are already short (loop/curve sampling), each quad is a good flat
// approximation of the curved strip it belongs to. Winding order is chosen per quad so
// the face always points outward — segments run in every direction (loops, S-curves),
// and the single-sided toon material would cull half of them otherwise.
function groundQuad(p0: THREE.Vector2, p1: THREE.Vector2, width: number, color: THREE.ColorRepresentation, y = 0.011) {
  const dir = new THREE.Vector2(p1.x - p0.x, p1.y - p0.y).normalize();
  const perp = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(width / 2);

  const corners2D = [
    [p0.x + perp.x, p0.y + perp.y],
    [p0.x - perp.x, p0.y - perp.y],
    [p1.x - perp.x, p1.y - perp.y],
    [p1.x + perp.x, p1.y + perp.y],
  ];
  const c = corners2D.map(([cx, cz]) => planetPosition(cx, cz, y));

  const center = planetPosition((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, y);
  const e1 = c[1].clone().sub(c[0]);
  const e2 = c[2].clone().sub(c[0]);
  const faceNormal = e1.clone().cross(e2);
  const upWinding = faceNormal.dot(center) > 0; // 바깥(구 중심에서 멀어지는 쪽)을 향하는 쪽 선택
  const order = upWinding ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];

  const positions = new Float32Array(order.length * 3);
  order.forEach((ci, i) => {
    positions[i * 3] = c[ci].x;
    positions[i * 3 + 1] = c[ci].y;
    positions[i * 3 + 2] = c[ci].z;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return mesh(geometry, color);
}

function buildPath(scene: THREE.Scene, pts: THREE.Vector2[], width: number, color: THREE.ColorRepresentation, y = 0.011) {
  for (let i = 0; i < pts.length - 1; i++) {
    scene.add(groundQuad(pts[i], pts[i + 1], width, color, y));
  }
}

function makeTextBoard(text: string, bg: string, fg: string, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.max(64, Math.round(512 * (height / width)));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = fg;
  let fontSize = Math.round(canvas.height * 0.62);
  ctx.font = `bold ${fontSize}px 'Malgun Gothic', sans-serif`;
  while (ctx.measureText(text).width > canvas.width * 0.9 && fontSize > 12) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px 'Malgun Gothic', sans-serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

function buildHouse(
  scene: THREE.Scene,
  x: number,
  z: number,
  rotationY: number,
  roofColor: string,
  sizeScale = 1,
  floors: 1 | 2 = 1,
  isMaiHouse = false
) {
  const house = new THREE.Group();

  const footprint = HOUSE_BASE_FOOTPRINT * sizeScale;
  const bodyHeight = floors === 2 ? 2.4 : 1.6;
  const body = mesh(new THREE.BoxGeometry(footprint, bodyHeight, footprint), isMaiHouse ? "#f2e9cd" : "#e8d9b8");
  body.position.set(0, bodyHeight / 2, 0);
  house.add(body);

  const roofRadius = HOUSE_BASE_ROOF_RADIUS * sizeScale;
  const roof = mesh(new THREE.ConeGeometry(roofRadius, 1, 4), roofColor);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, bodyHeight + 0.5, 0);
  house.add(roof);

  const door = mesh(new THREE.BoxGeometry(0.55, 0.95, 0.06), "#6b4a30");
  door.position.set(0, 0.48, (footprint / 2) * 1.03);
  house.add(door);

  const t = planetTransform(x, z, rotationY);
  house.position.copy(t.position);
  house.quaternion.copy(t.quaternion);
  scene.add(house);

  // 캐릭터 충돌용 원형 콜라이더 — 실제로는 사각형이지만, 클릭 이동 특성상
  // 원형 밀어내기가 벽을 파고들지 않으면서도 자연스럽게 미끄러지듯 피해간다.
  return { pos: new THREE.Vector2(x, z), radius: footprint * 0.62 };
}

interface LoopHouseEntry {
  house: HousePlacement;
  globalIndex: number;
}

// 순환로 하나를 따라 집을 각도 균등 분배. side가 -1이면 순환로 안쪽, 1이면 바깥쪽에
// 앉히고(실측 offset을 반경 방향 이격 1.6~3.0으로 정규화), 문이 도로를 바라보게 회전.
function placeLoopHouses(
  scene: THREE.Scene,
  entries: LoopHouseEntry[],
  loop: { cx: number; cz: number; rx: number; rz: number },
  startAngle: number,
  blocked: THREE.Vector2[][],
  keepOut: { pos: THREE.Vector2; radius: number }[]
): Collider[] {
  const colliders: Collider[] = [];
  entries.forEach(({ house, globalIndex }, j) => {
    const angle = startAngle + (j / entries.length) * Math.PI * 2;
    const radial = 1.6 + ((house.offset - 3.2) / 3.3) * 1.4;
    const roadPt = new THREE.Vector2(loop.cx + Math.cos(angle) * loop.rx, loop.cz + Math.sin(angle) * loop.rz);
    const pos = new THREE.Vector2(
      loop.cx + Math.cos(angle) * (loop.rx + house.side * radial),
      loop.cz + Math.sin(angle) * (loop.rz + house.side * radial)
    );

    const isMai = globalIndex === 0;
    if (!isMai) {
      if (blocked.some((line) => distToPolyline(pos, line) < 2.4)) return;
      if (keepOut.some(({ pos: q, radius }) => pos.distanceTo(q) < radius)) return;
    }

    const rotationY = Math.atan2(roadPt.x - pos.x, roadPt.y - pos.y);
    colliders.push(
      buildHouse(
        scene,
        pos.x,
        pos.y,
        rotationY,
        ROOF_COLORS[globalIndex % ROOF_COLORS.length],
        house.sizeScale,
        house.floors,
        isMai
      )
    );
    scene.add(groundQuad(roadPt, pos, 0.7, "#d8cba4", 0.013));
  });
  return colliders;
}

function buildVillage(
  scene: THREE.Scene,
  blocked: THREE.Vector2[][],
  keepOut: { pos: THREE.Vector2; radius: number }[]
): Collider[] {
  // 집 70채를 실측 순서 그대로 외곽 순환로(2/3)와 안쪽 순환로(1/3)에 나눠 배치
  const outer: LoopHouseEntry[] = [];
  const inner: LoopHouseEntry[] = [];
  VILLAGE_HOUSES.forEach((house, globalIndex) => {
    (globalIndex % 3 === 2 ? inner : outer).push({ house, globalIndex });
  });
  const outerColliders = placeLoopHouses(scene, outer, OUTER_LOOP, Math.PI / 2, blocked, keepOut);
  const innerColliders = placeLoopHouses(scene, inner, INNER_LOOP, Math.PI / 2, blocked, keepOut);
  return [...outerColliders, ...innerColliders];
}

const CHURCH_MODEL_URL = "/models/Meshy_AI_Hilltop_Korean_Church_0819035724_texture.glb";
const CHURCH_FOOTPRINT = 13.6; // 편의점(MART_FOOTPRINT)과 동일한 크기로 맞춤

function buildChurch(scene: THREE.Scene) {
  const church = new THREE.Group();
  // 해마루길 북서쪽 초입을 바라보도록
  const churchHeading = Math.atan2(CHURCH_POS.x - -13, CHURCH_POS.y - -30) + Math.PI;
  const churchT = planetTransform(CHURCH_POS.x, CHURCH_POS.y, churchHeading);
  church.position.copy(churchT.position);
  church.quaternion.copy(churchT.quaternion);
  scene.add(church);

  // 실측 사진 스캔이라 "언덕 위 교회"라는 이름대로 잔디 덮인 낮은 돌 축대까지
  // 통째로 담겨 있다 — 잘라내지 않고 그대로 살려서 작은 언덕처럼 보이게 둔다.
  loadScannedModel(church, CHURCH_MODEL_URL, CHURCH_FOOTPRINT);

  const sign = makeTextBoard("해마루 광성교회", "#f4efe2", "#5a4a3a", 2.6, 0.6);
  sign.position.set(0, 2.2, CHURCH_FOOTPRINT / 2 + 0.5);
  church.add(sign);

  return { pos: CHURCH_POS, radius: CHURCH_FOOTPRINT / 2 };
}

function buildBusStop(scene: THREE.Scene) {
  const stop = new THREE.Group();

  const postL = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), "#7a7a72");
  postL.position.set(-0.75, 0.6, -0.3);
  stop.add(postL);
  const postR = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), "#7a7a72");
  postR.position.set(0.75, 0.6, -0.3);
  stop.add(postR);

  const roof = mesh(new THREE.BoxGeometry(1.9, 0.08, 1.0), "#4a7a8a");
  roof.position.set(0, 1.24, -0.1);
  stop.add(roof);

  const back = mesh(new THREE.BoxGeometry(1.9, 0.7, 0.05), "#dcd3bd");
  back.position.set(0, 0.75, -0.42);
  stop.add(back);

  const bench = mesh(new THREE.BoxGeometry(1.5, 0.07, 0.35), "#8a6a44");
  bench.position.set(0, 0.42, -0.22);
  stop.add(bench);

  const signPole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8), "#7a7a72");
  signPole.position.set(1.25, 0.75, 0.1);
  stop.add(signPole);
  const signBoard = makeTextBoard("버스", "#3d6fd8", "#ffffff", 0.55, 0.35);
  signBoard.position.set(1.25, 1.35, 0.1);
  stop.add(signBoard);

  // 해마루길 쪽(동쪽)을 바라보도록
  const stopHeading = Math.atan2(-3 - BUS_STOP_POS.x, -21 - BUS_STOP_POS.y);
  const stopT = planetTransform(BUS_STOP_POS.x, BUS_STOP_POS.y, stopHeading);
  stop.position.copy(stopT.position);
  stop.quaternion.copy(stopT.quaternion);
  scene.add(stop);
}

function buildVillageSign(scene: THREE.Scene) {
  const sign = new THREE.Group();

  const postL = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), "#8a6a44");
  postL.position.set(-0.75, 0.75, 0);
  sign.add(postL);
  const postR = mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 8), "#8a6a44");
  postR.position.set(0.75, 0.75, 0);
  sign.add(postR);

  const title = makeTextBoard("해마루촌", "#8a6a44", "#fff6e0", 1.7, 0.5);
  title.position.set(0, 1.35, 0.04);
  sign.add(title);

  const address = makeTextBoard("진동면 해마루길 88", "#f4efe2", "#5a5a52", 1.5, 0.3);
  address.position.set(0, 0.92, 0.04);
  sign.add(address);

  // 남쪽(팔로우 카메라가 항상 보는 방향)을 바라보도록 — 북향이면 글자가 거울상이 됨
  const signHeading = Math.atan2(0 - VILLAGE_SIGN_POS.x, -10 - VILLAGE_SIGN_POS.y);
  const signT = planetTransform(VILLAGE_SIGN_POS.x, VILLAGE_SIGN_POS.y, signHeading);
  sign.position.copy(signT.position);
  sign.quaternion.copy(signT.quaternion);
  scene.add(sign);
}

const MART_MODEL_URL = "/models/convini.glb";
const MART_FOOTPRINT = 13.6; // 게임 스케일에서 편의점이 차지할 가로 폭

// 실측 사진 스캔 GLB 공용 로더. 세 가지를 항상 같이 해줘야 한다: (1) 익스포트
// 스케일을 모르므로 바운딩박스로 footprint에 맞춰 정규화, (2) 바닥을 y=0에 앉히고
// 수평 중심을 부모 그룹 원점에 맞춤, (3) metalness 팩터가 기본값(1, 완전 금속)으로
// 들어 있어 환경맵 없는 씬에서 거의 검게 렌더링되는 것을 보정 — 베이스컬러 텍스처
// 자체를 캔버스로 한 번 구워 밝기+채도까지 올려서, 주변 카툰 건물들의 채도 높은
// 플랫 컬러 옆에서도 칙칙해 보이지 않게 한다.
function loadScannedModel(parent: THREE.Object3D, url: string, footprint: number) {
  new GLTFLoader().load(url, (gltf) => {
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const horizontal = Math.max(size.x, size.z);
    const scale = horizontal > 0 ? footprint / horizontal : 1;
    model.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    model.traverse((obj) => {
      const meshObj = obj as THREE.Mesh;
      if (!meshObj.isMesh) return;
      const material = meshObj.material as THREE.MeshStandardMaterial;
      if (material?.isMeshStandardMaterial) {
        material.metalness = 0;
        if (material.map) material.map = recolorTexture(material.map, "saturate(128%) brightness(114%)");
      }
    });

    parent.add(model);
  });
}

const MART_HEADING = Math.atan2(7 - MART_POS.x, -6 - MART_POS.y);

function buildMart(scene: THREE.Scene) {
  const mart = new THREE.Group();
  // 남동쪽 출구 도로(카메라가 보이는 남쪽) 방향으로 입구가 보이도록
  const martT = planetTransform(MART_POS.x, MART_POS.y, MART_HEADING);
  mart.position.copy(martT.position);
  mart.quaternion.copy(martT.quaternion);
  scene.add(mart);
  loadScannedModel(mart, MART_MODEL_URL, MART_FOOTPRINT);

  return { pos: MART_POS, radius: MART_FOOTPRINT / 2 };
}

const CONTAINER_MODEL_URL = "/models/Meshy_AI_Industrial_Mural_Faca_0819041231_texture.glb";
const CONTAINER_FOOTPRINT = 4; // 편의점 옆 소품 크기 — 건물들보다 훨씬 작게
// 편의점 그룹 로컬 +X쪽(옆면)에, 같은 방향을 보도록 편의점과 같은 회전을 적용한다.
const CONTAINER_LOCAL_OFFSET = new THREE.Vector2(9.4, -1.5);

function buildContainer(scene: THREE.Scene) {
  // 편의점 로컬 오프셋 계산 자체는 여전히 평면 설계좌표에서 한다 — 최종 위치를
  // planetTransform에 넘기기 전까지는 편의점과 동일한 2D 로직 그대로.
  const worldOffset = CONTAINER_LOCAL_OFFSET.clone().rotateAround(new THREE.Vector2(0, 0), -MART_HEADING);
  const designX = MART_POS.x + worldOffset.x;
  const designZ = MART_POS.y + worldOffset.y;

  const container = new THREE.Group();
  const t = planetTransform(designX, designZ, MART_HEADING);
  container.position.copy(t.position);
  container.quaternion.copy(t.quaternion);
  scene.add(container);
  loadScannedModel(container, CONTAINER_MODEL_URL, CONTAINER_FOOTPRINT);

  return { pos: new THREE.Vector2(designX, designZ), radius: CONTAINER_FOOTPRINT / 2 };
}

function buildRiver(scene: THREE.Scene, riverPts: THREE.Vector2[]) {
  buildPath(scene, riverPts, 3.8, "#79c0dc", 0.008);
  buildPath(scene, riverPts, 2.2, "#9ad4ea", 0.009);
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
  const t = planetTransform(x, z, 0);
  tree.position.copy(t.position);
  tree.quaternion.copy(t.quaternion);
  scene.add(tree);
}

function buildTrees(scene: THREE.Scene, blocked: THREE.Vector2[][], accessPts: THREE.Vector2[]) {
  // 마을 외곽을 한 바퀴 두르는 숲 라인 (강가와 도로 위는 비움)
  const RING_COUNT = 26;
  for (let i = 0; i < RING_COUNT; i++) {
    const a = (i / RING_COUNT) * Math.PI * 2;
    const p = new THREE.Vector2(
      OUTER_LOOP.cx + Math.cos(a) * (OUTER_LOOP.rx + 6 + (i % 3)),
      OUTER_LOOP.cz + Math.sin(a) * (OUTER_LOOP.rz + 5.5 + ((i * 2) % 3))
    );
    if (p.x > 18.5) continue;
    if (blocked.some((line) => distToPolyline(p, line) < 2.2)) continue;
    if (p.distanceTo(CHURCH_POS) < CHURCH_FOOTPRINT / 2 + 2) continue;
    buildTree(scene, p.x, p.y, 0.9 + ((i * 37) % 10) / 30);
  }

  // 진입로 가로수: 굽잇길을 따라 양옆 번갈아 심기
  for (let i = 6; i < accessPts.length - 8; i += 9) {
    const p = accessPts[i];
    const next = accessPts[i + 1];
    const dir = new THREE.Vector2(next.x - p.x, next.y - p.y).normalize();
    const side = i % 18 === 6 ? 1 : -1;
    const treePos = new THREE.Vector2(p.x - dir.y * 2.8 * side, p.y + dir.x * 2.8 * side);
    if (blocked.some((line) => distToPolyline(treePos, line) < 2.0)) continue;
    buildTree(scene, treePos.x, treePos.y, 0.9 + ((i * 13) % 10) / 28);
  }
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

  // 차단봉이 진입로 진행 방향과 직각이 되도록 도로 접선에 맞춰 회전
  const checkpointHeading = Math.atan2(POSTBOX_POS.x - CHECKPOINT_POS.x, POSTBOX_POS.y - CHECKPOINT_POS.y);
  const checkpointT = planetTransform(CHECKPOINT_POS.x, CHECKPOINT_POS.y, checkpointHeading);
  checkpoint.position.copy(checkpointT.position);
  checkpoint.quaternion.copy(checkpointT.quaternion);
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

  const postboxT = planetTransform(POSTBOX_POS.x, POSTBOX_POS.y, 0);
  postbox.position.copy(postboxT.position);
  postbox.quaternion.copy(postboxT.quaternion);
  scene.add(postbox);
  return postbox;
}

function buildPlanetSurface(scene: THREE.Scene) {
  const ground = mesh(new THREE.SphereGeometry(PLANET_RADIUS, 96, 64), "#9bc678");
  scene.add(ground);
}

export function buildEnvironment(scene: THREE.Scene): Environment {
  const mainStreetPts = sampleCurve(MAIN_STREET_CTRL, 60);
  const accessPts = sampleCurve(ACCESS_ROAD_CTRL, 140);
  const outerLoopPts = sampleLoop(OUTER_LOOP);
  const innerLoopPts = sampleLoop(INNER_LOOP);
  const riverPts = sampleCurve(RIVER_CTRL, 80);

  buildSkyDome(scene);
  buildClouds(scene);
  buildPlanetSurface(scene);

  buildPath(scene, outerLoopPts, 1.4, "#c9b98f", 0.011);
  buildPath(scene, innerLoopPts, 1.4, "#c9b98f", 0.011);
  buildPath(scene, mainStreetPts, 1.6, "#c9b98f", 0.012);
  buildPath(scene, accessPts, 1.6, "#c9b98f", 0.012);

  buildRiver(scene, riverPts);

  const houseBlocked = [mainStreetPts, accessPts, riverPts];
  const keepOut = [
    { pos: CHURCH_POS, radius: CHURCH_FOOTPRINT / 2 + 1.5 },
    { pos: BUS_STOP_POS, radius: 3.4 },
    { pos: VILLAGE_SIGN_POS, radius: 3.4 },
    { pos: MART_POS, radius: MART_FOOTPRINT / 2 + 1.5 },
  ];
  const houseColliders = buildVillage(scene, houseBlocked, keepOut);

  const churchCollider = buildChurch(scene);
  buildBusStop(scene);
  buildVillageSign(scene);
  const martCollider = buildMart(scene);
  const containerCollider = buildContainer(scene);

  buildTrees(scene, [mainStreetPts, accessPts, outerLoopPts, innerLoopPts, riverPts], accessPts);
  buildCheckpoint(scene);
  const postbox = buildPostbox(scene);
  const npcLandmarks = buildNpcs(scene);

  const hemi = new THREE.HemisphereLight("#ffffff", "#9bc678", 1.1);
  scene.add(hemi);

  // 일본 여름 거리 사진 참고로 다시 따뜻한 톤을 살렸다 — 예전에 캐릭터 피부가
  // 과포화로 튀어서 중립광으로 바꿨던 적이 있지만, 그건 텍스처 쪽(character.ts의
  // recolorTexture)에서 이미 채도를 깎아 고쳐뒀으므로 조명을 다시 데워도 안전하다.
  const sun = new THREE.DirectionalLight("#fff2d9", 1.8);
  sun.position.set(6, 9, 5);
  scene.add(sun);

  const fill = new THREE.AmbientLight("#ffffff", 0.5);
  scene.add(fill);

  const landmarks: Landmark[] = [
    { name: "해마루촌", pos: VILLAGE_SIGN_POS },
    { name: "해마루 광성교회", pos: CHURCH_POS },
    { name: "이마트24", pos: MART_POS },
    { name: "버스정류장", pos: BUS_STOP_POS },
    { name: "검문소", pos: CHECKPOINT_POS },
    { name: "우체통", pos: POSTBOX_POS },
    ...npcLandmarks,
  ];

  const colliders: Collider[] = [...houseColliders, churchCollider, martCollider, containerCollider];

  return {
    postbox,
    walkBounds: { minX: -27, maxX: 30, minZ: -42, maxZ: 38.5 },
    spawnPoint: SPAWN_POINT.clone(),
    postboxStandPoint: new THREE.Vector3(26.8, 0, 35.8),
    checkpointZ: CHECKPOINT_Z,
    landmarks,
    colliders,
  };
}
