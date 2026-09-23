/**
 * Original low-poly architecture; illustrative positions, not a geographic map.
 * Shape references: qazexpocongress.kz/ru/nur-alem/ and site.khanshatyr.com/en.
 * No external models, textures or runtime requests.
 */
import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, Color, ConeGeometry,
  CylinderGeometry, DoubleSide, Group, InstancedMesh, Material, Mesh,
  MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry,
  TubeGeometry, Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const LANDMARK_SITES = [
  { id: "khan-shatyr", x: 136, y: 320, radius: 48 },
  { id: "baiterek", x: 292, y: 300, radius: 30 },
  { id: "nur-alem", x: 432, y: 349, radius: 49 },
  { id: "peace-palace", x: 485, y: 105, radius: 35 },
] as const;

export function nearLandmark(x: number, y: number, padding = 0): boolean {
  return LANDMARK_SITES.some((site) => Math.hypot(x - site.x, y - site.y) < site.radius + padding);
}

const world = (x: number, y: number, elevation = 0.26) => new Vector3((x - 300) / 20, elevation, (y - 210) / 20);

export function createCityLandmarks() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const instances: InstancedMesh[] = [];
  const track = <G extends BufferGeometry>(geometry: G): G => { geometries.push(geometry); return geometry; };
  const material = (color: number, metalness = 0.05, roughness = 0.7) => {
    const value = new MeshStandardMaterial({ color, metalness, roughness });
    materials.push(value);
    return value;
  };
  const ivory = material(0xf1eee4);
  const limestone = material(0xc7c2b1);
  const gold = material(0xcaa55c, 0.45, 0.32);
  const glass = material(0x447f91, 0.5, 0.25);
  const darkGlass = material(0x294e62, 0.4, 0.3);
  const steel = material(0xd5e7e6, 0.35, 0.45);
  const asphalt = material(0x71818a);
  const green = material(0x548c79);
  const lamp = material(0xffdf9c);
  lamp.emissive.setHex(0xffc66d);
  const box = track(new BoxGeometry(1, 1, 1));
  const rod = track(new CylinderGeometry(1, 1, 1, 6));

  function block(parent: Group, x: number, y: number, z: number, w: number, h: number, d: number, mat = ivory) {
    const mesh = new Mesh(box, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }

  function beam(parent: Group, from: Vector3, to: Vector3, radius: number, mat = steel) {
    const mesh = new Mesh(rod, mat);
    const direction = to.clone().sub(from);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.set(radius, direction.length(), radius);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
    parent.add(mesh);
  }

  function disc(parent: Group, radius: number, height: number, y: number, mat = limestone) {
    const mesh = new Mesh(track(new CylinderGeometry(radius, radius, height, 40)), mat);
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }

  function ring(parent: Group, radius: number, thickness: number, y: number, mat = steel) {
    const mesh = new Mesh(track(new TorusGeometry(radius, thickness, 5, 48)), mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }

  // NUR ALEM: blue spherical glass envelope, facade meridians and EXPO pavilions.
  const expo = new Group();
  expo.position.copy(world(432, 349));
  disc(expo, 2.25, 0.12, 0.02);
  disc(expo, 1.72, 0.2, 0.16, ivory);
  const globeRadius = 1.52;
  const globeCenter = 1.72;
  const globe = new Mesh(track(new SphereGeometry(globeRadius, 32, 24)), glass);
  globe.position.y = globeCenter;
  expo.add(globe);
  for (let latitude = -2; latitude <= 3; latitude++) {
    const offset = latitude * 0.36;
    ring(expo, Math.sqrt(globeRadius ** 2 - offset ** 2) + 0.014, 0.017, globeCenter + offset);
  }
  const meridianGeometry = track(new TorusGeometry(globeRadius + 0.02, 0.014, 4, 48));
  for (let i = 0; i < 10; i++) {
    const rib = new Mesh(meridianGeometry, steel);
    rib.position.y = globeCenter;
    rib.rotation.y = i * Math.PI / 10;
    expo.add(rib);
  }
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * 0.08 + i * Math.PI * 0.135;
    const pavilion = block(expo, Math.cos(angle) * 2.02, 0.29, Math.sin(angle) * 2.02, 0.58, 0.45, 0.46);
    pavilion.rotation.y = -angle;
  }
  block(expo, 0, 0.2, 1.68, 0.68, 0.18, 0.44, darkGlass);
  group.add(expo);

  // KHAN SHATYR: elliptical, curved canopy with a displaced mast (not a cone).
  const khan = new Group();
  khan.position.copy(world(136, 320));
  const base = disc(khan, 2.12, 0.18, 0.1);
  base.scale.z = 0.78;
  const canopyGeometry = track(new ConeGeometry(1, 1, 48, 12, true));
  const positions = canopyGeometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const t = positions.getY(i) + 0.5;
    const oldRadius = 1 - t;
    const curvedRadius = Math.pow(oldRadius, 1.28);
    const factor = oldRadius > 0.0001 ? curvedRadius / oldRadius : 0;
    positions.setXYZ(i, positions.getX(i) * factor * 2.02 + 0.58 * t,
      0.25 + t * 3.65, positions.getZ(i) * factor * 1.55 - 0.18 * t);
  }
  canopyGeometry.computeVertexNormals();
  const membrane = material(0xcadbd7, 0.2, 0.5);
  membrane.side = DoubleSide;
  khan.add(new Mesh(canopyGeometry, membrane));
  for (let i = 0; i < 20; i++) {
    const angle = i * Math.PI * 2 / 20;
    const points = Array.from({ length: 9 }, (_, j) => {
      const t = j / 8;
      const r = Math.pow(1 - t, 1.28);
      return new Vector3(Math.cos(angle) * r * 2.04 + 0.58 * t,
        0.27 + t * 3.65, Math.sin(angle) * r * 1.57 - 0.18 * t);
    });
    khan.add(new Mesh(track(new TubeGeometry(new CatmullRomCurve3(points), 12, 0.018, 4, false)), ivory));
  }
  beam(khan, new Vector3(0.58, 3.65, -0.18), new Vector3(0.7, 4.55, -0.22), 0.045, gold);
  const entrance = block(khan, 0, 0.36, 1.45, 1.24, 0.44, 0.23, darkGlass);
  entrance.rotation.y = -0.08;
  group.add(khan);

  // Palace of Peace: a faceted glass pyramid on a broad stepped square podium.
  const palace = new Group();
  palace.position.copy(world(485, 105));
  block(palace, 0, 0.08, 0, 3.05, 0.16, 3.05, limestone);
  block(palace, 0, 0.21, 0, 2.65, 0.13, 2.65);
  const pyramid = new Mesh(track(new ConeGeometry(1.7, 2.5, 4, 1)), glass);
  pyramid.position.y = 1.52;
  pyramid.rotation.y = Math.PI / 4;
  palace.add(pyramid);
  for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) {
    beam(palace, new Vector3(x, 0.28, z), new Vector3(0, 2.77, 0), 0.028, gold);
  }
  for (let level = 1; level < 5; level++) {
    const side = 2.4 * (1 - level / 5);
    const y = 0.27 + level * 0.5;
    block(palace, 0, y, side / 2, side, 0.024, 0.024, steel);
    block(palace, 0, y, -side / 2, side, 0.024, 0.024, steel);
    block(palace, side / 2, y, 0, 0.024, 0.024, side, steel);
    block(palace, -side / 2, y, 0, 0.024, 0.024, side, steel);
  }
  group.add(palace);

  // Four crossings connect both banks. Sculptural arches alternate with road bridges.
  const crossings = [{ x: 96, y: 232, arch: false }, { x: 204, y: 202, arch: true },
    { x: 380, y: 232, arch: false }, { x: 520, y: 202, arch: true }];
  for (const crossing of crossings) {
    const bridge = new Group();
    bridge.position.copy(world(crossing.x, crossing.y, 0));
    const width = crossing.arch ? 0.57 : 0.8;
    block(bridge, 0, 0.34, 0, width + 0.12, 0.18, 3.9, limestone);
    block(bridge, 0, 0.442, 0, width, 0.025, 4.0, asphalt);
    for (const edge of [-1, 1]) {
      block(bridge, edge * (width / 2 + 0.035), 0.58, 0, 0.045, 0.08, 3.8, ivory);
      for (const z of [-1.2, 1.2]) block(bridge, edge * width * 0.3, 0.09, z, 0.12, 0.45, 0.22);
      if (crossing.arch) {
        const points = Array.from({ length: 17 }, (_, i) => {
          const t = i / 16;
          return new Vector3(edge * width * 0.51, 0.48 + Math.sin(t * Math.PI) * 1.05, -1.75 + t * 3.5);
        });
        bridge.add(new Mesh(track(new TubeGeometry(new CatmullRomCurve3(points), 24, 0.055, 5, false)), ivory));
        for (let i = 1; i < 8; i++) {
          const t = i / 8;
          beam(bridge, new Vector3(edge * width * 0.51, 0.49, -1.75 + t * 3.5),
            new Vector3(edge * width * 0.51, 0.48 + Math.sin(t * Math.PI) * 1.05, -1.75 + t * 3.5), 0.012);
        }
      }
    }
    if (!crossing.arch) for (let z = -1.7; z < 1.8; z += 0.5) block(bridge, 0, 0.46, z, 0.035, 0.015, 0.23);
    group.add(bridge);
  }

  // A landscaped pedestrian axis ties the monuments into the urban fabric.
  const boulevard = new Group();
  boulevard.position.copy(world(225, 300));
  block(boulevard, 0, 0.012, 0, 4.8, 0.025, 0.5, limestone);
  block(boulevard, 0, 0.032, 0, 4.2, 0.025, 0.13, green);
  for (const x of [-1.5, -0.65, 0.4, 1.45]) {
    const fountain = new Mesh(track(new CylinderGeometry(0.2, 0.2, 0.05, 16)), glass);
    fountain.position.set(x, 0.08, 0);
    boulevard.add(fountain);
  }
  group.add(boulevard);

  // Waterfront walks and rows of trees, aligned with the schematic river bends.
  const river = [[20, 232], [125, 232], [162, 202], [298, 202], [332, 232], [448, 232], [483, 202], [580, 202]];
  const treePositions: Vector3[] = [];
  const lightPositions: Vector3[] = [];
  for (let i = 0; i < river.length - 1; i++) {
    const [ax, az] = river[i]; const [bx, bz] = river[i + 1];
    const dx = bx - ax; const dz = bz - az;
    const length = Math.hypot(dx, dz);
    for (const bank of [-1, 1]) {
      const offsetX = -dz / length * 19 * bank;
      const offsetZ = dx / length * 19 * bank;
      const from = world(ax + offsetX, az + offsetZ, 0.13);
      const to = world(bx + offsetX, bz + offsetZ, 0.13);
      const walk = block(group, (from.x + to.x) / 2, 0.13, (from.z + to.z) / 2, 0.25, 0.08, length / 20 + 0.06, limestone);
      walk.rotation.y = Math.atan2(dx, dz);
      for (let t = 0.14; t < 1; t += 18 / length) {
        const x = ax + dx * t + offsetX * 1.18;
        const z = az + dz * t + offsetZ * 1.18;
        if (crossings.some((c) => Math.abs(x - c.x) < 12)) continue;
        treePositions.push(world(x, z, 0.39));
        lightPositions.push(world(ax + dx * t + offsetX * 0.91, az + dz * t + offsetZ * 0.91, 0.28));
      }
    }
  }
  const dummy = new Object3D();
  const foliage = new InstancedMesh(track(new SphereGeometry(0.19, 7, 5)), green, treePositions.length);
  treePositions.forEach((position, i) => {
    dummy.position.copy(position); dummy.scale.set(1, 1.45, 1); dummy.updateMatrix(); foliage.setMatrixAt(i, dummy.matrix);
  });
  const lights = new InstancedMesh(track(new SphereGeometry(0.055, 5, 4)), lamp, lightPositions.length);
  lightPositions.forEach((position, i) => {
    dummy.position.copy(position); dummy.scale.setScalar(1); dummy.updateMatrix(); lights.setMatrixAt(i, dummy.matrix);
  });
  instances.push(foliage, lights);
  group.add(foliage, lights);

  // Bake static architecture by material: facade ribs and bridge cables should
  // not each cost a draw call. Foliage/lights remain two instanced meshes.
  group.updateMatrixWorld(true);
  const batches = new Map<Material, Array<Mesh<BufferGeometry, Material>>>();
  group.traverse((object) => {
    if (!(object instanceof Mesh) || object instanceof InstancedMesh || Array.isArray(object.material)) return;
    const batch = batches.get(object.material) ?? [];
    batch.push(object as Mesh<BufferGeometry, Material>);
    batches.set(object.material, batch);
  });
  for (const [mat, meshes] of batches) {
    const pieces = meshes.map((mesh) => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const merged = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    if (!merged) continue;
    meshes.forEach((mesh) => mesh.removeFromParent());
    group.add(new Mesh(track(merged), mat));
  }

  return {
    group,
    setDark(dark: boolean) {
      lamp.emissiveIntensity = dark ? 1.1 : 0.12;
      glass.emissive.copy(new Color(dark ? 0x102c38 : 0x000000));
      glass.emissiveIntensity = dark ? 0.45 : 0;
      asphalt.color.setHex(dark ? 0x465e69 : 0x71818a);
    },
    dispose() {
      instances.forEach((mesh) => mesh.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((value) => value.dispose());
    },
  };
}
