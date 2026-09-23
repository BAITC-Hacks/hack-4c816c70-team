# API contract

Implemented in `backend/CitySimulator.Api`: `GET /health`, `GET /api/scenario`, `POST /api/simulations/evaluate`, `POST /api/simulations/alternatives`. Swagger UI: `http://localhost:8080/swagger`, schema: `/swagger/v1/swagger.json`.

Base URL for local development: `http://localhost:8080`. JSON uses camelCase property names; dictionary keys (indicator ids such as `T1`) keep their case. All scores and indicator values in responses are rounded to 2 decimals (midpoint away from zero); calculation uses decimal arithmetic without intermediate rounding. Swagger includes complete request/response examples computed by the same implementation, including validation errors.

Identifiers:

- districts: `yesil` (Есиль), `almaty` (Алматы), `saryarka` (Сарыарка), `baikonur` (Байконур), `nura` (Нура);
- indicators: `T1 T2 E1 E2 S1 S2 B1 B2 C1 C2`;
- categories: `transport`, `ecology`, `social`, `safety`, `services`;
- measure scope: `district` or `city`; measures `M1`–`M14`.

## GET /health

Response `200`: `{ "status": "ok" }`.

## GET /api/scenario

Response `200` (arrays shortened; the real response has 10 indicators, 5 districts, 14 measures, 3 synergies, 3 incompatibilities):

```json
{
  "budget": 100,
  "horizonQuarters": 8,
  "choicesRequired": 5,
  "maxMeasuresPerCategory": 2,
  "criticalThreshold": 40,
  "baselineScore": 52.56,
  "indicators": [{ "id": "T1", "name": "Разгрузка дорог", "category": "transport", "weight": 0.1 }],
  "districts": [{ "id": "nura", "name": "Нура", "populationShare": 0.16, "indicators": { "T1": 55, "T2": 40, "E1": 45, "E2": 65, "S1": 38, "S2": 35, "B1": 55, "B2": 50, "C1": 60, "C2": 50 } }],
  "measures": [{ "id": "M7", "category": "social", "name": "Школа + детсад (модульное строительство)", "scope": "district", "cost": 24, "lagQuarters": 3, "effects": { "S1": 16 } }],
  "synergies": [{ "firstMeasureId": "M10", "secondMeasureId": "M12", "indicatorId": "B1", "bonus": 2 }],
  "incompatibilities": [{ "firstMeasureId": "M4", "secondMeasureId": "M7", "sameDistrictOnly": true, "reason": "Парк и школа не могут быть в одном районе: конфликт за участок." }]
}
```

`effects` are full effects before lag. `synergies[].bonus` is applied in the district of `firstMeasureId` and is not scaled by lag. `sameDistrictOnly: false` means the pair is forbidden in any districts (M1 + M3).

## POST /api/simulations/evaluate

### Explanation language

Optional request header: `Accept-Language: ru-RU`, `kk-KZ` or `en-US`. The JSON request body does not change.

| Requested language | Actual `explanationLocale` | Explanation text |
| --- | --- | --- |
| `ru-RU` / `ru` | `ru-RU` | Russian, decimal comma |
| `kk-KZ` / `kk` | `kk-KZ` | Kazakh, decimal comma |
| `en-US` / `en` | `en-US` | English, decimal point |
| Missing or no supported language | `ru-RU` | Russian fallback |

Regional variants use their supported base language (`en-GB` → `en-US`). Language matching is case-insensitive. For lists, the supported entry with the highest positive `q` value wins; ties retain header order. Unsupported/malformed ranges and entries with `q=0` are ignored; when none match, Russian is used. For example, `en-US;q=0.4, kk-KZ;q=0.9` selects `kk-KZ`.

Every successful response includes the actual canonical `explanationLocale` and a matching `Content-Language` header. All four explanation fields and district names inside them use that language in `mock`, accepted `live`, and fallback after an OpenAI/validation failure. Language selection never depends on LLM success.

Language applies only to `explanation`. IDs, request structure, calculations, numeric JSON fields, scenario/district metadata outside the explanation and validation error messages are unchanged. The reference request below returns `spent=95`, `remaining=5`, `score=56.54` in all three languages.

