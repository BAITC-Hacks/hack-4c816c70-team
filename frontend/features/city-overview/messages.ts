import type { Locale } from "@/lib/i18n";

/** Русское склонение по Intl.PluralRules: one / few / many. */
const ruRules = new Intl.PluralRules("ru-RU");
function ru(count: number, one: string, few: string, many: string): string {
  const category = ruRules.select(count);
  return category === "one" ? one : category === "few" ? few : many;
}
const en = (count: number, one: string, other: string) => (count === 1 ? one : other);

export interface CityMessages {
  // Первый экран
  readonly heroLine1: string;
  readonly heroLine2: string;
  readonly heroLead: string;
  readonly ctaDecide: string;
  readonly howLink: string;
  readonly factScore: string;
  readonly factBudget: string;
  readonly factBudgetUnit: string;
  readonly factHorizon: string;
  readonly quarters: (count: number) => string;
  readonly fixtureBadge: string;
  readonly errorTitle: string;
  readonly errorFallback: string;
  readonly retry: string;
  readonly loading: string;
  // Как это работает
  readonly howTitle: string;
  readonly step1Title: string;
  readonly step1Text: (threshold: string | null) => string;
  readonly step2Title: string;
  readonly step2Text: (required: number | null, maxPerCategory: number | null) => string;
  readonly step3Title: string;
  readonly step3Text: string;
  // Районы
  readonly districtsTitle: string;
  readonly districtsLead: string;
  readonly districtsPlaceholder: string;
  readonly finalTitle: string;
  readonly finalText: (selectedName: string | null) => string;
  // 3D и схема
  readonly sceneCaption: string;
  readonly atlasLabel: string;
  readonly atlasCaption: (indicatorCount: number, threshold: string) => string;
  readonly atlasHidden: (count: number) => string;
  readonly plateShare: (share: string) => string;
  readonly plateLabel: (name: string, share: string, critical: number, threshold: string) => string;
  readonly platePill: (critical: number, threshold: string) => string;
  // Карточки и подробности
  readonly allDistricts: string;
  readonly selected: string;
  readonly cardShare: (share: string) => string;
  readonly criticalBadge: (count: number, threshold: string) => string;
  readonly noCritical: (threshold: string) => string;
  readonly weakest: (name: string, value: string) => string;
  readonly liveSelected: (name: string, critical: number, threshold: string) => string;
  readonly detailsEmptyTitle: string;
  readonly detailsEmptyText: (indicatorCount: number, threshold: string) => string;
  readonly populationShare: string;
  readonly districtScore: string;
  readonly criticalNote: (count: number, threshold: string, names: string) => string;
  readonly noneCritical: (threshold: string) => string;
  readonly readingsTitle: string;
  readonly belowFlag: (threshold: string) => string;
}

