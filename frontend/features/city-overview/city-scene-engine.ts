/**
 * Лёгкая 3D-миниатюра Астаны на Three.js. Загружается только динамическим import()
 * на клиенте. Условная композиция: геометрия схемы районов, не география.
 * Высота зданий декоративная и не кодирует показатели.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import type { DistrictId } from "@/lib/contracts/ui";
import { ATLAS_SLOTS, ATLAS_VIEWBOX, assignSlots, type AtlasSlot } from "./atlas-layout";
import { createCityLandmarks, overlapsLandmark } from "./city-landmarks";

export interface CitySceneOptions {
  readonly districtIds: readonly DistrictId[];
  readonly selectedDistrictId: DistrictId | null;
  readonly reducedMotion: boolean;
  readonly onSelectDistrict: (districtId: DistrictId) => void;
  /** Потеря WebGL-контекста или ошибка: компонент показывает статичную схему. */
  readonly onFailure: () => void;
}

export interface CitySceneHandle {
  setSelected(districtId: DistrictId | null): void;
  refreshPalette(): void;
  dispose(): void;
}

// ===== Координаты: viewBox схемы 600×420 → мир 30×21 =====
const SCALE = 20;
const toWorldX = (x: number) => (x - ATLAS_VIEWBOX.width / 2) / SCALE;
const toWorldZ = (y: number) => (y - ATLAS_VIEWBOX.height / 2) / SCALE;
const RIVER_POINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 232], [130, 232], [160, 202], [300, 202], [330, 232], [450, 232], [480, 202], [600, 202],
];
const RIVER_HALF_WIDTH = 13;
/** Байтерек — на левом берегу, в южной области схемы. */
const BAITEREK_AT: readonly [number, number] = [292, 300];

function parsePoints(points: string): Array<[number, number]> {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y];
  });
}

