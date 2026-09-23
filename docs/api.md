# API contract

Implemented in `backend/CitySimulator.Api`: `GET /health`, `GET /api/scenario`, `POST /api/simulations/evaluate`. Swagger UI: `http://localhost:8080/swagger`, schema: `/swagger/v1/swagger.json`.

Base URL for local development: `http://localhost:8080`. JSON uses camelCase property names; dictionary keys (indicator ids such as `T1`) keep their case. All scores and indicator values in responses are rounded to 2 decimals; calculation runs at full precision.

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

### AI explanation

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
- risks: every remaining value below 40 (`critical_<district>_<indicator>`), the weakest district (`weakest_district`), long-lag measures (`long_lag`), and chosen measures that do not raise Score (`low_impact_<id>`).

`summary` and `recommendations` are also server-built. In `live` mode the model receives the computed facts (Score and its parts before/after, all districts with all ten indicators, each chosen measure with realized share `(8 − L) / 8`, lag-adjusted effects and `scoreImpact`, synergies, critical values) plus the claim catalog, and returns only the order of claim IDs by importance for this scenario. The server then substitutes the texts. Replacements are not sent to the model.

Replacements (`Features/Simulation/ReplacementAdvisor.cs`): for every chosen measure the server tries every other catalog measure and the same measure in another district, runs the same validation as this endpoint (exactly 5, budget ≤ 100, ≤ 2 per category, district scope, incompatibilities), scores the set with `ScoreCalculator`, keeps only sets with a higher Score and the best district per pair. Each option knows the district of the removed measure and of the new one. Options are not a separate response field; `RecommendationBuilder` turns the top three into `recommendations` text.

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

Only the first failure is returned: structure and count, then per-choice checks, then budget, category limit, incompatibilities. `message` is in Russian and can be shown to the user as is. The server is authoritative for validation and scoring.

## Reproducible explanation-language checks

With .NET 8 and Python 3 installed, run from the repository root in WSL:

```bash
python3 backend/scripts/verify-explanation-locales.py
```

The script builds the API, starts temporary local instances and a local OpenAI stub, and checks Russian/Kazakh/English in mock, accepted live, HTTP-error fallback and invalid-order fallback. It checks language negotiation and OpenAPI, uses no real API key or paid OpenAI calls, and cleans up its own processes.
