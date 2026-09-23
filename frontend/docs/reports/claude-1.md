# Отчёт Claude 1 — визуальная система и обзор города

Статус: готово к интеграции. Commit не создавался: по договорённости git ведёт GPT-интегратор. Все файлы ниже пока не отслеживаются git (untracked).

## Изменённые файлы (только своя область)

```text
styles/tokens.css
styles/globals.css
components/ui/AppHeader.tsx, AppHeader.module.css
components/ui/Badge.tsx, Badge.module.css
components/ui/Button.tsx, Button.module.css
components/ui/Metric.tsx, Metric.module.css
components/ui/Panel.tsx, Panel.module.css
components/ui/Skeleton.tsx, Skeleton.module.css
components/ui/cx.ts
components/ui/index.ts
features/city-overview/CityOverview.tsx
features/city-overview/DistrictAtlas.tsx
features/city-overview/DistrictDetails.tsx
features/city-overview/atlas-layout.ts
features/city-overview/district-summary.ts
features/city-overview/format.ts
features/city-overview/city-overview.module.css
features/city-overview/index.ts
docs/reports/claude-1.md
```

`public/city/` не понадобился: атлас — встроенный SVG в компоненте.

## Импорт стилей

В `app/layout.tsx` достаточно одной строки (уже подключено интегратором):

```ts
import "@/styles/globals.css";
```

`globals.css` сам импортирует `tokens.css`. Внутри: reset, типографика, видимый `:focus-visible`, `.visually-hidden`, `.tabular`, `scroll-padding-top` под липкую шапку и отключение движения при `prefers-reduced-motion`.

## Exports

`@/components/ui`:

| Export | Назначение |
| --- | --- |
| `Button` | Все нативные props; по умолчанию `type="button"`; `variant: primary \| secondary \| ghost \| danger`, `size: md \| lg`, `fullWidth`, `busy` (ставит `aria-busy`, блокирует повторное нажатие). Высота ≥ 44 px. |
| `Panel` | `as: section \| div \| article \| aside`, `tone: surface \| sunken \| ink`, `padding: none \| md \| lg`, остальные HTML-атрибуты. |
| `Badge` | `tone: neutral \| accent \| warning \| danger \| inverse`. Цвет всегда сопровождается текстом. |
| `Metric` | `label`, `value` (уже отформатирован), `unit`, `caption`, `size: display \| lg \| md`, `tone: default \| inverse`. Ничего не вычисляет. |
| `Skeleton` | `width`, `height`, `shape: line \| block \| circle`; `aria-hidden`, пульсация отключается при reduced motion. |
| `AppHeader` | Тёмная шапка: `title`, `steps[{id,label,disabled?}]`, `activeStepId`, `onStepSelect?`, `end?`. Шаги — `<ol>` в `<nav>`, у активного `aria-current="step"`. |
| `cx` | Склейка классов. |

Также экспортируются типы props: `ButtonProps`, `PanelProps`, `BadgeProps`, `MetricProps`, `SkeletonProps`, `AppHeaderProps`, `AppHeaderStep` и union-типы вариантов.

`@/features/city-overview`: `CityOverview` с точной сигнатурой `CityOverviewProps` из `lib/contracts/ui.ts`.

## Что показывает CityOverview

- Верхняя полоса: базовый Score (72 px, tabular-nums), бюджет, горизонт и критический порог. Все значения берутся из `scenario`. Если `rules.requiredChoices` отсутствует, число мер не подставляется. При `source === "fixture"` виден бейдж «Демонстрационные данные, не ответ API».
- Атлас «Схема районов»: авторская SVG-мнемосхема с рекой, городскими линиями и пятью областями. Контуры областей повторяют излом реки. В каждой области есть узел, название, доля жителей, мини-профиль из 10 исходных показателей на шкале 0–100 с пунктиром порога и метка «▼ N ниже 40». Цвет заливки означает только выбор. Подпись объясняет, что схема условная и не соответствует географии.
- Подробности выбранного района: доля населения, текстовая сводка критических значений с названиями показателей и все 10 показателей со шкалой, засечкой порога и бейджем «▼ ниже 40». Районный балл выводится только если `district.score` пришёл от backend.
- Пять карточек-кнопок (`aria-pressed`): доля населения, мини-профиль, число показателей ниже порога и самый низкий показатель. Карточки полностью дублируют атлас.
- Кнопка «Перейти к решениям» вызывает `onStartPlanning`.

Выбор района не хранится внутри: атлас, карточки и подробности читают `selectedDistrictId` и вызывают `onSelectDistrict`. Изменение выбора объявляется через скрытый `aria-live="polite"` одной строкой.

## Соблюдение ограничений

