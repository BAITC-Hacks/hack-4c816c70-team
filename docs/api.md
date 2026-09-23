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
    "summary": "Итоговый Score 56.54 против базового 52.56 (+3.98). Потрачено 95 из 100. ...",
    "strengths": ["Наибольший рост в районе Нура: +3.78 к оценке района.", "Сработала синергия M10 + M12: B1 +2 в районе Нура."],
    "risks": ["Самый слабый район Нура (52.96) определяет 30% итогового балла."],
    "recommendations": ["Сравните набор с альтернативами, заменив меру с наименьшим вкладом."]
  }
}
```

Scoring (C#, `Features/Simulation/ScoreCalculator.cs`), per `docs/reference/district-dataset.docx`:

- `I'_dk = clip(I_dk + Σ effect_mk × (8 − L_m) / 8 + synergies, 0, 100)`; city measures apply to all five districts;
- `D_d = Σ w_k × I'_dk`; `averageScore = Σ pop_d × D_d`; `minDistrictScore = min D_d`;
- `criticalCount` = number of district × indicator values strictly below 40;
- `score = 0.7 × averageScore + 0.3 × minDistrictScore − 1.0 × criticalCount`.

`explanation` is currently a deterministic template built from the computed numbers (works without an LLM key). An LLM may later replace the text of the same four fields; it never calculates or changes numbers.

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
