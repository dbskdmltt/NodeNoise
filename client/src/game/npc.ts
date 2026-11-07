import * as THREE from "three";
import { toonMaterial, addOutline } from "./toon";
import { planetTransform } from "./planet";
import type { Landmark } from "./environment";

// 배경 NPC. 메인 캐릭터는 실사 스캔 GLTF(초록 상의+크림 앞치마)라서, 여기서는
// 일부러 마을 집·나무와 같은 저폴리 프리미티브 조합으로 만들어 실루엣부터
// 확실히 구분되게 한다. 퀘스트 연결 전 단계라 애니메이션 없이 제자리에 서 있는다.

interface NpcPalette {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  accent: string; // 모자·머리띠 같은 포인트 색
}

interface NpcConfig {
  name: string;
  x: number;
  z: number;
  heading: number;
  palette: NpcPalette;
  hasHat?: boolean;
}

function mesh(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const m = new THREE.Mesh(geometry, toonMaterial(color));
  addOutline(m);
  return m;
}

function buildNpcBody(palette: NpcPalette, hasHat: boolean): THREE.Group {
  const npc = new THREE.Group();

  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8);
  const leftLeg = mesh(legGeo, palette.bottom);
  leftLeg.position.set(-0.11, 0.25, 0);
  npc.add(leftLeg);
  const rightLeg = mesh(legGeo, palette.bottom);
  rightLeg.position.set(0.11, 0.25, 0);
  npc.add(rightLeg);

  const shoeGeo = new THREE.BoxGeometry(0.12, 0.07, 0.2);
  const leftShoe = mesh(shoeGeo, "#3a332b");
  leftShoe.position.set(-0.11, 0.035, 0.03);
  npc.add(leftShoe);
  const rightShoe = mesh(shoeGeo, "#3a332b");
  rightShoe.position.set(0.11, 0.035, 0.03);
  npc.add(rightShoe);

  const torso = mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.52, 10), palette.top);
  torso.position.set(0, 0.76, 0);
  npc.add(torso);

  const armGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.4, 8);
  const leftArm = mesh(armGeo, palette.top);
  leftArm.position.set(-0.26, 0.78, 0);
  leftArm.rotation.z = 0.15;
  npc.add(leftArm);
  const rightArm = mesh(armGeo, palette.top);
  rightArm.position.set(0.26, 0.78, 0);
  rightArm.rotation.z = -0.15;
  npc.add(rightArm);

  const head = mesh(new THREE.SphereGeometry(0.18, 14, 14), palette.skin);
  head.position.set(0, 1.18, 0);
  npc.add(head);

  const hair = mesh(new THREE.SphereGeometry(0.19, 14, 14), palette.hair);
  hair.scale.set(1, 0.85, 1.05);
  hair.position.set(0, 1.24, -0.02);
  npc.add(hair);

  if (hasHat) {
    const hat = mesh(new THREE.ConeGeometry(0.24, 0.16, 12), palette.accent);
    hat.position.set(0, 1.37, 0);
    npc.add(hat);
  } else {
    const band = mesh(new THREE.TorusGeometry(0.19, 0.028, 6, 16), palette.accent);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 1.28, 0);
    npc.add(band);
  }

  return npc;
}

// 랜드마크 근처에 하나씩 — 훗날 퀘스트를 연결할 때 "OO 근처의 주민" 식으로
// 찾아가기 쉽도록 기획서의 원칙(랜드마크=퀘스트 목적지 단서)을 미리 따른다.
const NPC_PLACEMENTS: NpcConfig[] = [
  {
    name: "교회 앞 할머니",
    x: -15,
    z: -29,
    heading: 2.6,
    palette: { skin: "#e0b48f", hair: "#e8e5df", top: "#a9c9d6", bottom: "#6b7280", accent: "#d94f5c" },
  },
  {
    name: "편의점 알바생",
    x: 5.5,
    z: -7,
    heading: -1.0,
    palette: { skin: "#c98a5c", hair: "#2b2320", top: "#e0863a", bottom: "#37476b", accent: "#f2ece1" },
  },
  {
    name: "버스 기다리는 학생",
    x: -2.6,
    z: -21.5,
    heading: 1.4,
    palette: { skin: "#e6bfa0", hair: "#1c1a17", top: "#f4f1ea", bottom: "#28304a", accent: "#c0392b" },
  },
  {
    name: "마을 농부",
    x: -6,
    z: -12,
    heading: 0.6,
    palette: { skin: "#b97a4e", hair: "#4a4438", top: "#8a6a44", bottom: "#5a4a30", accent: "#d8cba4" },
    hasHat: true,
  },
  {
    name: "검문소 군인",
    x: 21.5,
    z: 31.5,
    heading: -0.6,
    palette: { skin: "#c98a5c", hair: "#1c1a17", top: "#5a5c42", bottom: "#4a4c36", accent: "#3a3a2e" },
    hasHat: true,
  },
];

export function buildNpcs(scene: THREE.Scene): Landmark[] {
  return NPC_PLACEMENTS.map((config) => {
    const npc = buildNpcBody(config.palette, Boolean(config.hasHat));
    const t = planetTransform(config.x, config.z, config.heading);
    npc.position.copy(t.position);
    npc.quaternion.copy(t.quaternion);
    scene.add(npc);
    return { name: config.name, pos: new THREE.Vector2(config.x, config.z), kind: "npc" as const };
  });
}
