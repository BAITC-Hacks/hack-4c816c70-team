# Отчёт GPT — интеграция frontend

## Исполнитель и commit

GPT-интегратор. Commit будет создан отдельным явным набором файлов; модули Claude 1/2 не добавлены до их финальных отчётов.

## Изменённые файлы

- `app/`: клиентская композиция Simulator, глобальные стили, loading/error boundaries.
- `features/simulator/`: единый reducer, отмена запросов, revision/request ID, блокировка повторной отправки.
- `features/results/`: Score, бюджет из ответа, все районы/показатели, синергии и explanation.
- `lib/api/`, `lib/contracts/api.generated.ts`, `lib/format/`, `mocks/`, `tests/`.
- `package.json`, `tsconfig.test.json`, eslint и `.gitignore`: native `node:test` без новых зависимостей.

## Работает

- Browser fetch напрямую к `${NEXT_PUBLIC_API_URL}/api/*`; пустое значение использует `http://localhost:8080`, завершающий slash нормализуется.
- DTO валидируются до адаптации в UI-модели. Нет rewrite, `API_INTERNAL_URL`, LLM-вызовов или автоматического fixture fallback.
- City-мере payload не добавляет `districtId`; 400/422 сохраняют choices; pending блокирует редактирование и двойной submit; late response после reset игнорируется.
- `appliedEffects` принудительно `null`; блок не рендерится. Дельты — только `after - before` из ответа API.
- `fixtureScenario` — отдельный полный fixture с `source: "fixture"`; production flow его не выбирает.
- `CityOverview` и `Planner` подключены только через их публичные exports.

## Проверки и фактический результат

- `npm run lint` — успешно.
- `npm run typecheck` — успешно.
- `npm test` — 32/32: payload городской меры, envelope API error, stale response/reset и весь набор проверок `validateDraft` Planner.
- `npm run build` — успешно (Next 16.3.6, маршрут `/`).
- Browser на `http://localhost:3000`: корректно отрисовано состояние ошибки загрузки и кнопка retry; console/runtime errors не зафиксированы.

## Скриншоты/шаги воспроизведения

1. Запустить frontend: `npm run dev`.
2. Открыть `http://localhost:3000`.
3. При недоступном API видно «Не удалось загрузить сценарий» и «Повторить загрузку»; fixture не подставляется.

## Что не проверено

Реальный browser flow M7 Нура, M8 Нура, M10 Нура, M12 город, M5 Сарыарка и значение 95 / 5 / 52,56 → 56,54, включая desktop/mobile screenshots. Локальный API недоступен: .NET SDK отсутствует, Docker CLI также отсутствует. `http://localhost:8080/api/scenario` отвергает соединение. Это блокер окружения, не заменённый mock-ответом.

## Блокеры и передача

- Владельцу сервера: предоставить работающий C# API/контейнер на `http://localhost:8080` (Swagger `/swagger/v1/swagger.json`) для реального browser прогона.
- Claude 1 передал только промежуточный отчёт; финальный отчёт Claude 2 пока отсутствует. Их незакоммиченные модули не включены в integration commit до подтверждения владельцев.
- `next dev` автоматически изменил `frontend/AGENTS.md`; этот файл принадлежит архитектору и сознательно не добавлен в commit.

## Изменения публичного контракта

Внутренний `lib/contracts/ui.ts` не менялся. Добавлены отдельные DTO опубликованного API в `lib/contracts/api.generated.ts`.