Request: exactly five choices, order does not matter. `districtId` is required for `district` measures and must be omitted (or `null`/empty) for `city` measures.

```json
{
  "choices": [
    { "measureId": "M7", "districtId": "nura" },
    { "measureId": "M8", "districtId": "nura" },
    { "measureId": "M10", "districtId": "nura" },
    { "measureId": "M12" },
    { "measureId": "M5", "districtId": "saryarka" }
  ]
}
```

Response `200` for this request (actual output; `districts` shortened to Nura, the real array has all five districts with all ten indicators each):

```json
{
  "spent": 95,
  "remaining": 5,
  "baselineScore": 52.56,
  "score": 56.54,
  "breakdown": { "averageScore": 58.08, "minDistrictScore": 52.96, "criticalCount": 0 },
  "baselineBreakdown": { "averageScore": 56.86, "minDistrictScore": 49.18, "criticalCount": 2 },
  "districts": [{
    "id": "nura",
    "name": "Нура",
    "scoreBefore": 49.18,
    "scoreAfter": 52.96,
    "indicatorsBefore": { "T1": 55, "T2": 40, "E1": 45, "E2": 65, "S1": 38, "S2": 35, "B1": 55, "B2": 50, "C1": 60, "C2": 50 },
    "indicatorsAfter": { "T1": 55, "T2": 40, "E1": 45, "E2": 65, "S1": 48, "S2": 43.75, "B1": 67.5, "B2": 51.75, "C1": 60, "C2": 54.38 }
  }],
  "appliedSynergies": [{ "measureIds": ["M10", "M12"], "districtId": "nura", "indicatorId": "B1", "delta": 2 }],
  "appliedEffects": [
    { "measureId": "M5", "districtId": "saryarka", "indicatorId": "E2", "delta": 8.75 },
    { "measureId": "M5", "districtId": "saryarka", "indicatorId": "C1", "delta": 2.5 },
    { "measureId": "M7", "districtId": "nura", "indicatorId": "S1", "delta": 10 },
    { "measureId": "M8", "districtId": "nura", "indicatorId": "S2", "delta": 8.75 },
    { "measureId": "M10", "districtId": "nura", "indicatorId": "B1", "delta": 10.5 },
    { "measureId": "M10", "districtId": "nura", "indicatorId": "B2", "delta": 1.75 },
    { "measureId": "M12", "districtId": "yesil", "indicatorId": "C2", "delta": 4.38 },
    { "measureId": "M12", "districtId": "almaty", "indicatorId": "C2", "delta": 4.38 },
    { "measureId": "M12", "districtId": "saryarka", "indicatorId": "C2", "delta": 4.38 },
    { "measureId": "M12", "districtId": "baikonur", "indicatorId": "C2", "delta": 4.38 },
    { "measureId": "M12", "districtId": "nura", "indicatorId": "C2", "delta": 4.38 }
  ],
  "explanation": {
    "summary": "Итоговый Score 56,54 против базового 52,56 (+3,98). Потрачено 95 из 100. ...",
    "strengths": [
      "Наибольший рост оценки района — Нура: +3,78.",
      "Рост оценки района Сарыарка: +1,65.",
      "Сработала синергия M10 + M12: B1 +2 в районе Нура.",
      "Вклад M7 (Нура) в итог: +1,45 к Score по сравнению с тем же набором без этой меры.",
      "..."
    ],
    "risks": [
      "Самый слабый район Нура (52,96) имеет вес 30% в формуле Score.",
      "Меры с долгим лагом (M7, M8, M5) реализуют лишь часть эффекта за горизонт 8 кварталов."
    ],
    "recommendations": [
      "Заменить M5 (Сарыарка) на M3 (Нура). При этой отдельной замене Score 57,21 (+0,67), расходы 100 из 100.",
      "Заменить M5 (Сарыарка) на M14 (все районы). При этой отдельной замене Score 56,99 (+0,45), расходы 86 из 100.",
      "Заменить M5 (Сарыарка) на M2 (все районы). При этой отдельной замене Score 56,88 (+0,34), расходы 92 из 100.",
      "Варианты замен независимы и применяются по отдельности: их эффекты не суммируются."
    ]
  },
  "explanationSource": "mock",
  "explanationLocale": "ru-RU"
}
```