const ruMessages: CityMessages = {
  heroLine1: "Пять решений.",
  heroLine2: "Один город.",
  heroLead:
    "Вы — аким на пять часов. Выберите меры для районов в пределах бюджета: сервер рассчитает, как изменится качество жизни, и объяснит, почему.",
  ctaDecide: "Принять решения",
  howLink: "Как это работает",
  factScore: "Исходный Score",
  factBudget: "Бюджет",
  factBudgetUnit: "ед.",
  factHorizon: "Горизонт",
  quarters: (n) => ru(n, "квартал", "квартала", "кварталов"),
  fixtureBadge: "Демонстрационные данные, не ответ API",
  errorTitle: "Данные сценария недоступны.",
  errorFallback: "Не удалось получить бюджет, Score и районы.",
  retry: "Повторить загрузку",
  loading: "Загружаем данные сценария…",
  howTitle: "Как это работает",
  step1Title: "Изучите районы",
  step1Text: (t) =>
    t
      ? `Посмотрите исходные показатели и найдите значения ниже критического порога ${t}.`
      : "Посмотрите исходные показатели и найдите значения ниже критического порога.",
  step2Title: "Соберите план",
  step2Text: (n, max) =>
    n !== null && max !== null
      ? `Ровно ${n} ${ru(n, "мера", "меры", "мер")} в пределах бюджета, не больше ${max} по одному направлению. Конфликтующие пары видны сразу.`
      : "Выберите меры в пределах бюджета и назначьте районы. Конфликтующие пары видны сразу.",
  step3Title: "Получите оценку",
  step3Text: "Сервер проверит набор, рассчитает Score и изменения по районам и объяснит результат.",
  districtsTitle: "Районы до решений",
  districtsLead:
    "Исходные показатели на шкале 0–100. Выбранный район будет предложен для районных мер — назначение можно изменить в каждой карточке.",
  districtsPlaceholder: "Схема и показатели районов появятся после загрузки сценария.",
  finalTitle: "Готовы принять решения?",
  finalText: (name) =>
    `${name ? `Район «${name}» уже предложен для районных мер.` : "Район для каждой меры выбирается прямо в её карточке."} Черновик плана сохранится, пока вы переходите между страницами.`,
  sceneCaption: "Схематичная визуализация города: расположение и высота зданий условные.",
  atlasLabel: "Схема районов",
  atlasCaption: (n, t) =>
    `Условная схема: в данных нет географических границ, форма и положение областей не соответствуют карте. Столбики — ${n} ${ru(n, "исходный показатель", "исходных показателя", "исходных показателей")} района на шкале 0–100, пунктир — критический порог ${t}; красным отмечены значения ниже порога.`,
  atlasHidden: (n) => `Ещё ${n} ${ru(n, "район", "района", "районов")} — только в списке ниже.`,
  plateShare: (s) => `${s} жителей`,
  plateLabel: (name, s, c, t) =>
    `${name}: ${s} жителей, ${c > 0 ? `${c} ${ru(c, "показатель", "показателя", "показателей")} ниже ${t}` : `нет показателей ниже ${t}`}`,
  platePill: (c, t) => `▼ ${c} ниже ${t}`,
  allDistricts: "Все районы",
  selected: "Выбран",
  cardShare: (s) => `${s} жителей города`,
  criticalBadge: (c, t) => `${c} ${ru(c, "показатель", "показателя", "показателей")} ниже ${t}`,
  noCritical: (t) => `Нет значений ниже ${t}`,
  weakest: (name, v) => `Самый низкий: ${name}, ${v}`,
  liveSelected: (name, c, t) =>
    `Выбран район ${name}: ${c > 0 ? `${c} ${ru(c, "показатель", "показателя", "показателей")} ниже ${t}` : `нет показателей ниже ${t}`}.`,
  detailsEmptyTitle: "Район не выбран",
  detailsEmptyText: (n, t) =>
    `Выберите район на схеме или в списке ниже. Здесь появятся его ${n} ${ru(n, "исходный показатель", "исходных показателя", "исходных показателей")} и отметки о значениях ниже порога ${t}.`,
  populationShare: "Доля населения",
  districtScore: "Балл района",
  criticalNote: (c, t, names) =>
    `${c} ${ru(c, "показатель", "показателя", "показателей")} ниже критического порога ${t}: ${names}.`,
  noneCritical: (t) => `Ни один показатель не ниже критического порога ${t}.`,
  readingsTitle: "Исходные показатели, шкала 0–100",
  belowFlag: (t) => `ниже ${t}`,
};

