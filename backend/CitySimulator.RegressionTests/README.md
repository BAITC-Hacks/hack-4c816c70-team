# Regression checks

Run from the repository root with the .NET 8 SDK:

```bash
dotnet run --project backend/CitySimulator.RegressionTests -c Release
```

This dependency-free executable returns a nonzero exit code on failure. It covers exact decimal rounding, baseline/control results, clamp bounds, per-measure effects, validated claim ordering, malformed LLM response shapes, and `/alternatives`: exhaustive single-swap search, tie-breaking, improvement rule, re-evaluation of every returned plan, ru/kk/en texts and the single validated LLM selection. HTTP is an in-memory double: no OpenAI account, real API key, model access or paid requests are required.

For the complete HTTP contract and independent arithmetic oracle, start the API in `LLM_MODE=mock`, then use Node 22+:

```bash
node backend/tests/api-regression.mjs http://localhost:8080
```

The HTTP suite checks 400 seeded sets, 120 control permutations, validation rules, `/alternatives` (every returned plan is re-sent to `/evaluate` and to the arithmetic oracle; 25 seeded plans × 3 goals), all district indicators, applied effects, CORS and executable Swagger examples. It also verifies ru-RU / kk-KZ / en-US explanations, language fallback and unchanged numeric results. It sends more than 500 requests; use an isolated test deployment, not the public demo. The CORS assertion expects `FRONTEND_ORIGIN=http://localhost:3000` unless `TEST_FRONTEND_ORIGIN` is set explicitly to match your API configuration. Set `AUDIT_OUTPUT` to a local path to retain the detailed JSON report; otherwise no report file is written.

Browser regression: at 390×844 open `/decisions`, select a valid set, collapse the plan, then simulate HTTP 500, disconnection, malformed JSON or a timeout. The error must be visible outside the collapsed plan and receive focus, with all choices retained. Repeat a successful evaluation after recovery. Switch ru/kk/en and verify that the error heading and saved-plan message use the current language. Do not inject failures into the public server.
