# Аким на 5 часов

AI-симулятор городских решений для спецтрека Astana Innovations. Команда распределяет бюджет 100 условных единиц между пятью мероприятиями и видит изменение Astana Quality of Life Score.

## Структура

| Путь | Назначение | Ответственный |
| --- | --- | --- |
| `backend/CitySimulator.Api/` | C# API, правила выбора, расчёт Score, AI-объяснение, Swagger | Тамерлан |
| `frontend/` | Next.js интерфейс выбора мер и просмотра результата | Фронтенд-разработчик |
| `docs/api.md` | Контракт между фронтендом и API | Тамерлан, согласование с фронтендом |
| `docs/team.md` | Границы работы и контрольные точки | Вся команда |
| `docker-compose.yml`, `.env.example`, `README.md`, `THIRD_PARTY.md` | Запуск, окружение и сдача | Участник по серверу и интеграции |

Сейчас в репозитории созданы стартовые проекты. Полный сценарий и запуск через Docker будут добавлены в ходе разработки; текущие команды ниже запускают каждый сервис отдельно.

Исходные материалы команды: [`docs/reference/challenge-task.docx`](docs/reference/challenge-task.docx) и [`docs/reference/district-dataset.docx`](docs/reference/district-dataset.docx).

## Локальный запуск основы

В WSL Ubuntu:

```bash
cd backend/CitySimulator.Api
dotnet run --urls http://localhost:8080
```

Проверка API: `http://localhost:8080/health`; Swagger: `http://localhost:8080/swagger`.

В отдельном терминале WSL:

```bash
cd frontend
npm ci
npm run dev
```

Next.js: `http://localhost:3000`.

## Работа команды

До изменения формата API обновляйте `docs/api.md` и сообщайте фронтенду. Основной сценарий и правила расчёта описаны в датасете задачи. Коммиты и push промежуточного результата нужны не реже раза в 30 минут.
