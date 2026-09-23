import type { DistrictId } from "@/lib/contracts/ui";

/**
 * Геометрия авторской схемы. Это условная раскладка, а не география:
 * в датасете нет границ районов. Числовых данных сценария здесь нет.
 *
 * Река проходит по середине схемы с изломами под 45°; районы северного и
 * южного берега повторяют её контур с одинаковым зазором.
 */
export const ATLAS_VIEWBOX = { width: 600, height: 420 } as const;

export interface AtlasSlot {
  readonly key: string;
  /** Вершины области в координатах viewBox. */
  readonly points: string;
  /** Точка района и начало подписи. */
  readonly anchor: { readonly x: number; readonly y: number };
}

export const ATLAS_SLOTS: readonly AtlasSlot[] = [
  { key: "nw", points: "56,28 196,28 196,175 160,175 130,205 32,205 32,52", anchor: { x: 54, y: 62 } },
  { key: "n", points: "212,28 348,28 372,52 372,205 330,205 300,175 212,175", anchor: { x: 232, y: 62 } },
  { key: "ne", points: "388,28 568,28 568,151 544,175 480,175 450,205 388,205", anchor: { x: 408, y: 62 } },
  { key: "sw", points: "32,259 130,259 160,229 236,229 236,392 56,392 32,368", anchor: { x: 54, y: 280 } },
  {
    key: "s",
    points: "252,229 300,229 330,259 450,259 480,229 544,229 568,253 568,392 252,392",
    anchor: { x: 352, y: 280 },
  },
];

/** Центральная линия реки. */
export const RIVER_PATH = "M -20 232 H 130 L 160 202 H 300 L 330 232 H 450 L 480 202 H 620";

/** Городские линии: видны в зазорах между областями. */
export const STREET_PATHS: readonly string[] = [
  "M 204 0 V 420",
  "M 380 0 V 420",
  "M 244 214 V 420",
  "M 0 217 H 600",
  "M 0 244 H 600",
];

/** Мосты через реку. */
export const BRIDGE_PATHS: readonly string[] = ["M 204 182 V 252", "M 380 208 V 280", "M 96 208 V 256"];

/**
 * Предпочтительные позиции для известных идентификаторов. Неизвестные районы
 * занимают свободные позиции по порядку; районы сверх пяти позиций видны
 * только в списке карточек.
 */
const PREFERRED_SLOT: Readonly<Record<string, string>> = {
  saryarka: "nw",
  baikonur: "n",
  almaty: "ne",
  nura: "sw",
  yesil: "s",
};

export function assignSlots(districtIds: readonly DistrictId[]): Map<DistrictId, AtlasSlot> {
  const byKey = new Map(ATLAS_SLOTS.map((slot) => [slot.key, slot]));
  const taken = new Set<string>();
  const result = new Map<DistrictId, AtlasSlot>();

  for (const id of districtIds) {
    const key = PREFERRED_SLOT[id];
    const slot = key ? byKey.get(key) : undefined;
    if (slot && !taken.has(slot.key)) {
      result.set(id, slot);
      taken.add(slot.key);
    }
  }

  const free = ATLAS_SLOTS.filter((slot) => !taken.has(slot.key));
  for (const id of districtIds) {
    if (result.has(id)) continue;
    const slot = free.shift();
    if (!slot) break;
    result.set(id, slot);
  }

  return result;
}