All four `explanation` fields are written by the server from computed numbers. `explanationSource` is `"llm"` when OpenAI set the priority order of `strengths` and `risks` and that order passed validation, otherwise `"mock"` (default server order). The shape and the set of sentences are the same in both cases; only the order of `strengths` and `risks` can differ.

Numbers inside Russian and Kazakh explanation text use the decimal comma (`Нура (52,96)`, `+3,98`, `−1,75`); English explanation text uses the decimal point. All numeric JSON fields keep standard JSON numbers (`"score": 56.54`). The comma format is built with an explicit `NumberFormatInfo`, so it works with `DOTNET_SYSTEM_GLOBALIZATION_INVARIANT` in Docker.

`recommendations` are always built by the server, in both modes, from validated single-measure replacements (see "AI explanation"). Up to three items of the form `Заменить <id> (<district of the removed measure>) на <id> (<district of the new measure>).` — or `Перенести <id>: <from> → <to>.` when the same measure moves to another district — followed by `При этой отдельной замене Score <scoreAfter> (+<delta>), расходы <spent> из 100.` City measures are shown as `все районы`. The last item says that the replacements are independent and applied one at a time (their effects do not add up). If no single replacement improves Score, the only item is «Ни одна допустимая замена одной меры не повышает Score — отдельной заменой набор не улучшить.»

