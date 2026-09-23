import { strict as assert } from "node:assert";
import test from "node:test";
import { createLocaleStore, LOCALE_STORAGE_KEY } from "../lib/i18n/locale-store";

test("locale store keeps an in-memory language when browser storage is unavailable", () => {
  const store = createLocaleStore(() => ({
    getItem: () => { throw new Error("Storage disabled"); },
    setItem: () => { throw new Error("Storage disabled"); },
  }));

  assert.equal(store.getSnapshot(), "ru");
  store.setLocale("kk");
  assert.equal(store.getSnapshot(), "kk");
  store.setLocale("en");
  assert.equal(store.getSnapshot(), "en");
});

test("locale store persists normally and returns to storage for cross-tab updates", () => {
  let value: string | null = "ru";
  const store = createLocaleStore(() => ({
    getItem: (key) => key === LOCALE_STORAGE_KEY ? value : null,
    setItem: (key, next) => { if (key === LOCALE_STORAGE_KEY) value = next; },
  }));

  store.setLocale("en");
  assert.equal(value, "en");
  value = "kk";
  store.useStorageSnapshot();
  assert.equal(store.getSnapshot(), "kk");
});