const kkMessages: CityMessages = {
  heroLine1: "Бес шешім.",
  heroLine2: "Бір қала.",
  heroLead:
    "Сіз — бес сағаттық әкімсіз. Бюджет шегінде аудандарға шаралар таңдаңыз: сервер тұрмыс сапасы қалай өзгеретінін есептеп, себебін түсіндіреді.",
  ctaDecide: "Шешім қабылдау",
  howLink: "Бұл қалай жұмыс істейді",
  factScore: "Бастапқы Score",
  factBudget: "Бюджет",
  factBudgetUnit: "бірлік",
  factHorizon: "Көкжиек",
  quarters: () => "тоқсан",
  fixtureBadge: "Демонстрациялық деректер, API жауабы емес",
  errorTitle: "Сценарий деректері қолжетімсіз.",
  errorFallback: "Бюджетті, Score мен аудандарды алу мүмкін болмады.",
  retry: "Қайта жүктеу",
  loading: "Сценарий деректері жүктелуде…",
  howTitle: "Бұл қалай жұмыс істейді",
  step1Title: "Аудандарды зерттеңіз",
  step1Text: (t) =>
    t
      ? `Бастапқы көрсеткіштерді қарап, ${t} сындық шегінен төмен мәндерді табыңыз.`
      : "Бастапқы көрсеткіштерді қарап, сындық шектен төмен мәндерді табыңыз.",
  step2Title: "Жоспар құрыңыз",
  step2Text: (n, max) =>
    n !== null && max !== null
      ? `Бюджет шегінде дәл ${n} шара, бір бағыт бойынша ${max} шарадан аспауы керек. Қайшы келетін жұптар бірден көрінеді.`
      : "Бюджет шегінде шаралар таңдап, аудандарды белгілеңіз. Қайшы келетін жұптар бірден көрінеді.",
  step3Title: "Бағасын алыңыз",
  step3Text: "Сервер жиынтықты тексеріп, Score мен аудандардағы өзгерістерді есептейді және нәтижені түсіндіреді.",
  districtsTitle: "Шешімге дейінгі аудандар",
  districtsLead:
    "Бастапқы көрсеткіштер 0–100 шкаласында. Таңдалған аудан аудандық шараларға ұсынылады — оны әр карточкада өзгертуге болады.",
  districtsPlaceholder: "Аудандар сызбасы мен көрсеткіштері сценарий жүктелгеннен кейін шығады.",
  finalTitle: "Шешім қабылдауға дайынсыз ба?",
  finalText: (name) =>
    `${name ? `«${name}» ауданы аудандық шараларға ұсынылды.` : "Әр шараның ауданы оның карточкасында таңдалады."} Беттер арасында ауысқанда жоспардың жобасы сақталады.`,
  sceneCaption: "Қаланың сызбалық бейнесі: нысандардың орны мен ғимараттардың биіктігі шартты.",
  atlasLabel: "Аудандар сызбасы",
  atlasCaption: (n, t) =>
    `Шартты сызба: деректерде географиялық шекара жоқ, аймақтардың пішіні мен орны картаға сәйкес келмейді. Бағандар — ауданның 0–100 шкаласындағы ${n} бастапқы көрсеткіші, пунктир — ${t} сындық шегі; шектен төмен мәндер қызылмен белгіленген.`,
  atlasHidden: (n) => `Тағы ${n} аудан тек төмендегі тізімде.`,
  plateShare: (s) => `тұрғындардың ${s}`,
  plateLabel: (name, s, c, t) =>
    `${name}: тұрғындардың ${s}, ${c > 0 ? `${c} көрсеткіш ${t} шегінен төмен` : `${t} шегінен төмен көрсеткіш жоқ`}`,
  platePill: (c) => `▼ ${c} шектен төмен`,
  allDistricts: "Барлық аудандар",
  selected: "Таңдалды",
  cardShare: (s) => `қала тұрғындарының ${s}`,
  criticalBadge: (c, t) => `${c} көрсеткіш ${t} шегінен төмен`,
  noCritical: (t) => `${t} шегінен төмен мән жоқ`,
  weakest: (name, v) => `Ең төменгісі: ${name}, ${v}`,
  liveSelected: (name, c, t) =>
    `${name} ауданы таңдалды: ${c > 0 ? `${c} көрсеткіш ${t} шегінен төмен` : `${t} шегінен төмен көрсеткіш жоқ`}.`,
  detailsEmptyTitle: "Аудан таңдалмаған",
  detailsEmptyText: (n, t) =>
    `Сызбадан немесе төмендегі тізімнен аудан таңдаңыз. Мұнда оның ${n} бастапқы көрсеткіші мен ${t} шегінен төмен мәндер белгісі шығады.`,
  populationShare: "Халық үлесі",
  districtScore: "Аудан балы",
  criticalNote: (c, t, names) => `${c} көрсеткіш ${t} сындық шегінен төмен: ${names}.`,
  noneCritical: (t) => `Бірде-бір көрсеткіш ${t} сындық шегінен төмен емес.`,
  readingsTitle: "Бастапқы көрсеткіштер, 0–100 шкаласы",
  belowFlag: (t) => `${t} шегінен төмен`,
};

