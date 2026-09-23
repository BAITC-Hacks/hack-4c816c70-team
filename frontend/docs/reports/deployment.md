# Серверный релиз f3f1981 — 23 сентября 2026

Исторический отчёт. Для текущей версии и каталога публикации используйте [release-readiness.md](release-readiness.md); команды из этого отчёта не предназначены для обновления нынешнего релиза.

Публичный адрес: https://akim-5h-pta5pi108.gobrev.dev

Развёрнут полный проект (API + frontend + gateway) из commit `f3f1981ac1d8740c3f3a7e01bc14a204050a1c7d`. Это проверенная версия с 3D и мобильными исправлениями, до локализации. Текущие незакоммиченные правки других агентов не включены.

## Где теперь работает Compose

- SSH: `ssh -p 26438 frontend@global.prd.ga.run.brev.nvidia.com`.
- Активные исходники: `/home/frontend/releases/akim-f3f1981`.
- Compose project: `akim-5h`, те же три контейнера и порты.
- Файлы: `docker-compose.yml`, `docker-compose.brev.yml`, `runtime-preserved.json`.
- Последний файл — серверный конфигурационный snapshot API, права 600. Содержимое не публиковать и не добавлять в Git; там могут быть секреты. Настройки перенесены из существующего контейнера через Docker API; значения ключей не выводились. Режим на момент переноса — `LLM_MODE=mock`.
- Предыдущая рабочая копия `/home/ubuntu/workspace/hack-4c816c70-team` содержала локальные изменения и оставлена нетронутой. Не запускать из неё обновление параллельно: это другой набор исходников с тем же именем Compose-проекта.
- Источник доставлен через `git archive` + SCP: GitHub clone на сервере требовал авторизацию. Архив содержит только отслеживаемые файлы коммита, без локальных .env и node_modules.
- SHA256 архива: `5c1ef7879f46c7ef489f409fc5faa3771536d27ac8377d129cf24c1ef6854e0c`.

Проверка состояния без вывода конфигурационных секретов:

```bash
cd /home/frontend/releases/akim-f3f1981
docker compose -p akim-5h -f docker-compose.yml -f docker-compose.brev.yml -f runtime-preserved.json ps
curl --fail http://127.0.0.1:8000/health
```

Для следующего релиза создать новый каталог по SHA, перенести серверные настройки с сохранением прав, собрать и обновить тот же project. Не менять порт Secure Link и не публиковать напрямую порты API/frontend. Browser API base остаётся `/`.

## Результат проверки

- Docker production build API и frontend успешен; три контейнера healthy.
- Public GET /health, /api/scenario, /swagger/v1/swagger.json, /decisions, /results, /favicon.ico — 200.
- Scenario: 5 районов, 14 мер, бюджет 100, baselineScore 52.56.
- Контрольный POST через публичный адрес: spent 95, remaining 5, score 56.54, explanationSource mock.
- Тот же набор выбран вручную через публичный браузерный UI: Score 52,56 → 56,54, синергия M10+M12, подпись «Шаблонное объяснение», фокус на h1 результата.
- Невалидные POST: 422 BUDGET_EXCEEDED и 400 INCOMPATIBLE_MEASURES.
- Desktop: 3D canvas присутствует, навигация на /decisions работает; console warn/error пусты.
- При viewport 390×844 результат и раскрытая корзина не имеют горизонтального переполнения: scrollWidth = clientWidth = 375 (остальное занимает системная полоса прокрутки). Возврат к редактированию сохраняет контрольный набор.

## Откат

Перед обновлением сохранены image tags: `akim-rollback-api:before-f3f1981`, `akim-rollback-frontend:before-f3f1981`, `akim-rollback-gateway:before-f3f1981`. Образы не удалять до приёмки следующего релиза. Откат выполнять явно согласованным Compose override с этими images и `--no-build`; штатный compose up без override снова использует новый релиз.

## Что осталось

Обязательная RU/KK/EN локализация выполняется агентами и должна войти в следующий проверенный релиз. На этом сервере live LLM не включался: сохранён исходный mock. Пароль для sudo не предоставлялся и не требовался; выданного членства в группе docker хватило для деплоя.