function insidePolygon(x: number, y: number, polygon: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Детерминированный генератор: одинаковый город при каждом открытии. */
function seeded(key: string): () => number {
  let seed = 0;
  for (const char of key) seed = (Math.imul(seed ^ char.charCodeAt(0), 2654435761) + 1) >>> 0;
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shapeFrom(points: ReadonlyArray<readonly [number, number]>): Shape {
  const shape = new Shape();
  points.forEach(([x, y], index) => {
    const wx = toWorldX(x);
    const wy = -toWorldZ(y);
    if (index === 0) shape.moveTo(wx, wy);
    else shape.lineTo(wx, wy);
  });
  shape.closePath();
  return shape;
}

function flatExtrude(points: ReadonlyArray<readonly [number, number]>, depth: number): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shapeFrom(points), { depth, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function riverOutline(): Array<[number, number]> {
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  RIVER_POINTS.forEach(([x, y], i) => {
    const [px, py] = RIVER_POINTS[Math.max(0, i - 1)];
    const [nx, ny] = RIVER_POINTS[Math.min(RIVER_POINTS.length - 1, i + 1)];
    const dx = nx - px;
    const dy = ny - py;
    const length = Math.hypot(dx, dy) || 1;
    // Нормаль; на изломах немного расширяем, чтобы ширина реки не проседала
    const miter = i === 0 || i === RIVER_POINTS.length - 1 ? 1 : 1.18;
    const ox = (-dy / length) * RIVER_HALF_WIDTH * miter;
    const oy = (dx / length) * RIVER_HALF_WIDTH * miter;
    left.push([x + ox, y + oy]);
    right.push([x - ox, y - oy]);
  });
  return [...left, ...right.reverse()];
}

interface Palette {
  ground: Color;
  plate: Color;
  plateSelected: Color;
  building: Color;
  buildingSelected: Color;
  water: Color;
  park: Color;
  tree: Color;
  edge: Color;
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => new Color(style.getPropertyValue(name).trim() || fallback);
  const dark = document.documentElement.dataset.theme === "dark";
  const surface = token("--color-surface", "#ffffff");
  const accent = token("--color-accent", "#006b60");
  return {
    ground: token("--color-surface-sunken", "#edf0ea"),
    plate: surface.clone(),
    plateSelected: accent.clone(),
    building: dark ? surface.clone().offsetHSL(0, 0, 0.1) : surface.clone().offsetHSL(0, 0, -0.09),
    buildingSelected: token("--color-accent-soft", "#ddf1ea").lerp(new Color("#ffffff"), dark ? 0.25 : 0.2),
    water: token("--color-water", "#d3e6e6").offsetHSL(0, 0.05, dark ? 0.04 : -0.06),
    park: accent.clone().lerp(surface, dark ? 0.55 : 0.7),
    tree: accent.clone().lerp(surface, dark ? 0.2 : 0.35),
    edge: token("--color-border-strong", "#7d928a"),
  };
}

interface DistrictNode {
  readonly districtId: DistrictId | null;
  readonly plate: Mesh<BufferGeometry, MeshLambertMaterial>;
  readonly buildings: InstancedMesh<BufferGeometry, MeshLambertMaterial>;
}

export function createCityScene(host: HTMLElement, options: CitySceneOptions): CitySceneHandle {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(28, 1, 0.1, 200);
  const target = new Vector3(0.6, 0.6, 0.4);
  const city = new Group();
  scene.add(city);

  // Свет без динамических теней
  scene.add(new HemisphereLight(0xffffff, 0x8899aa, 1.6));
  scene.add(new AmbientLight(0xffffff, 0.35));
  const sun = new DirectionalLight(0xffffff, 1.6);
  sun.position.set(-12, 22, 10);
  scene.add(sun);

  let palette = readPalette();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const ownedInstances: InstancedMesh[] = [];
  const track = <G extends BufferGeometry>(geometry: G) => (geometries.push(geometry), geometry);
  const lambert = (color: Color) => {
    const material = new MeshLambertMaterial({ color });
    materials.push(material);
    return material;
  };

  // Основание
  const groundMaterial = lambert(palette.ground);
  const ground = new Mesh(track(new BoxGeometry(31.4, 0.6, 22.4)), groundMaterial);
  ground.position.set(0, -0.32, 0);
  city.add(ground);

  // Река
  const waterMaterial = lambert(palette.water);
  const river = new Mesh(track(flatExtrude(riverOutline(), 0.06)), waterMaterial);
  river.position.y = -0.01;
  city.add(river);

  // Районы, здания, парки
  const slotsById = assignSlots(options.districtIds);
  const districtBySlot = new Map<string, DistrictId>();
  slotsById.forEach((slot, id) => districtBySlot.set(slot.key, id));

  const boxGeometry = track(new BoxGeometry(1, 1, 1));
  boxGeometry.translate(0, 0.5, 0);
  const treeGeometry = track(new ConeGeometry(0.32, 0.9, 6));
  treeGeometry.translate(0, 0.45, 0);
  const parkMaterial = lambert(palette.park);
  const treeMaterial = lambert(palette.tree);
  const matrix = new Matrix4();
  const dummy = new Object3D();

  const nodes: DistrictNode[] = [];
  const pickables: Mesh[] = [];
  const roadMaterial = lambert(new Color("#829398"));
  const facadeMaterial = lambert(new Color("#6b939e"));
  /** Полуширина улицы (ширина полосы 7) и шаг выборки при обрезке по объектам. */
  const ROAD_HALF = 3.5;
  const ROAD_STEP = 2;
  const roadLinesX = [96, 204, 380, 520];
  const roadLinesY = [96, 168, 300, 372];
  const nearRoad = (x: number, y: number) =>
    roadLinesX.some((axis) => Math.abs(x - axis) < 13) ||
    roadLinesY.some((axis) => Math.abs(y - axis) < 12);

  ATLAS_SLOTS.forEach((slot: AtlasSlot) => {
    const polygon = parsePoints(slot.points);
    const districtId = districtBySlot.get(slot.key) ?? null;
    const plate = new Mesh(track(flatExtrude(polygon, 0.22)), lambert(palette.plate));
    plate.userData.districtId = districtId;
    city.add(plate);
    pickables.push(plate);

    const random = seeded(slot.key);
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];

    // Streets are clipped to each district; broad avenues align with the bridges.
    const roadSegments: Array<[number, number, number, number]> = [];
    const clipRoad = (axis: number, vertical: boolean) => {
      const start = vertical ? minY : minX;
      const end = vertical ? maxY : maxX;
      let beginning: number | null = null;
      for (let cursor = start; cursor <= end + ROAD_STEP; cursor += ROAD_STEP) {
        const x = vertical ? axis : cursor;
        const y = vertical ? cursor : axis;
        // Полная ширина улицы и шаг выборки: отрезок заканчивается до основания, а не под ним.
        const inside =
          cursor <= end &&
          insidePolygon(x, y, polygon) &&
          !(vertical
            ? overlapsLandmark(x, y, ROAD_HALF, ROAD_STEP, 2)
            : overlapsLandmark(x, y, ROAD_STEP, ROAD_HALF, 2));
        if (inside && beginning === null) beginning = cursor;
        if (!inside && beginning !== null) {
          const length = cursor - beginning;
          if (length > 4) roadSegments.push(vertical
            ? [axis, beginning + length / 2, 7, length]
            : [beginning + length / 2, axis, length, 7]);
          beginning = null;
        }
      }
    };
    roadLinesX.forEach((axis) => clipRoad(axis, true));
    roadLinesY.forEach((axis) => clipRoad(axis, false));
    const roads = new InstancedMesh(boxGeometry, roadMaterial, roadSegments.length);
    roadSegments.forEach(([x, y, width, depth], index) => {
      dummy.position.set(toWorldX(x), 0.225, toWorldZ(y));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(width / SCALE, 0.022, depth / SCALE);
      dummy.updateMatrix(); roads.setMatrixAt(index, dummy.matrix);
    });
    ownedInstances.push(roads);
    city.add(roads);
    // Парк: круг у дальнего от реки края области
    const parkX = minX + (maxX - minX) * (0.3 + random() * 0.4);
    const parkY = slot.anchor.y < 200 ? minY + 42 : maxY - 40;
    const parkRadius = 26;

    const lots: Array<[number, number, number, number]> = [];
    const trees: Array<[number, number]> = [];
    const step = 24;
    for (let y = minY + 14; y < maxY - 8; y += step) {
      for (let x = minX + 14; x < maxX - 8; x += step) {
        const jx = x + (random() - 0.5) * 2;
        const jy = y + (random() - 0.5) * 2;
        const half = 7 + random() * 3;
        const corners: Array<[number, number]> = [
          [jx - half, jy - half], [jx + half, jy - half], [jx - half, jy + half], [jx + half, jy + half],
        ];
        if (!corners.every(([cx, cy]) => insidePolygon(cx, cy, polygon))) continue;
        // Габарит здания не больше half по обеим осям (size ≤ 0,95·2·half, depth ≤ 1,05·size).
        if (overlapsLandmark(jx, jy, half) || nearRoad(jx, jy)) continue;
        const nearPark = Math.hypot(jx - parkX, jy - parkY) < parkRadius + 6 && !overlapsLandmark(parkX, parkY, parkRadius);
        if (nearPark) {
          if (random() > 0.35) trees.push([jx, jy]);
          continue;
        }
        if (random() < 0.1) continue;
        const downtown = jx > 260 && jx < 445 && jy < 160;
        const tall = downtown && random() < 0.62;
        const height = tall ? 2.3 + random() * 2.3 : 0.45 + random() * 1.25;
        lots.push([jx, jy, (half * 2 * (0.7 + random() * 0.25)) / SCALE, height]);
      }
    }

    const buildings = new InstancedMesh(boxGeometry, lambert(palette.building), Math.max(1, lots.length));
    buildings.count = lots.length;
    const facadeBands: Array<[number, number, number, number, number]> = [];
    lots.forEach(([x, y, size, height], index) => {
      const depth = size * (0.75 + random() * 0.3);
      dummy.position.set(toWorldX(x), 0.22, toWorldZ(y));
      dummy.scale.set(size, height, depth);
      dummy.rotation.y = 0;
      dummy.updateMatrix();
      buildings.setMatrixAt(index, dummy.matrix);
      buildings.setColorAt(index, new Color().setHSL(0.09, 0.08 + random() * 0.08, 0.78 + random() * 0.17));
      for (let floor = 0.34; floor < height - 0.08; floor += 0.34) {
        facadeBands.push([x, y, size, depth, floor]);
      }
    });
    const facades = new InstancedMesh(boxGeometry, facadeMaterial, facadeBands.length);
    facadeBands.forEach(([x, y, width, depth, floor], index) => {
      dummy.position.set(toWorldX(x), 0.22 + floor, toWorldZ(y));
      dummy.scale.set(width + 0.012, 0.055, depth + 0.012);
      dummy.updateMatrix(); facades.setMatrixAt(index, dummy.matrix);
    });
    city.add(facades);
    ownedInstances.push(buildings, facades);
    buildings.userData.districtId = districtId;
    city.add(buildings);
    pickables.push(buildings);

    const park = new Mesh(track(new CylinderGeometry(parkRadius / SCALE, parkRadius / SCALE, 0.05, 28)), parkMaterial);
    park.position.set(toWorldX(parkX), 0.245, toWorldZ(parkY));
    if (insidePolygon(parkX, parkY, polygon) && !overlapsLandmark(parkX, parkY, parkRadius)) city.add(park);

    if (trees.length) {
      const forest = new InstancedMesh(treeGeometry, treeMaterial, trees.length);
      trees.forEach(([x, y], index) => {
        matrix.makeScale(0.8 + random() * 0.5, 0.8 + random() * 0.6, 0.8 + random() * 0.5);
        matrix.setPosition(toWorldX(x), 0.24, toWorldZ(y));
        forest.setMatrixAt(index, matrix);
      });
      city.add(forest);
      ownedInstances.push(forest);
    }

    nodes.push({ districtId, plate, buildings });
  });

  // Байтерек: белый ствол, «ветви» и золотая сфера
  const tower = new Group();
  const towerWhite = new MeshStandardMaterial({ color: 0xf4f3ee, roughness: 0.55 });
  const towerGold = new MeshStandardMaterial({ color: 0xd8a63c, metalness: 0.55, roughness: 0.3, emissive: 0x3a2600 });
  materials.push(towerWhite, towerGold);
  const podium = new Mesh(track(new CylinderGeometry(0.85, 1, 0.22, 24)), towerWhite);
  podium.position.y = 0.33;
  const shaft = new Mesh(track(new CylinderGeometry(0.26, 0.38, 4.6, 16)), towerWhite);
  shaft.position.y = 2.7;
  tower.add(podium, shaft);
  // Broad fluted trunk and splayed crown remain legible at miniature scale.
  const trunkRibGeometry = track(new CylinderGeometry(0.055, 0.075, 3.95, 6));
  const branchGeometry = track(new CylinderGeometry(0.065, 0.085, 1.65, 8));
  for (let i = 0; i < 10; i += 1) {
    const branch = new Mesh(branchGeometry, towerWhite);
    const angle = (i / 10) * Math.PI * 2;
    const rib = new Mesh(trunkRibGeometry, towerWhite);
    rib.position.set(Math.cos(angle) * 0.3, 2.6, Math.sin(angle) * 0.3);
    tower.add(rib);
    branch.position.set(Math.cos(angle) * 0.43, 5.05, Math.sin(angle) * 0.43);
    branch.rotation.set(Math.sin(angle) * 0.42, 0, -Math.cos(angle) * 0.42);
    tower.add(branch);
  }
  const sphere = new Mesh(track(new SphereGeometry(0.52, 28, 20)), towerGold);
  sphere.position.y = 5.95;
  tower.add(sphere);
  tower.position.set(toWorldX(BAITEREK_AT[0]), 0, toWorldZ(BAITEREK_AT[1]));
  city.add(tower);

  const landmarks = createCityLandmarks();
  city.add(landmarks.group);

  // ===== Цвета и выбор =====
  let selected = options.selectedDistrictId;
  const applyColors = () => {
    groundMaterial.color.copy(palette.ground);
    waterMaterial.color.copy(palette.water);
    parkMaterial.color.copy(palette.park);
    treeMaterial.color.copy(palette.tree);
    const dark = document.documentElement.dataset.theme === "dark";
    roadMaterial.color.setHex(dark ? 0x4c646b : 0x829398);
    facadeMaterial.color.setHex(dark ? 0x729aa7 : 0x6b939e);
    landmarks.setDark(dark);
    for (const node of nodes) {
      const isSelected = node.districtId !== null && node.districtId === selected;
      node.plate.material.color.copy(isSelected ? palette.plateSelected : palette.plate);
      node.buildings.material.color.copy(isSelected ? palette.buildingSelected : palette.building);
    }
  };
  applyColors();

  // ===== Камера, наклон, появление =====
  const baseYaw = -0.22;
  const basePitch = 0.86;
  const distance = 54;
  let yaw = baseYaw;
  let pitch = basePitch;
  let targetYaw = baseYaw;
  let targetPitch = basePitch;
  let intro = options.reducedMotion ? 1 : 0;
  const introStart = performance.now();

  const placeCamera = () => {
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target);
  };

  let visible = true;
  let frame = 0;
  let dirty = true;

  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Узкий контейнер: камера отъезжает, чтобы город помещался целиком
    camera.fov = camera.aspect < 1.25 ? 34 : 28;
    camera.updateProjectionMatrix();
    requestRender();
  };

  const tick = (now: number) => {
    frame = 0;
    if (!visible || document.hidden) {
      dirty = true;
      return;
    }
    let animating = false;
    if (intro < 1) {
      intro = Math.min(1, (now - introStart) / 700);
      const eased = 1 - (1 - intro) ** 3;
      city.scale.set(1, 0.15 + eased * 0.85, 1);
      city.position.y = (1 - eased) * -0.6;
      animating = intro < 1;
    }
    const dy = targetYaw - yaw;
    const dp = targetPitch - pitch;
    if (Math.abs(dy) > 0.0005 || Math.abs(dp) > 0.0005) {
      yaw += dy * 0.12;
      pitch += dp * 0.12;
      animating = true;
    }
    placeCamera();
    renderer.render(scene, camera);
    dirty = false;
    if (animating) requestRender();
  };

  function requestRender() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // ===== Взаимодействие =====
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const pick = (event: PointerEvent): DistrictId | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    return (hit?.object.userData.districtId as DistrictId | null | undefined) ?? null;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!options.reducedMotion) {
      const rect = host.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      targetYaw = baseYaw + nx * 0.16;
      targetPitch = basePitch - ny * 0.08;
      requestRender();
    }
    renderer.domElement.style.cursor = pick(event) ? "pointer" : "default";
  };
  const onPointerLeave = () => {
    targetYaw = baseYaw;
    targetPitch = basePitch;
    requestRender();
  };
  const onClick = (event: PointerEvent) => {
    const districtId = pick(event);
    if (districtId) options.onSelectDistrict(districtId);
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    options.onFailure();
  };
  const onVisibility = () => {
    if (!document.hidden && dirty) requestRender();
  };

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("click", onClick as EventListener);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  document.addEventListener("visibilitychange", onVisibility);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && dirty) requestRender();
  });
  intersection.observe(host);

  placeCamera();
  resize();

  return {
    setSelected(districtId) {
      selected = districtId;
      applyColors();
      requestRender();
    },
    refreshPalette() {
      palette = readPalette();
      applyColors();
      requestRender();
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("click", onClick as EventListener);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      ownedInstances.forEach((mesh) => mesh.dispose());
      landmarks.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