const enMessages: CityMessages = {
  heroLine1: "Five decisions.",
  heroLine2: "One city.",
  heroLead:
    "You are the akim for five hours. Choose measures for the districts within the budget: the server calculates how quality of life changes and explains why.",
  ctaDecide: "Make decisions",
  howLink: "How it works",
  factScore: "Baseline score",
  factBudget: "Budget",
  factBudgetUnit: "units",
  factHorizon: "Horizon",
  quarters: (n) => en(n, "quarter", "quarters"),
  fixtureBadge: "Demo data, not an API response",
  errorTitle: "Scenario data is unavailable.",
  errorFallback: "Could not load the budget, score and districts.",
  retry: "Try again",
  loading: "Loading scenario data…",
  howTitle: "How it works",
  step1Title: "Explore the districts",
  step1Text: (t) =>
    t
      ? `Review the baseline indicators and find values below the critical threshold of ${t}.`
      : "Review the baseline indicators and find values below the critical threshold.",
  step2Title: "Build a plan",
  step2Text: (n, max) =>
    n !== null && max !== null
      ? `Exactly ${n} ${en(n, "measure", "measures")} within the budget, no more than ${max} per area. Conflicting pairs are flagged right away.`
      : "Choose measures within the budget and assign districts. Conflicting pairs are flagged right away.",
  step3Title: "Get the assessment",
  step3Text: "The server checks your set, calculates the score and district changes, and explains the result.",
  districtsTitle: "Districts before your decisions",
  districtsLead:
    "Baseline indicators on a 0–100 scale. The selected district is suggested for district measures, and you can change it on each card.",
  districtsPlaceholder: "The district map and indicators will appear once the scenario loads.",
  finalTitle: "Ready to decide?",
  finalText: (name) =>
    `${name ? `${name} is already suggested for district measures.` : "Each measure's district is chosen on its own card."} Your draft plan is kept while you move between pages.`,
  sceneCaption: "Schematic city view: building positions and heights are illustrative.",
  atlasLabel: "District map",
  atlasCaption: (n, t) =>
    `Illustrative map: the data has no geographic boundaries, so shapes and positions do not match a real map. Bars show the district's ${n} baseline indicators on a 0–100 scale, the dashed line marks the critical threshold of ${t}, and values below it are red.`,
  atlasHidden: (n) => `${n} more ${en(n, "district is", "districts are")} listed below only.`,
  plateShare: (s) => `${s} of residents`,
  plateLabel: (name, s, c, t) =>
    `${name}: ${s} of residents, ${c > 0 ? `${c} ${en(c, "indicator", "indicators")} below ${t}` : `no indicators below ${t}`}`,
  platePill: (c, t) => `▼ ${c} below ${t}`,
  allDistricts: "All districts",
  selected: "Selected",
  cardShare: (s) => `${s} of city residents`,
  criticalBadge: (c, t) => `${c} ${en(c, "indicator", "indicators")} below ${t}`,
  noCritical: (t) => `No values below ${t}`,
  weakest: (name, v) => `Lowest: ${name}, ${v}`,
  liveSelected: (name, c, t) =>
    `${name} selected: ${c > 0 ? `${c} ${en(c, "indicator", "indicators")} below ${t}` : `no indicators below ${t}`}.`,
  detailsEmptyTitle: "No district selected",
  detailsEmptyText: (n, t) =>
    `Pick a district on the map or in the list below to see its ${n} baseline indicators and any values below the ${t} threshold.`,
  populationShare: "Population share",
  districtScore: "District score",
  criticalNote: (c, t, names) =>
    `${c} ${en(c, "indicator is", "indicators are")} below the critical threshold of ${t}: ${names}.`,
  noneCritical: (t) => `No indicator is below the critical threshold of ${t}.`,
  readingsTitle: "Baseline indicators, 0–100 scale",
  belowFlag: (t) => `below ${t}`,
};

export const cityMessages: Readonly<Record<Locale, CityMessages>> = {
  ru: ruMessages,
  kk: kkMessages,
  en: enMessages,
};
