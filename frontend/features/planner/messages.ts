/**
 * Словарь Planner (ru / kk / en). Названия мер, районов, направлений, показателей
 * и причины несовместимостей сюда не входят: их переводит общий каталог GPT по ID,
 * а функции ниже получают уже локализованные названия и отформатированные числа.
 * Все функции имеют одинаковые сигнатуры во всех языках.
 */

import type { Locale } from "../../lib/i18n/catalog";

/** Число, уже отформатированное по intlLocale. */
type Num = string;

export interface PlannerCopy {
  readonly title: (required: number) => string;
  readonly titleWithoutRules: string;
  readonly lede: (budget: Num, quarters: Num) => string;
  readonly ledeLimit: (max: number) => string;
  readonly back: string;
  readonly rulesMissing: string;
  readonly liveEvaluating: string;
  readonly liveStatus: (count: number, required: number | null, remaining: Num) => string;
  readonly builderLegend: string;
  readonly filtersLabel: string;
  readonly filterAll: string;
  readonly preferredDistrict: (district: string) => string;
  readonly emptyCategory: string;

  readonly unit: string;
  readonly factCategory: string;
  readonly factScope: string;
  readonly scopeCity: string;
  readonly scopeDistrict: string;
  readonly factLag: string;
  readonly lag: (quarters: Num, raw: number) => string;
  readonly effectsLabel: string;
  readonly noEffects: string;
  readonly details: string;
  readonly hideDetails: string;
  readonly fullEffectNote: string;
  readonly cardSynergy: (partners: string) => string;
  readonly districtLegend: string;
  readonly assignedDistrictLegend: string;
  readonly chooseDistrictWarning: string;
  readonly inPlan: string;
  readonly remove: string;
  readonly addToPlan: string;

  readonly conflictInDistrict: (district: string, text: string) => string;
  readonly blockedInDistrict: (district: string, text: string) => string;
  readonly conflictText: (partner: string, reason: string) => string;
  readonly notSelected: string;
  readonly unknownDistrictOption: (id: string) => string;
  readonly districtOptionConflict: (district: string) => string;

  readonly plan: string;
  readonly ofTotal: (total: number | null) => string;
  readonly collapse: string;
  readonly budgetLabel: string;
  readonly spent: string;
  readonly ofBudget: (budget: Num) => string;
  readonly remaining: string;
  readonly overBudget: string;
  readonly estimateNote: string;
  readonly measureNotFound: (id: string) => string;
  readonly removeFromPlan: (id: string) => string;
  readonly districtShort: string;
  readonly noDistrictWarning: string;
  readonly wholeCity: string;
  readonly emptySlot: string;
  readonly traySynergy: (pairs: readonly (readonly [string, string])[]) => string;
  readonly blockersTitle: string;
  readonly serverResponse: string;
  readonly planSaved: string;
  readonly evaluate: string;
  readonly evaluating: string;
  readonly evaluateShort: string;
  readonly evaluatingShort: string;
  readonly mobileRemaining: (remaining: Num) => string;
  readonly mobileOver: (over: Num) => string;
  readonly ribbonAllocated: (spent: Num, budget: Num) => string;
  readonly ribbonOver: (spent: Num, budget: Num) => string;

  /** Причины из validateDraft (по code и исходным данным, не по русскому message). */
  readonly issue: {
    readonly rulesUnavailable: string;
    readonly tooFew: (count: number, required: number) => string;
    readonly tooMany: (count: number, required: number) => string;
    readonly duplicate: (id: string, times: number) => string;
    readonly unknownMeasure: (id: string) => string;
    readonly districtForCity: (id: string) => string;
    readonly districtRequired: (id: string) => string;
    readonly invalidDistrict: (id: string, district: string) => string;
    readonly budgetExceeded: (spent: Num, budget: Num, over: Num) => string;
    readonly categoryLimit: (category: string, count: number, max: number) => string;
    readonly incompatibleGlobal: (a: string, b: string, reason: string) => string;
    readonly incompatibleDistrict: (a: string, b: string, district: string, reason: string) => string;
  };

