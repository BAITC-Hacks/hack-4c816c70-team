# Clean-start проверка `origin/main`

Дата: 23.09.2026  
Статус: **не завершена: контейнерный запуск недоступен в проверяющей среде**.

## Исходники и изоляция

- Сверен `origin/main`: `53ee80641b60cae32571db3476a1a791f9b7416a`.
- `53ee806` является предком `origin/main` (проверка `git merge-base --is-ancestor` завершилась с кодом 0).
- Создан отдельный чистый checkout: `C:\\Users\\kiril\\Hackathon\\clean-start-53ee806`.
- В checkout `HEAD` равен `53ee80641b60cae32571db3476a1a791f9b7416a`, `git status --short` пуст.
- Для изолированного Compose-прогона выбраны незанятые порты `18080` (API) и `13000` (frontend): `Get-NetTCPConnection -State Listen -LocalPort 18080,13000` не вернул слушателей.
- Предполагаемое имя Compose project: `akim-clean-53ee806`. Оно отличается от штатного `akim-5h`; существующие контейнеры и действующее демо не запускались, не останавливались и не менялись.

## Фактическая среда

Проверка выполнялась в **Windows PowerShell на хосте Windows**, не в WSL Ubuntu.

| Компонент | Фактический результат |
| --- | --- |
| WSL | `wsl.exe -l -q` / `wsl.exe --status`: установленных дистрибутивов нет; Ubuntu недоступна. |
| Docker / Docker Compose | `docker` отсутствует в `PATH`; `where.exe docker` не нашёл исполняемый файл. `podman` и `nerdctl` также не найдены. |
| Node.js | `v24.21.0` |
| npm | `11.19.0` |
| .NET SDK | отсутствует (`dotnet --version`: `No .NET SDKs were found`). |

Следовательно, невозможно честно выполнить Docker Compose build, запустить API или послать HTTP-запросы, требующие API. Нативная Windows-проверка ниже не является Ubuntu-прогоном и не подтверждает контейнеры.

## Выполненные команды и результаты

```powershell
git -C C:\Users\kiril\Hackathon\hack-4c816c70-team fetch origin
git -C C:\Users\kiril\Hackathon\hack-4c816c70-team rev-parse origin/main
git -C C:\Users\kiril\Hackathon\hack-4c816c70-team merge-base --is-ancestor 53ee806 origin/main
git clone --no-local --branch main C:\Users\kiril\Hackathon\hack-4c816c70-team C:\Users\kiril\Hackathon\clean-start-53ee806
git -C C:\Users\kiril\Hackathon\clean-start-53ee806 rev-parse HEAD
Get-NetTCPConnection -State Listen -LocalPort 18080,13000
```

Результат: checkout создан отдельно, SHA совпадает с `origin/main`, оба порта на момент проверки свободны.

```powershell
wsl.exe -l -q
wsl.exe --status
where.exe docker
Get-Command podman,nerdctl,docker.exe -ErrorAction SilentlyContinue
docker compose version
node --version
npm --version
dotnet --version
```

Результат: WSL-дистрибутивов, Docker/Compose, Podman/Nerdctl и .NET SDK нет. Node/npm доступны.

```powershell
Set-Location C:\Users\kiril\Hackathon\clean-start-53ee806\frontend
npm ci
npm run build
```

Первый `npm ci` получил `EPERM` при чтении общего `C:\\Users\\kiril\\AppData\\Local\\npm-cache`; после разрешённого повтора зависимости установились. Финальный `npm run build` завершился успешно: Next.js 16.3.6 собрал `/`, `/decisions` и `/results` как static routes. Это только нативная frontend production build-проверка, без API.

## Проверки clean start

