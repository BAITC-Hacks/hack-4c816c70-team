# Согласование с C# и сервером

Согласовано по handoff Тамерлана, переданному пользователем 23 сентября 2026. Этот файл фиксирует решения для фронтенда, не меняет API. Источник сетевого контракта — корневой `docs/api.md`; его владелец сообщает о добавлении полей. Подключение MVP не блокируется ожиданием новых полей.

## Что уже описано

- `GET /api/scenario`: budget, horizonQuarters, baselineScore, indicators, districts, measures.
- `POST /api/simulations/evaluate`: choices; район отсутствует у city-меры.
- Успех: spent, remaining, baselineScore, score, districts, appliedSynergies, explanation.
- Ошибка: `{ "error": { "code": "...", "message": "..." } }`; 400 для некорректного выбора, 422 для бюджета.
- В коде реализованы все три endpoints. Тамерлан подтвердил проверку Swagger и POST по HTTP, CORS для localhost:3000 и контрольный ответ 95 / 56.54. Это подтверждение владельца API, а не новый запуск проверок в задаче архитектора.
- Scenario содержит choicesRequired, maxMeasuresPerCategory, criticalThreshold, synergies и incompatibilities; enum category и все district IDs опубликованы.
- Evaluate дополнительно содержит breakdown и baselineBreakdown. По подтверждению владельца API при сбое live LLM сервер возвращает mock-объяснение без потери чисел; frontend всегда использует полученный explanation. Это не frontend mock и не повод подменять результат в браузере.

## Готовое соответствие DTO и UI

- `choicesRequired -> rules.requiredChoices`, `maxMeasuresPerCategory -> rules.maxPerCategory`.
- `incompatibilities[].firstMeasureId/secondMeasureId -> measureIds`; `sameDistrictOnly: true -> scope: same-district`, false -> global.
- `synergies[].firstMeasureId -> targetMeasureId`, first/second -> measureIds, indicatorId/bonus -> effects.
- `uniqueMeasures: true` — документированное правило проекта, проверяемое сервером, отдельного поля API нет.
- `criticalThreshold` передаётся без изменения. Source `api` задаёт adapter, не сервер.
- Районный score в scenario отсутствует: не вычислять. Applied effects пока отсутствуют: `appliedEffects: null`, а не пустой массив.
- UI может вычислять display-only `scoreDelta = score - baselineScore`, районный `scoreDelta = scoreAfter - scoreBefore` и разницы `indicatorsAfter[id] - indicatorsBefore[id]` из ответа. Score, лаги, синергические бонусы и эффекты отдельных мер не пересчитываются.

## Закрытые вопросы MVP

| Вопрос | Решение | Действие frontend |
| --- | --- | --- |
| Сеть | Прямой browser fetch через NEXT_PUBLIC_API_URL | Не добавлять rewrite и API_INTERNAL_URL |
| Applied effects | Пока отсутствуют | Ставить null, раздел скрыть, синергии показывать |
| Дельты результата | Вычитание полученных значений разрешено для показа | Отображать «до → после» и разницу, не запускать модель расчёта |
| Исходный балл района | В scenario отсутствует | Строить обзорную карточку по исходным показателям |
| Сбой live LLM | Сервер возвращает mock-объяснение и сохраняет числа | Отображать полученный explanation без потери результата |

Коды опубликованного контракта: `INVALID_REQUEST`, `WRONG_CHOICE_COUNT`, `UNKNOWN_MEASURE`, `DUPLICATE_MEASURE`, `DISTRICT_REQUIRED`, `DISTRICT_NOT_ALLOWED`, `UNKNOWN_DISTRICT`, `BUDGET_EXCEEDED`, `CATEGORY_LIMIT_EXCEEDED`, `INCOMPATIBLE_MEASURES`. Только бюджет возвращает 422, остальные — 400. Неизвестный код отображается через безопасный текст message и общий fallback.

Поля UI-contract `ScenarioVM` и `EvaluationVM` не диктуют DTO. GPT адаптирует текущий опубликованный контракт. Если старый сервер неожиданно не отдаёт обязательные правила, их не заменяют пустым массивом: показывают ошибку контракта. Текущий API правила отдаёт и позволяет подключить реальную оценку. В dev можно независимо работать с явно помеченным fixture.

## Точные правила из датасета

- Бюджет 100, ровно 5 мер, каждая один раз, максимум 2 на направление.
- M1 + M3 запрещены независимо от выбранных районов.
- M4 + M7 запрещены только в одном районе.
- M5 + M13 запрещены только в одном районе.
- M1 + M2: T1 +2 в районе M1.
- M10 + M12: B1 +2 в районе M10.
- M5 + M6: E2 +2 в районе M5.
- Бонусы синергий фиксированные; лаг не уменьшает их.
- Критическими считаются пары «район × показатель» строго ниже 40.
- Правило «5 решений» не означает «по одному из каждого направления».
- Городская мера применяется ко всем районам и передаётся без districtId.

## Контрольный запрос

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

Эталон команды: spent 95, remaining 5, baselineScore 52,56, score 56,54; appliedSynergies содержит M10/M12 в Нуре. Значения 95 / 56.54 подтверждены Тамерланом через HTTP. Это эталон приёмки, не константы интерфейса. При строгом сравнении использовать точность отображения или согласованный численный допуск.

## Передача участнику сервера

- Браузер использует `${NEXT_PUBLIC_API_URL}/api/*`, локально base URL — `http://localhost:8080`. CORS для `http://localhost:3000` проверен Тамерланом.
- NEXT_PUBLIC_API_URL уже передаётся Docker-сборке. После смены адреса frontend пересобирается. Внутреннее имя `api` не используется браузером; для удалённой демонстрации владелец сервера задаёт публичный URL и разрешённый origin.
- Next rewrite, reverse proxy и API_INTERNAL_URL в MVP не нужны. Текущие Dockerfile, healthcheck и compose не менять ради другой сетевой схемы.
- `LLM_MODE=mock` и OPENAI_API_KEY остаются у C#. Фронт не требует ключа и не проверяет его наличие.
- В корневой THIRD_PARTY передать все фактически добавленные зависимости, лицензии и источники ассетов. Пока архитектурный пакет не добавляет сторонние пакеты.
- Приёмку `docker compose up --build` с нуля выполняет владелец интеграции; фронтенд передаёт воспроизводимый список ошибок, а не редактирует его файлы параллельно.
