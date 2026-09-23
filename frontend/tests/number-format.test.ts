import { strict as assert } from "node:assert";
import test from "node:test";
import { formatInteger, formatNumber, formatPercent, formatSigned } from "../lib/format/numbers";

test("Russian and Kazakh use decimal commas; English uses a point", () => {
  for (const locale of ["ru-RU", "kk-KZ", "en-US"] as const) {
    const separator = locale === "en-US" ? "." : ",";
    assert.equal(formatNumber(56.54, locale), `56${separator}54`);
    assert.equal(formatNumber(-1.75, locale), `-1${separator}75`);
    assert.equal(formatNumber(0, locale), `0${separator}00`);
    assert.equal(formatSigned(1.25, locale), `+1${separator}25`);
    assert.equal(formatInteger(95, locale), "95");
    assert.equal(formatPercent(0.3, locale), new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(0.3));
    const nativeParts = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(1234.56);
    assert.equal(formatNumber(1234.56, locale), nativeParts.map((part) => part.type === "decimal" ? separator : part.value).join(""));
  }
});