| Проверка | Результат | Причина / наблюдение |
| --- | --- | --- |
| `docker compose ... up --build -d --wait` | Не выполнено | Docker/Compose отсутствует. |
| Healthcheck `GET /health` | Не выполнено | API не может быть собран и запущен без Docker или .NET SDK. |
| Swagger `/swagger/v1/swagger.json` | Не выполнено | API не запущен. |
| Контрольный POST | Не выполнено | API не запущен. Контракт в `docs/api.md` задаёт ожидаемые `spent=95`, `remaining=5`, `baselineScore=52.56`, `score=56.54`. |
| Отказ `choices: []` | Не выполнено | API не запущен. Контракт ожидает HTTP 400 и `error.code=WRONG_CHOICE_COUNT`, без Score. |
| Frontend production build | Пройден | Нативный Windows build в отдельном checkout; не подтверждает образ frontend. |

## Команды для повторения полного изолированного прогона в WSL Ubuntu

Ниже — подготовленный, но **не выполненный** набор команд. Его следует запускать после установки Ubuntu в WSL и включения Docker Desktop integration. Он использует отдельный каталог, project name и порты; он не затрагивает действующее демо.

```bash
git clone https://github.com/BAITC-Hacks/hack-4c816c70-team.git ~/akim-clean-53ee806
cd ~/akim-clean-53ee806
git fetch origin
git checkout --detach 53ee80641b60cae32571db3476a1a791f9b7416a
cp .env.example .env
sed -i \
  -e 's/^API_PORT=.*/API_PORT=18080/' \
  -e 's/^FRONTEND_PORT=.*/FRONTEND_PORT=13000/' \
  -e 's|^FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=http://localhost:13000|' \
  -e 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:18080|' \
  -e 's/^LLM_MODE=.*/LLM_MODE=mock/' \
  -e 's/^OPENAI_API_KEY=.*/OPENAI_API_KEY=/' .env
docker compose -p akim-clean-53ee806 up --build -d --wait
docker compose -p akim-clean-53ee806 ps
curl --fail http://localhost:18080/health
curl --fail http://localhost:18080/swagger/v1/swagger.json
curl --fail-with-body http://localhost:18080/api/simulations/evaluate \
  -H 'Content-Type: application/json' \
  -H 'Accept-Language: ru-RU' \
  --data '{"choices":[{"measureId":"M7","districtId":"nura"},{"measureId":"M8","districtId":"nura"},{"measureId":"M10","districtId":"nura"},{"measureId":"M12"},{"measureId":"M5","districtId":"saryarka"}]}'
curl --include http://localhost:18080/api/simulations/evaluate \
  -H 'Content-Type: application/json' \
  --data '{"choices":[]}'
docker compose -p akim-clean-53ee806 down --volumes --remove-orphans
```

В успешном контрольном POST следует дополнительно подтвердить JSON-поля `spent: 95`, `remaining: 5`, `baselineScore: 52.56`, `score: 56.54`. Второй запрос должен дать HTTP 400 с `error.code: WRONG_CHOICE_COUNT` и не содержать оценку.

## README

Статическая сверка README с `docker-compose.yml`, `.env.example` и `docs/api.md` не выявила функционального противоречия: Compose действительно параметризует `API_PORT`, `FRONTEND_PORT`, `FRONTEND_ORIGIN`, `NEXT_PUBLIC_API_URL`, `LLM_MODE` и пустой `OPENAI_API_KEY`.

Полезное конкретное дополнение для README (не внесено по заданию): после раздела о портах добавить изолированную команду для параллельной проверки — `docker compose -p akim-clean-<sha> --env-file .env.clean up --build -d --wait` — и пример `.env.clean` с согласованными `API_PORT`, `FRONTEND_PORT`, `FRONTEND_ORIGIN` и `NEXT_PUBLIC_API_URL`. Это предотвратит случайный конфликт с действующим Compose project при воспроизведении релиза.

## Передача

Коммит, push и деплой не выполнялись: они назначены архитектору. Для полной приёмки нужен повтор раздела «Команды для повторения…» в WSL Ubuntu с Docker Desktop integration или в иной явно названной среде с Docker Compose v2.
