export interface HousePlacement {
  side: -1 | 1;
  z: number;
  offset: number;
  sizeScale: number;
  floors: 1 | 2;
  use: string;
}

// All 70 buildings from collector/village-reference/dongpari-buildings.json — real
// building footprints/floor counts for 경기도 파주시 진동면 동파리 (해마루촌). Each side
// (36 left / 34 right of the road) keeps its real east-west order and is spaced evenly
// across the street since the real village runs ~2.5km end to end. `offset` is each
// building's real perpendicular distance from the road, rank-normalized to 3.2-6.5 (a
// straight min-max scale would have let one distant outlier building compress
// everything else into a narrow band). sizeScale comes from real footprint area.
export const VILLAGE_HOUSES: HousePlacement[] = [
  { side: -1, z: -38, offset: 4.83, sizeScale: 0.72, floors: 1, use: "단독주택" },
  { side: 1, z: -38, offset: 5.83, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: -1, z: -35.83, offset: 3.63, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: 1, z: -35.7, offset: 6.21, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: -33.66, offset: 4.92, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: 1, z: -33.39, offset: 5.59, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: -31.49, offset: 4.11, sizeScale: 0.76, floors: 1, use: "단독주택" },
  { side: 1, z: -31.09, offset: 6.26, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: -29.31, offset: 5.5, sizeScale: 0.8, floors: 1, use: "단독주택" },
  { side: 1, z: -28.79, offset: 5.69, sizeScale: 0.83, floors: 2, use: "단독주택" },
  { side: -1, z: -27.14, offset: 5.78, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: 1, z: -26.48, offset: 4.73, sizeScale: 0.72, floors: 1, use: "단독주택" },
  { side: -1, z: -24.97, offset: 5.02, sizeScale: 0.94, floors: 2, use: "제1종근린생활시설" },
  { side: 1, z: -24.18, offset: 6.31, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: -1, z: -22.8, offset: 3.58, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: -21.88, offset: 5.54, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: -20.63, offset: 5.97, sizeScale: 0.75, floors: 2, use: "단독주택" },
  { side: 1, z: -19.58, offset: 5.73, sizeScale: 0.72, floors: 1, use: "단독주택" },
  { side: -1, z: -18.46, offset: 4.2, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: -17.27, offset: 4.16, sizeScale: 0.82, floors: 2, use: "단독주택" },
  { side: -1, z: -16.29, offset: 3.3, sizeScale: 0.77, floors: 2, use: "단독주택" },
  { side: 1, z: -14.97, offset: 5.07, sizeScale: 0.76, floors: 1, use: "단독주택" },
  { side: -1, z: -14.11, offset: 5.88, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: 1, z: -12.67, offset: 6.12, sizeScale: 0.76, floors: 1, use: "단독주택" },
  { side: -1, z: -11.94, offset: 4.49, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: 1, z: -10.36, offset: 3.73, sizeScale: 0.72, floors: 2, use: "창고시설" },
  { side: -1, z: -9.77, offset: 3.92, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: 1, z: -8.06, offset: 5.64, sizeScale: 0.84, floors: 2, use: "단독주택" },
  { side: -1, z: -7.6, offset: 4.25, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: -5.76, offset: 3.44, sizeScale: 0.77, floors: 2, use: "단독주택" },
  { side: -1, z: -5.43, offset: 5.11, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: 1, z: -3.45, offset: 4.4, sizeScale: 0.8, floors: 1, use: "단독주택" },
  { side: -1, z: -3.26, offset: 5.93, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: -1.15, offset: 4.44, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: -1, z: -1.09, offset: 3.25, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: -1, z: 1.09, offset: 5.21, sizeScale: 0.76, floors: 1, use: "단독주택" },
  { side: 1, z: 1.15, offset: 5.26, sizeScale: 0.79, floors: 1, use: "단독주택" },
  { side: -1, z: 3.26, offset: 6.17, sizeScale: 0.83, floors: 1, use: "단독주택" },
  { side: 1, z: 3.45, offset: 3.77, sizeScale: 0.79, floors: 1, use: "단독주택" },
  { side: -1, z: 5.43, offset: 4.63, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: 1, z: 5.76, offset: 5.45, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: -1, z: 7.6, offset: 4.01, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: 1, z: 8.06, offset: 3.82, sizeScale: 0.8, floors: 1, use: "단독주택" },
  { side: -1, z: 9.77, offset: 3.53, sizeScale: 0.72, floors: 1, use: "단독주택" },
  { side: 1, z: 10.36, offset: 4.59, sizeScale: 0.76, floors: 1, use: "단독주택" },
  { side: -1, z: 11.94, offset: 3.2, sizeScale: 0.82, floors: 1, use: "단독주택" },
  { side: 1, z: 12.67, offset: 5.4, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: -1, z: 14.11, offset: 5.35, sizeScale: 0.79, floors: 1, use: "단독주택" },
  { side: 1, z: 14.97, offset: 3.87, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: 16.29, offset: 4.78, sizeScale: 0.8, floors: 1, use: "창고시설" },
  { side: 1, z: 17.27, offset: 4.54, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: -1, z: 18.46, offset: 3.97, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: 19.58, offset: 5.3, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: -1, z: 20.63, offset: 6.4, sizeScale: 0.84, floors: 1, use: "창고시설" },
  { side: 1, z: 21.88, offset: 3.39, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: 22.8, offset: 6.02, sizeScale: 0.78, floors: 1, use: "단독주택" },
  { side: 1, z: 24.18, offset: 4.35, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: 24.97, offset: 4.68, sizeScale: 0.77, floors: 2, use: "단독주택" },
  { side: 1, z: 26.48, offset: 4.97, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: -1, z: 27.14, offset: 6.45, sizeScale: 0.72, floors: 1, use: "단독주택" },
  { side: 1, z: 28.79, offset: 3.49, sizeScale: 0.79, floors: 1, use: "단독주택" },
  { side: -1, z: 29.31, offset: 6.36, sizeScale: 1.12, floors: 2, use: "제1종근린생활시설" },
  { side: 1, z: 31.09, offset: 4.87, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: -1, z: 31.49, offset: 3.68, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: 1, z: 33.39, offset: 4.06, sizeScale: 0.8, floors: 2, use: "단독주택" },
  { side: -1, z: 33.66, offset: 4.3, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: 1, z: 35.7, offset: 3.34, sizeScale: 0.77, floors: 1, use: "단독주택" },
  { side: -1, z: 35.83, offset: 6.07, sizeScale: 0.79, floors: 2, use: "단독주택" },
  { side: -1, z: 38, offset: 5.16, sizeScale: 0.78, floors: 2, use: "단독주택" },
  { side: 1, z: 38, offset: 6.5, sizeScale: 0.72, floors: 1, use: "단독주택" },
];
