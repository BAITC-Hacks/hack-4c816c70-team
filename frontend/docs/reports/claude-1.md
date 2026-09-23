# Отчёт Claude 1 — визуальная система и обзор города

## Редизайн: интерфейсы для GPT (подключать сейчас)

Все exports из `@/components/ui` и `@/features/city-overview`. Старые props не менялись, существующие потребители собираются.

### 1. Тема и ранний скрипт в `app/layout.tsx`

```tsx
import { ThemeProvider, themeBootstrapScript } from "@/components/ui";
import "@/styles/globals.css";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning className={manrope.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <ThemeProvider>{/* SimulationProvider, AppShell… */}{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

- `themeBootstrapScript` до первой отрисовки ставит `data-theme` (`light`/`dark`/`paper`), `data-theme-preference` и `data-motion="ready"`. Поэтому нет вспышки неверной темы, а блоки Reveal скрываются только при работающем JS. `suppressHydrationWarning` на `<html>` обязателен, потому что атрибуты ставит скрипт.
- Ключ хранения — `akim-theme`. «Системная» не хранится: запись удаляется, тема берётся из ОС.
- `useTheme()` возвращает `{ preference, theme, setPreference }`, но нужен только если тема понадобится вне ThemeSwitcher.

### 2. Шрифт

`--font-sans` в `styles/tokens.css` уже ссылается на `var(--font-manrope)`. В `next/font/local` задайте `variable: "--font-manrope"` и повесьте `manrope.variable` на `<html>`. Начертания: 400, 600, 800. Без файла шрифта остаётся системный стек, из сети ничего не загружается.

### 3. Шапка

```tsx
<AppHeader
  title="Аким на 5 часов"
  titleHref="/"
  activeStepId={activeId /* "home" | "decisions" | "results" по pathname */}
  steps={[
    { id: "home", label: "Обзор", href: "/" },
    { id: "decisions", label: "Решения", href: "/decisions" },
    { id: "results", label: "Результат", href: "/results",
      disabled: !hasResult, disabledReason: "Появится после оценки решений" },
  ]}
  end={<ThemeSwitcher />}
/>
```

Новые необязательные поля: `steps[].href` (Next Link, `aria-current="page"`), `steps[].disabledReason` (видна при наведении и фокусе), `titleHref`. Старый режим `onStepSelect` работает. Шапка сама становится полупрозрачной с границей при прокрутке, высота не меняется. Индикатор активного пункта скользит.

### 4. Главная `/`

Готовый компонент для тонкого контейнера `HomePage`:

```tsx
import { CityHome } from "@/features/city-overview";

<main className="page-enter">
  <CityHome
    scenario={scenario}                        // ScenarioVM | null
    scenarioStatus={state.scenario.status}     // "loading" | "ready" | "error"
    scenarioError={errorMessage ?? null}
    onRetry={() => void loadScenario()}
    selectedDistrictId={state.selectedDistrictId}
    onSelectDistrict={(id) => dispatch({ type: "select-district", districtId: id })}
    decisionsHref="/decisions"
  />