Scoring (C#, `Features/Simulation/ScoreCalculator.cs`), per `docs/reference/district-dataset.docx`:

- `I'_dk = clip(I_dk + Σ effect_mk × (8 − L_m) / 8 + synergies, 0, 100)`; city measures apply to all five districts;
- `D_d = Σ w_k × I'_dk`; `averageScore = Σ pop_d × D_d`; `minDistrictScore = min D_d`;
- `criticalCount` = number of district × indicator values strictly below 40;
- `score = 0.7 × averageScore + 0.3 × minDistrictScore − 1.0 × criticalCount`.

### Applied effects

`appliedEffects` is an additive response field: one `{measureId, districtId, indicatorId, delta}` for every affected district/indicator of a chosen measure. `delta` is the lag-adjusted contribution, **before synergies and the final 0–100 clamp**, rounded only for display. City measures have entries for all five districts. Negative effects remain negative. Do not sum these display-rounded entries to reconstruct the final result: the authoritative values are `districts[].indicatorsAfter`. For example, M12 adds exactly 4.375 internally, displayed as 4.38, and M10's B1 effect 10.5 excludes its separate synergy bonus 2.

Older deployments omit this field; the frontend adapter retains `null` for absence and distinguishes it from an explicitly empty array. Existing request fields and response fields are unchanged.

### AI explanation

Malformed upstream JSON types (including status/output/content/text) cause a mock fallback, not HTTP 500. Invalid optional usage counters are ignored. Regression checks use an in-memory HTTP double; no real key or model is needed.

Environment variables (read by the API at startup; none is required to build or run):

| Variable | Default | Meaning |
| --- | --- | --- |
| `LLM_MODE` | `mock` | `mock` — deterministic template; `live` — OpenAI Responses API |
| `OPENAI_API_KEY` | — | Required for `live`; never logged |
| `OPENAI_MODEL` | — | Required for `live`; model name is not hardcoded |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1/` | Optional, for a proxy or a local stub in tests |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin of the frontend; comma-separated list allowed |

**Role of AI: prioritizing verified facts.** All explanation text is written by the server. `ExplanationBuilder.BuildCatalog` turns `ScoreCalculator` output into a catalog of claims, each with a stable ID and a ready sentence:

- strengths: the largest district gain (`gain_<district>`; `gain_leaders` if several districts share the top value) and up to two further district gains worded «Рост оценки района …», applied synergies (`synergy_<ids>`), fewer critical values (`critical_reduced`), and every chosen measure with a positive leave-one-out contribution (`impact_<id>`);
- risks: every remaining value below 40 (`critical_<district>_<indicator>`), every negative effect of a chosen measure (`negative_<id>_<district>_<indicator>`, see below), the weakest district (`weakest_district`), long-lag measures (`long_lag`), and chosen measures that do not raise Score (`low_impact_<id>`).

Negative effects come from `ScoreCalculator.RealizedEffects` (effect × `(8 − L) / 8`) for every chosen measure, not only M11; a city measure produces one claim per district. Each claim names the measure, district and indicator and keeps two numbers apart: the measure's own lag-adjusted effect and the indicator's total change in that district from all measures (before → after). When other measures offset the loss (total change ≥ 0) the sentence says so. The claim is added even if the indicator stays above 40; sets without negative effects get no such claim. Example (M11 in Nura): «M11 (Нура) снижает T1: отдельный эффект меры с учётом лага −1,75; итоговое изменение T1 в районе −1,75 (55 → 53,25).»; with M2 in the same set: «…−1,75, но другие меры его компенсируют; итоговое изменение T1 в районе +1,25 (55 → 56,25).» Texts exist in RU/KK/EN (`ExplanationText`), and mock, accepted live order and fallback contain the same claims.

`summary` and `recommendations` are also server-built. In `live` mode the model receives the computed facts (Score and its parts before/after, all districts with all ten indicators, each chosen measure with realized share `(8 − L) / 8`, lag-adjusted effects and `scoreImpact`, synergies, critical values) plus the claim catalog, and returns only the order of claim IDs by importance for this scenario. The server then substitutes the texts. Replacements are not sent to the model.

Replacements (`Features/Simulation/ReplacementAdvisor.cs`): for every chosen measure the server tries every other catalog measure and the same measure in another district, runs the same validation as this endpoint (exactly 5, budget ≤ 100, ≤ 2 per category, district scope, incompatibilities), scores the set with `ScoreCalculator`, keeps only sets with a higher Score and the best district per pair. Each option knows the district of the removed measure and of the new one. Options are not a separate response field; `RecommendationBuilder` turns the top three into `recommendations` text. This Score-only filter is specific to `/evaluate` recommendations; `/alternatives` uses its own unfiltered search (`AlternativeSearch`).

The request uses `POST /v1/responses` with `store: false` and Structured Outputs (`text.format.type = json_schema`, `strict: true`) whose schema is exactly `strengthOrder: string[]`, `riskOrder: string[]`, `additionalProperties: false`. Each array has `minItems = maxItems =` the number of claims in its section and items restricted by `enum` to that section's IDs; an empty section has `minItems = maxItems = 0` and no `enum`. There is no free text in the model output.

Before the order is used the API checks: response status `completed`, no refusal, exactly these two fields, and each array is an exact permutation of its own section — no unknown IDs, no IDs from the other section, no duplicates, no omissions; an empty section accepts only `[]`. Otherwise the claims keep their default catalog order and `explanationSource` is `mock`. Because every sentence comes from the catalog, facts such as «Самый слабый район Нура (52,96)» cannot be altered by the model.

The whole live analysis — all attempts and backoffs — has one 60 s deadline; when it expires the API immediately returns the `mock` explanation. Network errors and HTTP 408/409/429/5xx are retried at most twice within that deadline (backoff 1 s, 2 s). A request therefore waits at most about 60 s plus scoring time; a frontend request timeout of 75 s is enough. `score`, `districts` and all other numeric fields are identical in both modes. Logs contain attempt, HTTP status, elapsed time, token counts and the validation failure reason — no key, request body or model output.

### Errors

Every error returns the same JSON shape:

```json
{ "error": { "code": "BUDGET_EXCEEDED", "message": "Стоимость набора 121 превышает бюджет 100." } }
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Malformed JSON, missing body, missing `choices`, choice without `measureId` |
| 400 | `WRONG_CHOICE_COUNT` | Not exactly 5 choices |
| 400 | `UNKNOWN_MEASURE` | `measureId` not in catalog |
| 400 | `DUPLICATE_MEASURE` | Same measure chosen twice (even in different districts) |
| 400 | `DISTRICT_REQUIRED` | `district` measure without `districtId` |
| 400 | `DISTRICT_NOT_ALLOWED` | `city` measure with `districtId` |
| 400 | `UNKNOWN_DISTRICT` | `districtId` not in dataset |
| 422 | `BUDGET_EXCEEDED` | Total cost above 100 |
| 400 | `CATEGORY_LIMIT_EXCEEDED` | More than 2 measures of one category |
| 400 | `INCOMPATIBLE_MEASURES` | M1 + M3 anywhere; M4 + M7 or M5 + M13 in the same district |
| 400 | `INVALID_GOAL` | `/alternatives` only: `goal` missing or not `score` / `equity` / `economy` |

Only the first failure is returned: structure and count, then per-choice checks, then budget, category limit, incompatibilities. `message` is in Russian and can be shown to the user as is. The server is authoritative for validation and scoring.

## POST /api/simulations/alternatives

Searches the neighbourhood of a valid plan: **every replacement of one chosen measure**, including moving a district measure to another district. The result is named «Лучший найденный вариант среди замен одной меры» (kk: «Бір шараны ауыстыру нұсқаларының ішінде табылған ең жақсы нұсқа», en: «Best option found among single-measure replacements»). It is the best option inside `searchScope = "single_swap"`, **not** a global optimum over all 5-measure plans.

Scoring and validation are exactly those of `POST /api/simulations/evaluate`: every candidate set passes `ChoiceValidator` and is scored by `ScoreCalculator`. Every returned plan, sent unchanged to `/evaluate`, returns the same `spent`, `remaining`, `score`, `breakdown` and `districts[].scoreAfter`.

### Request

`Accept-Language` is negotiated exactly as for `/evaluate`; it changes only text fields (`title`, `change.text`, `arguments[].text`, `tradeoffs[].text`, `recommendation.*text`). Numbers and IDs are identical in all languages; `locale` and `Content-Language` report the actual language.

```json
{
  "choices": [
    { "measureId": "M7", "districtId": "nura" },
    { "measureId": "M8", "districtId": "nura" },
    { "measureId": "M10", "districtId": "nura" },
    { "measureId": "M12" },
    { "measureId": "M5", "districtId": "saryarka" }
  ],
  "goal": "score"
}
```

| `goal` | Target metric | Better means |
| --- | --- | --- |
| `score` | `score` | larger |
| `equity` | `breakdown.minDistrictScore` (score of the weakest district) | larger |
| `economy` | `spent` | smaller |

`goal` is required, lowercase, one of the three values. Errors: missing/unknown `goal` → `400 INVALID_GOAL`; otherwise `choices` must be a valid plan and fail with the same codes and order as `/evaluate` (`INVALID_REQUEST`, `WRONG_CHOICE_COUNT`, …, `422 BUDGET_EXCEEDED`). Order: missing body / `choices` → `INVALID_REQUEST`; then `goal`; then every `/evaluate` rule in its usual order. Error messages are in Russian, as for `/evaluate`.

### Search

1. For every chosen measure `r` (5 slots) and every catalog option `(m, d)` — 10 district measures × 5 districts + 4 city measures = 54 — except the identical `(r, district of r)`, the set "plan without `r` plus `(m, d)`" is a candidate: 5 × 53 = **265 candidates** for any valid plan. `candidatesChecked` is this number; each goes through `ChoiceValidator` (duplicates, budget, category limit, incompatibilities are rejected there). `validCandidates` is how many passed and were scored.
2. For every valid candidate the server keeps Score, average, weakest district score, critical count, spent and all district scores.
3. **Rounding.** Comparisons use the displayed values rounded to 2 decimals (midpoint away from zero), so an "improvement" is never `+0.00`. Differences are `round(round(after) − round(before))`.
4. **Best per goal** (lexicographic, first difference wins):
   - `score`: higher Score → higher weakest district → lower spent → canonical key;
   - `equity`: higher weakest district → higher Score → lower spent → canonical key;
   - `economy`: lower spent → higher Score → higher weakest district → canonical key.

   Canonical key: removed measure number (M1 < M2 < … < M14), then added measure number, then added district in dataset order (`yesil, almaty, saryarka, baikonur, nura`; city measures before any district). The result is independent of request order.
5. **Improvement.** The best candidate for a goal is offered only if it strictly improves that goal against the original plan: `score` and `equity` — rounded metric larger; `economy` — `spent` smaller. Otherwise `bestByGoal.<goal>` is `null`. Economy options can lower Score and the weakest district; this is shown as tradeoffs, never hidden.
6. `variants` contains each offered plan once. When several goals select the same plan it has several `strategies` and all of them point to its `id`; no differences are invented.

### Response `200`

```json
{
  "goal": "score",
  "searchScope": "single_swap",
  "candidatesChecked": 265,
  "validCandidates": 117,
  "original": {
    "choices": [{ "measureId": "M7", "districtId": "nura" }, "…"],
    "spent": 95, "remaining": 5, "score": 56.54,
    "breakdown": { "averageScore": 58.08, "minDistrictScore": 52.96, "criticalCount": 0 },
    "districts": [{ "id": "yesil", "name": "Есиль", "score": 63.43 }, "…"]
  },
  "bestByGoal": { "score": "alt_M5_M3_nura", "equity": "alt_M5_M3_nura", "economy": "alt_M5_M11_nura" },
  "variants": [{
    "id": "alt_M5_M3_nura",
    "strategies": ["score", "equity"],
    "title": "Лучший найденный вариант среди замен одной меры",
    "plan": { "choices": ["…five choices…"], "spent": 100, "remaining": 0, "score": 57.21, "breakdown": {}, "districts": [] },
    "change": {
      "kind": "replace",
      "removed": { "measureId": "M5", "districtId": "saryarka" },
      "added": { "measureId": "M3", "districtId": "nura" },
      "text": "Заменить M5 (Сарыарка) на M3 (Нура)."
    },
    "delta": { "score": 0.67, "averageScore": 0, "minDistrictScore": 0, "criticalCount": 0, "spent": 5, "districts": { "nura": 0 } },
    "arguments": [{ "id": "score_up", "text": "…" }],
    "tradeoffs": [{ "id": "cost_up", "text": "…" }]
  }],
  "recommendation": {
    "status": "improved",
    "variantId": "alt_M5_M3_nura",
    "title": "Лучший найденный вариант среди замен одной меры",
    "text": "…",
    "arguments": [{ "id": "score_up", "text": "…" }],
    "tradeoffs": [{ "id": "cost_up", "text": "…" }],
    "source": "mock"
  },
  "locale": "ru-RU"
}
```

The exact executable example (all fields, real numbers) is in Swagger and in the "Reference result" below.

- `plan` / `original`: full five `choices` (original order; the replaced slot holds the new choice), `spent`, `remaining`, `score`, `breakdown` and every district score (`districts[].score` equals `/evaluate` `districts[].scoreAfter`).
- `change.kind`: `replace` (another measure) or `move` (same district measure, other district). `districtId` is `null` for city measures.
- `delta`: variant minus original, per the rounding rule; `spent` is positive when the variant costs more. `districts` has all five districts.
- `arguments` (gains) and `tradeoffs` (losses) are computed facts with stable IDs; a zero change yields no fact:

| Argument ID | Tradeoff ID | Fact |
| --- | --- | --- |
| `score_up` | `score_down` | Score change |
| `min_district_up` | `min_district_down` | weakest district score change |
| `average_up` | `average_down` | population-weighted average change |
| `cost_down` | `cost_up` | spending change and remaining budget |
| `critical_down` | `critical_up` | number of indicators below 40 |
| `district_<id>_up` | `district_<id>_down` | district score change |
| `synergy_gained_<ids>_<district>` | `synergy_lost_<ids>_<district>` | synergy that appears / disappears |

  Order: goal fact first, then the table order, districts in dataset order.

- `recommendation.status = "no_improvement"`: `variantId` is `null`, `arguments`/`tradeoffs` are empty, `text` says that none of the checked replacements improves the goal and that the original plan stays the best found. Other goals may still have `variants`.

### AI selection

After the search the server makes **at most one** OpenAI request (`POST /v1/responses`, `store: false`, strict Structured Outputs, no retries). It is skipped when `LLM_MODE` is not `live` or no variant improves the requested goal. The model receives the goal, the original metrics and the eligible variants (those that improve the requested goal) with their fact IDs and numbers, and returns only IDs:

```json
{ "variantId": "alt_M5_M3_nura", "argumentIds": ["score_up"], "tradeoffIds": ["cost_up"] }
```

The server accepts the answer only if `variantId` is an eligible variant, every argument/tradeoff ID belongs to **that** variant, IDs are unique, 1–3 arguments including the goal fact (`score_up`, `min_district_up` or `cost_down`), 0–4 tradeoffs including every present `score_down`, `min_district_down`, `critical_up`. The server substitutes all texts and numbers. Otherwise, on any HTTP/network/timeout (60 s) error, the deterministic advice is used: `variantId = bestByGoal[goal]`, the goal fact plus the next two arguments, the mandatory tradeoffs plus the next ones up to four. `recommendation.source` is `llm` only for an accepted model answer, otherwise `mock`. `bestByGoal`, `variants` and all numbers never depend on the model.

### Reference results

Actual `mock` output (Swagger has complete executable examples `score`, `equity`, `economy` for the control plan).

Control plan (Score 56.54, spent 95): `candidatesChecked = 265`, `validCandidates = 117`,
`bestByGoal = { "score": "alt_M5_M3_nura", "equity": "alt_M5_M3_nura", "economy": "alt_M5_M11_nura" }`. Score and equity select the same plan, so `variants` has two entries:

| `id` | `strategies` | change | spent | Score | weakest | `delta.score` | `delta.minDistrictScore` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `alt_M5_M3_nura` | `score`, `equity` | M5 (Сарыарка) → M3 (Нура) | 100 | 57.21 | 54.98 | +0.67 | +2.02 |
| `alt_M5_M11_nura` | `economy` | M5 (Сарыарка) → M11 (Нура) | 80 | 56.69 | 53.73 | +0.15 | +0.77 |

`goal = "economy"`, `Accept-Language: ru-RU`:

```json
{
  "status": "improved",
  "variantId": "alt_M5_M11_nura",
  "title": "Лучший найденный вариант среди замен одной меры",
  "text": "Для цели «экономия бюджета»: Заменить M5 (Сарыарка) на M11 (Нура).",
  "arguments": [
    { "id": "cost_down", "text": "Расходы снижаются: 95 → 80 (экономия 15), остаток 20 из 100." },
    { "id": "score_up", "text": "Score растёт: 56,54 → 56,69 (+0,15)." },
    { "id": "min_district_up", "text": "Оценка самого слабого района растёт: 52,96 → 53,73 (+0,77)." }
  ],
  "tradeoffs": [
    { "id": "average_down", "text": "Средневзвешенная оценка районов снижается: 58,08 → 57,96 (−0,12)." },
    { "id": "district_saryarka_down", "text": "Оценка района Сарыарка снижается: 56,3 → 55,09 (−1,21)." }
  ],
  "source": "mock"
}
```

Savings that lower Score — plan `M7 nura, M8 nura, M10 nura, M12, M3 nura` (Score 57.21, spent 100), `goal = "economy"` → `alt_M3_M11_nura`, spent 80, Score 56.69: `arguments = [cost_down]`, `tradeoffs = [score_down "Score снижается: 57,21 → 56,69 (−0,52).", min_district_down (−1,25), average_down (−0,2), district_nura_down (−1,25)]`.

No improvement — the same plan with `goal = "score"` is a single-swap local optimum: `bestByGoal.score = null`, `recommendation = { "status": "no_improvement", "variantId": null, "text": "Ни одна из 87 допустимых замен одной меры не улучшает цель «Score» (проверено наборов: 265); исходный план остаётся лучшим найденным.", "arguments": [], "tradeoffs": [], "source": "mock" }`.

## Reproducible explanation-language checks

With .NET 8 and Python 3 installed, run from the repository root in WSL:

```bash
python3 backend/scripts/verify-explanation-locales.py
```

The script builds the API, starts temporary local instances and a local OpenAI stub, and checks Russian/Kazakh/English in mock, accepted live, HTTP-error fallback and invalid-order fallback. It checks language negotiation and OpenAPI, uses no real API key or paid OpenAI calls, and cleans up its own processes.
