import * as THREE from "three";

// 초소형 행성 좌표 변환. 게임 로직(이동, 걷기 경계, 클릭 타겟팅)은 지금까지 써온
// 평면 설계좌표 (x, z)를 그대로 유지하고, 이 모듈은 "그 평면 좌표를 화면에 어떻게
// 그리는가"만 구면 위 위치로 바꿔준다 — atan2 기반 방향 계산 등 기존 로직은 무수정.

export const PLANET_RADIUS = 34;

const UP = new THREE.Vector3(0, 1, 0);
const CIRCUMFERENCE = 2 * Math.PI * PLANET_RADIUS;

// theta=경도(x/R), phi=위도(z/R)에서 접선기저(동쪽 tangentX, "z 증가" 방향 tangentZ)를
// 매개변수의 편미분으로 직접 구성한다. setFromUnitVectors류로 임의 축을 골라 정렬하면
// 위치마다 "앞쪽"이 제멋대로 뒤틀리는데, 이 방식은 위치가 달라져도 일관되게 유지된다.
function surfaceFrame(x: number, z: number) {
  const theta = x / PLANET_RADIUS;
  const phi = z / PLANET_RADIUS;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  const normal = new THREE.Vector3(cosPhi * sinTheta, sinPhi, cosPhi * cosTheta);
  const tangentZ = new THREE.Vector3(-sinPhi * sinTheta, cosPhi, -sinPhi * cosTheta);
  // tangentX는 편미분 대신 normal×tangentZ 외적으로 구한다 — 오른손좌표계(X×Y=Z, 즉
  // Y×Z=X)를 외적으로 강제해야 makeBasis가 만드는 행렬이 진짜 회전(행렬식 +1)이 되고,
  // setFromRotationMatrix가 정상적인(노름 1) 쿼터니언을 뽑아낸다. 직접 편미분으로
  // 유도한 벡터는 좌표계 방향이 뒤집혀 노름이 깨진 쿼터니언이 나왔었다.
  const tangentX = normal.clone().cross(tangentZ);

  return { normal, tangentX, tangentZ };
}

// groundQuad처럼 방향 없이 위치만 필요한 원시 정점 배치용.
export function planetPosition(x: number, z: number, heightAboveSurface = 0): THREE.Vector3 {
  const { normal } = surfaceFrame(x, z);
  return normal.multiplyScalar(PLANET_RADIUS + heightAboveSurface);
}

// 평면 설계좌표 (x,z) + 기존에 계산해둔 heading(atan2 결과 등) → 구면 위 위치와,
// 그 지점 표면에 정렬되면서 heading만큼 로컬 Y축으로 튼 쿼터니언.
export function planetTransform(
  x: number,
  z: number,
  headingY = 0
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  const { normal, tangentX, tangentZ } = surfaceFrame(x, z);
  const position = normal.clone().multiplyScalar(PLANET_RADIUS);

  const basis = new THREE.Matrix4().makeBasis(tangentX, normal, tangentZ);
  const frameQuat = new THREE.Quaternion().setFromRotationMatrix(basis);
  // tangentX는 normal×tangentZ로 강제한 우수좌표계라 "+x 방향"이 아니라 그 반대를
  // 가리킨다(오른손좌표계를 만들려면 normal·tangentZ가 고정된 이상 X축은 이렇게밖에
  // 못 나온다). heading을 그대로 로컬 Y축에 태우면 atan2(dx,dz) 관례와 부호가
  // 뒤집혀서 결과 방향이 좌우로 미러링되므로, 여기서 미리 부호를 반전해 보정한다.
  const headingQuat = new THREE.Quaternion().setFromAxisAngle(UP, -headingY);
  const quaternion = frameQuat.multiply(headingQuat);

  return { position, quaternion };
}

// 구체 표면 위 월드 좌표(레이캐스트로 얻은 클릭 지점 등) → 대응하는 평면 설계좌표로 역산.
export function inversePlanetPosition(worldPoint: THREE.Vector3): { x: number; z: number } {
  const n = worldPoint.clone().normalize();
  const phi = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1));
  const theta = Math.atan2(n.x, n.z);
  return { x: theta * PLANET_RADIUS, z: phi * PLANET_RADIUS };
}

// 경도(x) 랩어라운드: 둘레(2πR)를 넘어가면 반대편에서 이어진다. 델타값에 적용하면
// 랩을 고려한 최단 경로 방향(부호 포함)이 나온다 — 목표까지 어느 쪽으로 도는 게
// 가까운지 판단할 때도 이 함수를 그대로 쓴다.
export function wrapX(x: number): number {
  return ((x + CIRCUMFERENCE / 2) % CIRCUMFERENCE + CIRCUMFERENCE) % CIRCUMFERENCE - CIRCUMFERENCE / 2;
}