</main>
```

Внутри: первый экран «Пять решений. Один город.», CTA «Принять решения», бюджет, исходный Score и горизонт из API; «Как это работает»; районы со схемой и показателями; заключительный CTA. Всё с появлением при прокрутке. Вводный текст виден при загрузке и ошибке API, у сценарных данных — скелетон или ошибка с кнопкой повтора. `<main>` и `h1` не дублировать: `h1` внутри CityHome.

### 5. Прочее

- `Button asChild` переносит стиль кнопки на единственного ребёнка: `<Button size="lg" asChild><Link href="/decisions">…</Link></Button>`.
- `Reveal` — `<Reveal as="section" index={0}>…</Reveal>`, один общий IntersectionObserver, срабатывает один раз.
- `.page-enter` — глобальный класс короткого появления корня страницы (220 мс, reduced motion отключает).
- `CityOverview` с прежними props остаётся экспортированным.

---

Статус: готово к интеграции, второй проход по общей странице выполнен (раздел в конце). Сам я commit не создавал: git ведёт GPT-интегратор. Первая версия модулей уже закоммичена им, исправления второго прохода — незакоммиченные изменения.

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

## Проверка общей страницы (второй проход, только исправления)

Как проверял: локальный C# API недоступен (на `localhost:8080` никто не слушает), поэтому общий `localhost:3000` показывает только ошибку загрузки. Полная копия текущего `frontend/` (все модули GPT и Claude 2 + мои) запускалась в scratchpad на `:3108`. Там был временный stub API на `:8097`: сценарий из `ScenarioData.cs` и ответ evaluate по примеру из `docs/api.md`, где у районов кроме Нуры значения не меняются. Для скриншотов шагов в копию `Simulator.tsx` добавлялся переход по `?step=`. Всё это только в копии: в репозиторий stub и эти правки не попадали, общий `:3000` и порт 8080 не затрагивались. Stub не заменяет проверку с настоящим API.

### Исправлено (мои файлы)

| Дефект | Где проявлялся | Исправление |
| --- | --- | --- |
| Значения «Бюджет / Горизонт / Критический порог» на разной высоте, когда подпись «Критический порог» переносится | 768 и 390 px | `heroMetric` — subgrid на три строки (подпись, значение, пояснение), `Metric` внутри — `display: contents` через класс `heroMetricBody`. На мобильном 2 колонки вместо 3. |
| Подписи и метка «▼ N ниже 40» на схеме около 8–10 px | 390 px | Название 29 единиц, метка масштабируется целиком (`scale(1.4)`, текст не вылезает из рамки) |
| Липкая шапка занимает около четверти экрана | Масштаб 200 % (720×450) | `@media (max-height: 520px)`: шапка `position: static`, `scroll-padding-top` уменьшен |
| Нет индикатора фокуса у Button и карточек районов в режиме высокой контрастности Windows (`outline: none` + `box-shadow`) | forced-colors | `outline: 2px solid transparent` + прежний `box-shadow` |
| Контур невыбранных областей схемы 1,75:1 при нужных 3:1 для границ элементов | Все ширины | Обводка `--color-muted` (5,25:1 к фону схемы) |

Файлы: `components/ui/AppHeader.module.css`, `components/ui/Button.module.css`, `features/city-overview/CityOverview.tsx` (только `className` у Metric), `features/city-overview/city-overview.module.css`, `styles/globals.css`.

### Результаты проверок

| Проверка | Результат |
| --- | --- |
| 1440×900, 768×1024, 390×844 | Обзор без горизонтального скролла, скриншоты до и после исправления |
| Масштаб 200 % (720×450, 320×640, около 200 px) | `scrollWidth == innerWidth`, элементов за правым краем нет |
| Контраст текста, все пары токенов | Минимум 5,16:1 (muted на accent-soft), AA пройден |
| Клавиатура в атласе и карточках | Проверено в первом проходе, после исправлений не менялось |
| `npm run typecheck` | Успешно |
| `eslint components features/city-overview` | 0 ошибок, 0 предупреждений |
| `next build` полной копии с исправлениями | Успешно |

Не проверено: реальное включение режима высокой контрастности Windows (исправление по известному поведению forced-colors), живой скринридер, `prefers-reduced-motion` в браузере (проверены только CSS-правила), сценарий с настоящим API.

### Найдено вне моей области (не исправлял)

| Владелец | Проблема |
| --- | --- |
| GPT, `features/simulator/Simulator.tsx` | Ни на одном шаге с данными нет `<main>`. После «Перейти к решениям» и после оценки фокус остаётся на `body`. На шаге «Решения» нет `h1` (Planner начинает с `h2`). Совпадает с P2 из отчёта архитектора. |
| Claude 2 или GPT (по договорённости) | У корня Planner нулевые боковые поля (`padding: 0 0 88px`): на 1440 и 390 контент прижат к краям, «К обзору города» касается правого края. Нужны `max-width: var(--content-max)`, `margin-inline: auto`, `padding-inline: var(--page-gutter)`, как в обзоре. |
| GPT, `features/results/` | Поля и ширина отличаются от обзора (24 px, без `max-width`). Кнопки свои, не `Button`. Районное сравнение — текст «50,00 → 52,96» без парных полос 0–100, которые описаны в `design.md`. |
| GPT, `Simulator.tsx` | Кнопка «Повторить загрузку» — сырой `<button>`, можно взять `Button`. |

## Редизайн: результат и проверки

Готово (мои файлы): три темы в `styles/tokens.css` (имена токенов прежние), Manrope через `--font-manrope`; `ThemeProvider`, `ThemeSwitcher`, `Reveal`, `themeBootstrapScript`; `AppHeader` с `href`, `disabledReason`, `titleHref`, скользящим индикатором и фоном при прокрутке; `Button asChild`; `CityHome` (главная) и `DistrictExplorer`. GPT уже смонтировал всё это в `app/layout.tsx`, `AppShell` и `HomePage`.

| Проверка | Результат |
| --- | --- |
| `tsc --noEmit` для всего проекта, `eslint components features/city-overview` | Успешно |
| `next build` изолированной копии главной | Успешно |
| Общий `:3000` с живым API | Главная загружает 52,56 / 100 / 8, три темы переключаются, горизонтального скролла нет на 1440 и 390 |
| Появление при прокрутке (CDP, headless Edge) | Блоки ниже экрана скрыты и появляются при прокрутке; шапка получает фон после прокрутки и снимает его наверху |
| Без JS | Все блоки видимы, тема по системе |
| `prefers-reduced-motion` | Без сдвигов и анимации эскиза, все блоки сразу видимы |
| 390, 320, 720×450 (масштаб 200 %), 768 | Горизонтального переполнения нет (подсказка у «Результата» исправлена) |
| Контраст всех трёх тем | Текст ≥ 5,06:1, границы ≥ 3:1 |

Не проверено: переходы между страницами и Back/Forward в общей сборке (прервано по времени), живой скринридер. На 320 px шапка в три строки (155 px). Шрифт Manrope ещё не подключён — сейчас системный стек.