  /** Причины, по которым нельзя добавить меру (getAddAvailability). */
  readonly block: {
    readonly rulesUnavailable: string;
    readonly unknownMeasure: (id: string) => string;
    readonly planFull: (count: number, required: number) => string;
    readonly categoryLimit: (category: string, count: number, ids: string) => string;
    readonly incompatible: (partner: string, reason: string) => string;
    readonly budget: (shortfall: Num) => string;
    readonly districtConflict: (district: string, partner: string, reason: string) => string;
    readonly unknownDistrict: (id: string) => string;
    readonly allDistricts: string;
  };
}

const ru: PlannerCopy = {
  title: (required) => `Выберите ${required} решений`,
  titleWithoutRules: "Каталог решений",
  lede: (budget, quarters) => `Бюджет ${budget} ед. на ${quarters} кварталов.`,
  ledeLimit: (max) => `Не больше ${max} мер одного направления.`,
  back: "К обзору города",
  rulesMissing:
    "Правила выбора ещё не получены от сервера. Каталог можно просмотреть, но добавить меры и оценить план нельзя.",
  liveEvaluating: "Оцениваем решения, изменения временно заблокированы.",
  liveStatus: (count, required, remaining) =>
    `Выбрано ${count} из ${required ?? "—"}. Предварительный остаток ${remaining} ед.`,
  builderLegend: "Конструктор решений",
  filtersLabel: "Направления",
  filterAll: "Все",
  preferredDistrict: (district) =>
    `Район ${district} из обзора предложен для новых мер. Его можно сменить в карточке.`,
  emptyCategory: "В этом направлении в каталоге нет мер. Выберите другое направление.",

  unit: "ед.",
  factCategory: "Направление",
  factScope: "Охват",
  scopeCity: "Весь город",
  scopeDistrict: "Один район",
  factLag: "Лаг",
  lag: (quarters) => `${quarters} кв.`,
  effectsLabel: "Эффекты из каталога",
  noEffects: "Эффекты в каталоге не указаны.",
  details: "Подробнее",
  hideDetails: "Скрыть",
  fullEffectNote: "Полный эффект из каталога, без учёта лага",
  cardSynergy: (partners) =>
    `Возможная синергия с ${partners}. Сработает ли она, покажет оценка сервера.`,
  districtLegend: "Район",
  assignedDistrictLegend: "Назначенный район",
  chooseDistrictWarning: "Выберите район: без него оценка недоступна.",
  inPlan: "В плане",
  remove: "Убрать",
  addToPlan: "Добавить в план",

  conflictInDistrict: (district, text) => `В районе ${district} конфликт: ${text}`,
  blockedInDistrict: (district, text) => `В районе ${district} нельзя: ${text}`,
  conflictText: (partner, reason) => `уже выбрана ${partner}. ${reason}`,
  notSelected: "Не выбран",
  unknownDistrictOption: (id) => `Неизвестный район «${id}»`,
  districtOptionConflict: (district) => `${district} — конфликт`,

  plan: "План",
  ofTotal: (total) => `из ${total ?? "—"}`,
  collapse: "Свернуть",
  budgetLabel: "Предварительный бюджет",
  spent: "Потрачено",
  ofBudget: (budget) => `из ${budget}`,
  remaining: "Остаток",
  overBudget: "Превышение",
  estimateNote: "Предварительно, по ценам каталога. Итог считает сервер.",
  measureNotFound: (id) => `Мера «${id}» не найдена`,
  removeFromPlan: (id) => `Убрать ${id} из плана`,
  districtShort: "Район",
  noDistrictWarning: "Район не выбран: оценка недоступна.",
  wholeCity: "Весь город",
  emptySlot: "Свободное место",
  traySynergy: (pairs) =>
    `Возможная синергия: ${pairs.map(([a, b]) => `${a} и ${b}`).join(", ")}. Сработает ли она, покажет оценка.`,
  blockersTitle: "Что мешает оценке",
  serverResponse: "Ответ сервера",
  planSaved: "План сохранён. Проверьте его и оцените снова.",
  evaluate: "Оценить решения",
  evaluating: "Оцениваем решения…",
  evaluateShort: "Оценить",
  evaluatingShort: "Оцениваем…",
  mobileRemaining: (remaining) => `остаток ${remaining} ед.`,
  mobileOver: (over) => `превышение ${over} ед.`,
  ribbonAllocated: (spent, budget) => `Распределено ${spent} из ${budget} ед.`,
  ribbonOver: (spent, budget) => `Бюджет превышен: ${spent} из ${budget} ед.`,

  issue: {
    rulesUnavailable: "Правила выбора ещё не получены от сервера: оценка недоступна.",
    tooFew: (count, required) => `Выбрано ${count} из ${required} мер: добавьте ещё ${required - count}.`,
    tooMany: (count, required) => `Выбрано ${count} мер, а нужно ровно ${required}: уберите ${count - required}.`,
    duplicate: (id, times) =>
      `${id} выбрана ${times} раза: каждую меру можно выбрать только один раз, даже в разных районах.`,
    unknownMeasure: (id) => `Меры «${id}» нет в каталоге.`,
    districtForCity: (id) => `${id} действует на весь город: район ей не назначается.`,
    districtRequired: (id) => `Для ${id} не выбран район.`,
    invalidDistrict: (id, district) => `Для ${id} указан неизвестный район «${district}».`,
    budgetExceeded: (spent, budget, over) =>
      `Недостаточно бюджета: набор стоит ${spent} ед. при бюджете ${budget}, не хватает ${over} ед.`,
    categoryLimit: (category, count, max) =>
      `По направлению «${category}» выбрано ${count} меры, допускается не больше ${max}.`,
    incompatibleGlobal: (a, b, reason) => `${a} и ${b} нельзя выбрать вместе ни в каком районе: ${reason}`,
    incompatibleDistrict: (a, b, district, reason) => `${a} и ${b} в районе «${district}»: ${reason}`,
  },

  block: {
    rulesUnavailable: "Правила выбора ещё не получены от сервера.",
    unknownMeasure: (id) => `Меры «${id}» нет в каталоге.`,
    planFull: (count, required) => `План заполнен: ${count} из ${required}. Уберите меру, чтобы добавить эту.`,
    categoryLimit: (category, count, ids) => `По направлению «${category}» уже выбрано ${count} меры (${ids}).`,
    incompatible: (partner, reason) => `Нельзя вместе с ${partner}: ${reason}`,
    budget: (shortfall) => `Недостаточно бюджета: не хватает ${shortfall} ед.`,
    districtConflict: (district, partner, reason) =>
      `В районе «${district}» уже выбрана ${partner}. ${reason} Выберите другой район.`,
    unknownDistrict: (id) => `Неизвестный район «${id}»: выберите район из списка.`,
    allDistricts: "Во всех районах есть конфликт с уже выбранными мерами.",
  },
};

