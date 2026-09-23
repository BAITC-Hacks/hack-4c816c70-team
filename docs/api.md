# API contract

This document is the agreed shape for implementation. At this checkpoint only `GET /health` is implemented. Backend must publish the remaining routes in Swagger before frontend integration.

Base URL for local development: `http://localhost:8080`. JSON responses use camelCase.

## GET /health

Response `200`: `{ "status": "ok" }`.

## GET /api/scenario

Response `200`:

```json
{
  "budget": 100,
  "horizonQuarters": 8,
  "baselineScore": 52.56,
  "indicators": [{ "id": "T1", "name": "Разгрузка дорог", "weight": 0.1 }],
  "districts": [{ "id": "nura", "name": "Нура", "populationShare": 0.16, "indicators": { "T1": 55, "T2": 40, "E1": 45, "E2": 65, "S1": 38, "S2": 35, "B1": 55, "B2": 50, "C1": 60, "C2": 50 } }],
  "measures": [{ "id": "M7", "category": "social", "name": "Школа + детсад", "scope": "district", "cost": 24, "lagQuarters": 3, "effects": { "S1": 16 } }]
}
```

The example shows one district and one measure for brevity; the real response contains all five districts, ten indicators and 14 measures from the supplied dataset.

## POST /api/simulations/evaluate

Request: exactly five choices. `districtId` is required for `district` measures and omitted for `city` measures.

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

Response `200` has this shape (the real `districts` array contains all five districts):

```json
{
  "spent": 95,
  "remaining": 5,
  "baselineScore": 52.56,
  "score": 56.54,
  "districts": [{
    "id": "nura",
    "scoreBefore": 49.18,
    "scoreAfter": 52.96,
    "indicatorsBefore": { "S1": 38, "S2": 35 },
    "indicatorsAfter": { "S1": 48, "S2": 43.75 }
  }],
  "appliedSynergies": [{ "measureIds": ["M10", "M12"], "districtId": "nura", "indicatorId": "B1", "delta": 2 }],
  "explanation": { "summary": "...", "strengths": [], "risks": [], "recommendations": [] }
}
```

The example shows selected indicators for brevity; the real response includes all ten indicators per district. The exact effects, indicator weights, incompatibilities and scoring formula are in `docs/reference/district-dataset.docx`.

Validation: no duplicate measure, no more than two measures in a category, total cost at most 100, district selection matches scope, and incompatibilities from the dataset are enforced. Invalid choices return JSON:

```json
{ "error": { "code": "BUDGET_EXCEEDED", "message": "Budget limit is 100." } }
```

Use `400` for invalid structure or choices and `422` for exceeded budget. The server is authoritative for validation and scoring. The LLM explains computed numbers and never calculates or changes them.
