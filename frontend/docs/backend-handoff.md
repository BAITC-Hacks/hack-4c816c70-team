# Согласование с C# и сервером

Обновлено после получения commit `8117017` в 13:57. Этот файл — запрос на уточнение, не изменение API. Владельцем корневого `docs/api.md` остаётся Тамерлан. Отправить ему содержание через участника команды; автоматическая отправка из этого задания не выполняется.

## Что уже описано

- `GET /api/scenario`: budget, horizonQuarters, baselineScore, indicators, districts, measures.
- `POST /api/simulations/evaluate`: choices; район отсутствует у city-меры.
- Успех: spent, remaining, baselineScore, score, districts, appliedSynergies, explanation.
- Ошибка: `{ "error": { "code": "...", "message": "..." } }`; 400 для некорректного выбора, 422 для бюджета.
- В коде реализованы все три endpoints. В этой задаче их работа через HTTP ещё не проверена.
- Scenario содержит choicesRequired, maxMeasuresPerCategory, criticalThreshold, synergies и incompatibilities; enum category и все district IDs опубликованы.
- Evaluate дополнительно содержит breakdown и baselineBreakdown; explanation пока детерминированный шаблон, внешнего LLM-вызова нет.

## Готовое соответствие DTO и UI

- `choicesRequired -> rules.requiredChoices`, `maxMeasuresPerCategory -> rules.maxPerCategory`.
- `incompatibilities[].firstMeasureId/secondMeasureId -> measureIds`; `sameDistrictOnly: true -> scope: same-district`, false -> global.
- `synergies[].firstMeasureId -> targetMeasureId`, first/second -> measureIds, indicatorId/bonus -> effects.
- `uniqueMeasures: true` — документированное правило проекта, проверяемое сервером, отдельного поля API нет.
- `criticalThreshold` передаётся без изменения. Source `api` задаёт adapter, не сервер.
- Районный score в scenario отсутствует: не вычислять. Applied effects пока отсутствуют: `appliedEffects: null`, а не пустой массив.

## Что необходимо зафиксировать в Swagger

| Пробел | Зачем фронтенду | Предложение для согласования |
| --- | --- | --- |
| Applied effects | Показать реальные эффекты с лагом | Для каждого эффекта measureId, districtId, indicatorId, delta; уточнить учёт clipping |
| Дельты результата | Изменения без расчёта модели в браузере | scoreDelta, district scoreDelta, indicator deltas, либо согласовать арифметическое отображение разницы |
| Исходный балл района | Честная обзорная карточка | Поле score в scenario либо карточка только с исходными показателями |
| Поведение при сбое LLM | Результат не должен теряться | Серверный deterministic fallback explanation при LLM_MODE=mock и ошибке внешнего провайдера; согласовать контракт |

Коды опубликованного контракта: `INVALID_REQUEST`, `WRONG_CHOICE_COUNT`, `UNKNOWN_MEASURE`, `DUPLICATE_MEASURE`, `DISTRICT_REQUIRED`, `DISTRICT_NOT_ALLOWED`, `UNKNOWN_DISTRICT`, `BUDGET_EXCEEDED`, `CATEGORY_LIMIT_EXCEEDED`, `INCOMPATIBLE_MEASURES`. Только бюджет возвращает 422, остальные — 400. Неизвестный код отображается через безопасный текст message и общий fallback.

Поля UI-contract `ScenarioVM` и `EvaluationVM` не диктуют DTO. GPT адаптирует их после публикации Swagger. Отсутствующие правила не заменяются пустым массивом: интерфейс сообщает, что правила ещё недоступны, и не включает оценку. В dev можно независимо работать с явно помеченным fixture.

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

Ожидания команды: spent 95, remaining 5, baselineScore 52,56, score около 56,54; appliedSynergies содержит M10/M12 в Нуре. Эти значения — эталон приёмки, не константы интерфейса. При строгом сравнении использовать точность отображения или согласованный численный допуск.

## Передача участнику сервера

- Браузер использует относительный `/api/*`. Согласовать reverse proxy или build-time destination Next rewrites, C# service name и порт.
- Целевой `API_INTERNAL_URL` — server-only; локально `http://localhost:8080`, внутри текущего compose — `http://api:8080`. Сейчас Docker использует публичный `NEXT_PUBLIC_API_URL`; переход согласовать, не заменять env в одиночку.
- Точный способ передачи env в build, healthcheck Next, `output: standalone` и Dockerfile согласует GPT с владельцем compose.
- `LLM_MODE=mock` и OPENAI_API_KEY остаются у C#. Фронт не требует ключа и не проверяет его наличие.
- В корневой THIRD_PARTY передать все фактически добавленные зависимости, лицензии и источники ассетов. Пока архитектурный пакет не добавляет сторонние пакеты.
- Приёмку `docker compose up --build` с нуля выполняет владелец интеграции; фронтенд передаёт воспроизводимый список ошибок, а не редактирует его файлы параллельно.
