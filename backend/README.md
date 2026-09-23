# Backend

`CitySimulator.Api/` — .NET 8 Minimal API. Стартовый проект уже содержит `/health` и Swagger. Доменную логику размещайте по функциям внутри проекта, например `Features/Scenario` и `Features/Simulation`; входные данные и формулу Score держите отдельно от HTTP-обработчиков.

Контракт для фронтенда: [`../docs/api.md`](../docs/api.md). Источник чисел и правил: [`../docs/reference/district-dataset.docx`](../docs/reference/district-dataset.docx). Балл считает C#; AI получает готовые числа и только объясняет их.

Локальная проверка в WSL:

```bash
dotnet run --project CitySimulator.Api --urls http://localhost:8080
curl http://localhost:8080/health
```

Swagger: `http://localhost:8080/swagger`.