/*
 * Казахский: после чисел и ID меры не ставим падежные окончания (они зависят от
 * сингармонизма и чтения «M1»), поэтому «/», «және» и конструкции с «шарасы».
 */
const kk: PlannerCopy = {
  title: (required) => `${required} шешім таңдаңыз`,
  titleWithoutRules: "Шешімдер каталогы",
  lede: (budget, quarters) => `Бюджет — ${budget} бірлік, мерзімі — ${quarters} тоқсан.`,
  ledeLimit: (max) => `Бір бағыт бойынша ең көбі ${max} шара.`,
  back: "Қала шолуына оралу",
  rulesMissing:
    "Таңдау ережелері серверден әлі алынған жоқ. Каталогты қарауға болады, бірақ шара қосу және жоспарды бағалау мүмкін емес.",
  liveEvaluating: "Шешімдер бағалануда, өзгерту уақытша бұғатталған.",
  liveStatus: (count, required, remaining) =>
    `Таңдалғаны: ${count} / ${required ?? "—"}. Алдын ала қалдық: ${remaining} бірлік.`,
  builderLegend: "Шешімдер конструкторы",
  filtersLabel: "Бағыттар",
  filterAll: "Барлығы",
  preferredDistrict: (district) =>
    `Шолуда таңдалған аудан (${district}) жаңа шаралар үшін ұсынылды. Оны карточкада өзгертуге болады.`,
  emptyCategory: "Бұл бағыт бойынша каталогта шара жоқ. Басқа бағытты таңдаңыз.",

  unit: "бірл.",
  factCategory: "Бағыт",
  factScope: "Қамту",
  scopeCity: "Бүкіл қала",
  scopeDistrict: "Бір аудан",
  factLag: "Кідіріс",
  lag: (quarters) => `${quarters} тоқсан`,
  effectsLabel: "Каталогтағы әсерлер",
  noEffects: "Каталогта әсерлер көрсетілмеген.",
  details: "Толығырақ",
  hideDetails: "Жасыру",
  fullEffectNote: "Каталогтағы толық әсер, кідіріс ескерілмеген",
  cardSynergy: (partners) =>
    `Ықтимал синергия: ${partners}. Оның іске асатынын сервер бағалауы көрсетеді.`,
  districtLegend: "Аудан",
  assignedDistrictLegend: "Тағайындалған аудан",
  chooseDistrictWarning: "Ауданды таңдаңыз: онсыз бағалау мүмкін емес.",
  inPlan: "Жоспарда",
  remove: "Алып тастау",
  addToPlan: "Жоспарға қосу",

  conflictInDistrict: (district, text) => `${district} ауданында қайшылық бар: ${text}`,
  blockedInDistrict: (district, text) => `${district} ауданына болмайды: ${text}`,
  conflictText: (partner, reason) => `${partner} шарасы таңдалып қойған. ${reason}`,
  notSelected: "Таңдалмаған",
  unknownDistrictOption: (id) => `Белгісіз аудан: «${id}»`,
  districtOptionConflict: (district) => `${district} — қайшылық`,

  plan: "Жоспар",
  ofTotal: (total) => `/ ${total ?? "—"}`,
  collapse: "Жию",
  budgetLabel: "Алдын ала бюджет",
  spent: "Жұмсалды",
  ofBudget: (budget) => `/ ${budget}`,
  remaining: "Қалдық",
  overBudget: "Асып кетті",
  estimateNote: "Алдын ала, каталог бағасы бойынша. Қорытындыны сервер есептейді.",
  measureNotFound: (id) => `«${id}» шарасы табылмады`,
  removeFromPlan: (id) => `${id} шарасын жоспардан алып тастау`,
  districtShort: "Аудан",
  noDistrictWarning: "Аудан таңдалмаған: бағалау мүмкін емес.",
  wholeCity: "Бүкіл қала",
  emptySlot: "Бос орын",
  traySynergy: (pairs) =>
    `Ықтимал синергия: ${pairs.map(([a, b]) => `${a} және ${b}`).join(", ")}. Іске асатынын бағалау көрсетеді.`,
  blockersTitle: "Бағалауға не кедергі",
  serverResponse: "Сервер жауабы",
  planSaved: "Жоспар сақталды. Оны тексеріп, қайта бағалаңыз.",
  evaluate: "Шешімдерді бағалау",
  evaluating: "Шешімдер бағалануда…",
  evaluateShort: "Бағалау",
  evaluatingShort: "Бағалануда…",
  mobileRemaining: (remaining) => `қалдық: ${remaining} бірл.`,
  mobileOver: (over) => `асып кетті: ${over} бірл.`,
  ribbonAllocated: (spent, budget) => `Бөлінгені: ${spent} / ${budget} бірлік.`,
  ribbonOver: (spent, budget) => `Бюджеттен асып кетті: ${spent} / ${budget} бірлік.`,

  issue: {
    rulesUnavailable: "Таңдау ережелері серверден әлі алынған жоқ: бағалау мүмкін емес.",
    tooFew: (count, required) =>
      `Таңдалғаны: ${count} / ${required} шара. Тағы ${required - count} шара қосыңыз.`,
    tooMany: (count, required) =>
      `${count} шара таңдалды, ал дәл ${required} керек. ${count - required} шараны алып тастаңыз.`,
    duplicate: (id, times) =>
      `${id} шарасы ${times} рет таңдалды: әр шараны тек бір рет таңдауға болады, тіпті әртүрлі аудандарда да.`,
    unknownMeasure: (id) => `«${id}» шарасы каталогта жоқ.`,
    districtForCity: (id) => `${id} шарасы бүкіл қалаға әсер етеді: оған аудан тағайындалмайды.`,
    districtRequired: (id) => `${id} шарасы үшін аудан таңдалмаған.`,
    invalidDistrict: (id, district) => `${id} шарасы үшін белгісіз аудан көрсетілген: «${district}».`,
    budgetExceeded: (spent, budget, over) =>
      `Бюджет жетпейді: жиынтық құны ${spent} бірлік, бюджет ${budget}, ${over} бірлік жетіспейді.`,
    categoryLimit: (category, count, max) =>
      `«${category}» бағыты бойынша ${count} шара таңдалды, ең көбі ${max} болуы керек.`,
    incompatibleGlobal: (a, b, reason) =>
      `${a} және ${b} шараларын ешбір ауданда бірге таңдауға болмайды: ${reason}`,
    incompatibleDistrict: (a, b, district, reason) => `${district} ауданында ${a} және ${b}: ${reason}`,
  },

  block: {
    rulesUnavailable: "Таңдау ережелері серверден әлі алынған жоқ.",
    unknownMeasure: (id) => `«${id}» шарасы каталогта жоқ.`,
    planFull: (count, required) =>
      `Жоспар толық: ${count} / ${required}. Бұл шараны қосу үшін біреуін алып тастаңыз.`,
    categoryLimit: (category, count, ids) =>
      `«${category}» бағыты бойынша ${count} шара таңдалып қойған (${ids}).`,
    incompatible: (partner, reason) => `${partner} шарасымен бірге болмайды: ${reason}`,
    budget: (shortfall) => `Бюджет жетпейді: ${shortfall} бірлік жетіспейді.`,
    districtConflict: (district, partner, reason) =>
      `${district} ауданында ${partner} шарасы таңдалып қойған. ${reason} Басқа ауданды таңдаңыз.`,
    unknownDistrict: (id) => `Белгісіз аудан: «${id}». Тізімнен ауданды таңдаңыз.`,
    allDistricts: "Барлық аудандарда таңдалған шаралармен қайшылық бар.",
  },
};