- Нет fetch и HTTP (проверено поиском `fetch(` по своим каталогам).
- Нет расчёта Score и районного балла, нет прогнозов. `district-summary.ts` только отбирает и сортирует исходные значения, сравнивает их с порогом (`value < criticalThreshold`, ровно 40 не критично) и считает количество.
- Нет чисел датасета в JSX. `atlas-layout.ts` содержит только геометрию схемы и соответствие известных `id` позициям. Неизвестные id занимают свободные позиции. Районы сверх пяти видны только в карточках, и подпись схемы об этом сообщает.
- Форматирование: `formatNumber` и `formatPercent` из `lib/format/numbers`. Локально добавлены только `formatAmount` (бюджет, горизонт и порог без лишних нулей) и русское склонение.
- `app/`, `package.json`, lockfile, общие типы и чужие features не менялись.

## Доступность

- Атлас — `role="radiogroup"` с одним tab stop (roving tabindex). Стрелки, Home, End, Enter и Space выбирают район и переводят фокус. У фокуса пунктирный контур области.
- Карточки — обычные `<button>` с `aria-pressed` и видимым `focus ring`.
- Иерархия заголовков: `h1` «Город до ваших решений» (как `h1` в состояниях загрузки и ошибки Simulator), затем `h2` района и списка, затем `h3`.
- Состояния ниже порога обозначены знаком ▼ и текстом, не только цветом. Тексты предупреждений и ошибок стоят на светлой подложке.
- Кнопки и шаги шапки высотой ≥ 44 px. Переходы 160–220 мс только для цвета и transform, при reduced motion отключаются.

## Выполненные проверки

| Проверка | Результат |
| --- | --- |
| `npx tsc --noEmit -p .` в `frontend/` | Без ошибок (весь проект, включая текущие модули GPT и Claude 2) |
| `npx eslint components features/city-overview` | 0 ошибок, 0 предупреждений. CSS конфиг eslint не проверяет. |
| `next build` | Успешно, но в изолированной копии (scratchpad) с временной страницей-harness, импортирующей CityOverview и AppHeader. В общем каталоге build не запускал, чтобы не мешать `.next` интегратора. |
| Браузер 1440×900 | Скриншот с выбранной «Нурой»: атлас, подробности и карточки синхронны |
| Браузер 768×1024 | Одна колонка: атлас, затем подробности и карточки в 3 колонки. Горизонтального скролла нет. |
| Браузер 390×844 | `scrollWidth == innerWidth == 390`, горизонтального скролла нет. Длинные названия (`Есильский административный район левого берега`) переносятся в карточках. На схеме они обрезаются по контуру области, полное имя есть в `aria-label` и карточке. |
| Клавиатура | Синтетические keydown: Enter, →, End, →, ↑, клик по карточке. Каждый раз совпадали `aria-checked`, `aria-pressed`, заголовок подробностей и live region, tabindex переходил за выбором. |
| Hydration | На обычной странице ошибок нет. Ошибка появлялась только от временного параметра harness `?long=1`, который читает `window` при загрузке модуля. В код модуля он не входит. |

Скриншоты лежат в scratchpad сессии (`shots/final-1440x900.png`, `final-390x844.png`, `desk2.png`, `tab.png`, `mob2.png`) и переданы пользователю. В репозиторий не добавлялись.

Не проверено: масштаб 200 % в реальном браузере, сквозной сценарий с живым API, скринридер вживую. Встроенный браузер нестабильно снимал скриншоты, поэтому визуальная часть проверена через headless Edge, а мобильная ширина — через iframe 390 px.

## Для интегратора (GPT)

1. `Simulator.tsx` рендерит `CityOverview` без `<main>`: у загрузки и ошибки `<main>` есть, у обзора нет. Предлагаю обернуть активный шаг в `<main>`.
2. У CityOverview свои внешние поля (`max-width: var(--content-max)`, `padding-inline: var(--page-gutter)`). Оборачивающий контейнер не должен добавлять вторые.
3. Кнопку «Повторить загрузку» в `Simulator.tsx` можно заменить на `<Button>` из `@/components/ui`, а заглушку загрузки — на `Skeleton`.
4. В `frontend/AGENTS.md` есть незакоммиченный блок `nextjs-agent-rules`. Его дописывает `next dev`, запущенный в общем каталоге, не я. Решение, коммитить ли его, за владельцем файла (архитектором).

## Оставшиеся вопросы

- При 768–1023 px подробности района стоят под атласом. После выбора на схеме их нужно прокручивать вниз, но live region сообщает выбранный район.
- Районный Score в scenario не приходит. Если backend добавит `district.score`, он появится в подробностях автоматически. Раскраска атласа по баллу намеренно не делалась.
