import { strict as assert } from "node:assert";
import test from "node:test";
import {
  categoryName,
  districtName,
  incompatibilityReason,
  indicatorName,
  measureName,
  type Locale,
} from "../lib/i18n/catalog";

const locales: readonly Locale[] = ["ru", "kk", "en"];

test("i18n catalogue translates every known id and preserves unknown API names", () => {
  const districts = ["yesil", "almaty", "saryarka", "baikonur", "nura"];
  const measures = Array.from({ length: 14 }, (_, index) => `M${index + 1}`);
  const indicators = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"];
  const categories = ["transport", "ecology", "social", "safety", "services"];

  for (const locale of locales) {
    for (const id of districts) assert.notEqual(districtName(id, locale, "API district"), "API district");
    for (const id of measures) assert.notEqual(measureName(id, locale, "API measure"), "API measure");
    for (const id of indicators) assert.notEqual(indicatorName(id, locale, "API indicator"), "API indicator");
    for (const id of categories) assert.notEqual(categoryName(id, locale), id);
    assert.notEqual(incompatibilityReason(["M1", "M3"], locale, "API reason"), "API reason");
    assert.notEqual(incompatibilityReason(["M4", "M7"], locale, "API reason"), "API reason");
    assert.notEqual(incompatibilityReason(["M5", "M13"], locale, "API reason"), "API reason");
  }

  assert.equal(measureName("M99", "en", "API measure"), "API measure");
  assert.equal(districtName("atlantis", "kk", "API district"), "API district");
  assert.equal(indicatorName("Z1", "ru", "API indicator"), "API indicator");
});