const en: PlannerCopy = {
  title: (required) => `Choose ${required} decisions`,
  titleWithoutRules: "Decision catalog",
  lede: (budget, quarters) => `Budget: ${budget} units over ${quarters} quarters.`,
  ledeLimit: (max) => `No more than ${max} measures per area.`,
  back: "Back to city overview",
  rulesMissing:
    "Selection rules have not arrived from the server yet. You can browse the catalog, but adding measures and evaluating the plan is unavailable.",
  liveEvaluating: "Evaluating decisions; editing is temporarily locked.",
  liveStatus: (count, required, remaining) =>
    `${count} of ${required ?? "—"} selected. Estimated remaining: ${remaining} units.`,
  builderLegend: "Decision builder",
  filtersLabel: "Areas",
  filterAll: "All",
  preferredDistrict: (district) =>
    `${district}, selected in the overview, is suggested for new measures. You can change it on each card.`,
  emptyCategory: "No measures in this area. Choose another area.",

  unit: "units",
  factCategory: "Area",
  factScope: "Scope",
  scopeCity: "Whole city",
  scopeDistrict: "One district",
  factLag: "Lag",
  lag: (quarters, raw) => `${quarters} ${raw === 1 ? "quarter" : "quarters"}`,
  effectsLabel: "Catalog effects",
  noEffects: "No effects listed in the catalog.",
  details: "Details",
  hideDetails: "Hide",
  fullEffectNote: "Full catalog effect, before lag",
  cardSynergy: (partners) =>
    `Possible synergy with ${partners}. The server evaluation will show whether it applies.`,
  districtLegend: "District",
  assignedDistrictLegend: "Assigned district",
  chooseDistrictWarning: "Choose a district: evaluation is unavailable without it.",
  inPlan: "In plan",
  remove: "Remove",
  addToPlan: "Add to plan",

  conflictInDistrict: (district, text) => `Conflict in ${district}: ${text}`,
  blockedInDistrict: (district, text) => `Not allowed in ${district}: ${text}`,
  conflictText: (partner, reason) => `${partner} is already selected there. ${reason}`,
  notSelected: "Not selected",
  unknownDistrictOption: (id) => `Unknown district “${id}”`,
  districtOptionConflict: (district) => `${district} — conflict`,

  plan: "Plan",
  ofTotal: (total) => `of ${total ?? "—"}`,
  collapse: "Collapse",
  budgetLabel: "Estimated budget",
  spent: "Spent",
  ofBudget: (budget) => `of ${budget}`,
  remaining: "Remaining",
  overBudget: "Over budget",
  estimateNote: "Estimate based on catalog prices. The server calculates the final result.",
  measureNotFound: (id) => `Measure “${id}” not found`,
  removeFromPlan: (id) => `Remove ${id} from plan`,
  districtShort: "District",
  noDistrictWarning: "No district selected: evaluation unavailable.",
  wholeCity: "Whole city",
  emptySlot: "Empty slot",
  traySynergy: (pairs) =>
    `Possible synergy: ${pairs.map(([a, b]) => `${a} and ${b}`).join(", ")}. The evaluation will show whether it applies.`,
  blockersTitle: "What blocks evaluation",
  serverResponse: "Server response",
  planSaved: "Your plan is saved. Review it and evaluate again.",
  evaluate: "Evaluate decisions",
  evaluating: "Evaluating decisions…",
  evaluateShort: "Evaluate",
  evaluatingShort: "Evaluating…",
  mobileRemaining: (remaining) => `${remaining} units left`,
  mobileOver: (over) => `over by ${over} units`,
  ribbonAllocated: (spent, budget) => `${spent} of ${budget} units allocated.`,
  ribbonOver: (spent, budget) => `Over budget: ${spent} of ${budget} units.`,

  issue: {
    rulesUnavailable: "Selection rules have not arrived from the server: evaluation unavailable.",
    tooFew: (count, required) => `${count} of ${required} measures selected: add ${required - count} more.`,
    tooMany: (count, required) =>
      `${count} measures selected, exactly ${required} required: remove ${count - required}.`,
    duplicate: (id, times) =>
      `${id} is selected ${times} times: each measure can be chosen only once, even in different districts.`,
    unknownMeasure: (id) => `Measure “${id}” is not in the catalog.`,
    districtForCity: (id) => `${id} applies to the whole city: it takes no district.`,
    districtRequired: (id) => `No district selected for ${id}.`,
    invalidDistrict: (id, district) => `Unknown district “${district}” for ${id}.`,
    budgetExceeded: (spent, budget, over) =>
      `Over budget: the plan costs ${spent} units against a budget of ${budget}; ${over} units short.`,
    categoryLimit: (category, count, max) =>
      `${count} measures selected in “${category}”; the limit is ${max}.`,
    incompatibleGlobal: (a, b, reason) => `${a} and ${b} cannot be selected together in any district: ${reason}`,
    incompatibleDistrict: (a, b, district, reason) => `${a} and ${b} in ${district}: ${reason}`,
  },

  block: {
    rulesUnavailable: "Selection rules have not arrived from the server yet.",
    unknownMeasure: (id) => `Measure “${id}” is not in the catalog.`,
    planFull: (count, required) => `Plan is full: ${count} of ${required}. Remove a measure to add this one.`,
    categoryLimit: (category, count, ids) => `“${category}” already has ${count} measures (${ids}).`,
    incompatible: (partner, reason) => `Cannot be combined with ${partner}: ${reason}`,
    budget: (shortfall) => `Not enough budget: ${shortfall} units short.`,
    districtConflict: (district, partner, reason) =>
      `${partner} is already selected in ${district}. ${reason} Choose another district.`,
    unknownDistrict: (id) => `Unknown district “${id}”: choose one from the list.`,
    allDistricts: "Every district conflicts with measures already selected.",
  },
};

export const plannerMessages: Readonly<Record<Locale, PlannerCopy>> = { ru, kk, en };
