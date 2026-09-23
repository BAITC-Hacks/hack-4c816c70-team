import type { Locale } from "@/lib/i18n";
import type { AlternativesFailure } from "./alternatives-state";
import type { AlternativeGoal } from "./types";

export const alternativesMessages: Record<Locale, {
  readonly title: string;
  readonly lead: string;
  readonly goalLegend: string;
  readonly goals: Record<AlternativeGoal, string>;
  readonly yourGoal: string;
  readonly find: string;
  readonly finding: string;
  readonly unavailable: string;
  readonly failures: Record<AlternativesFailure, string>;
  readonly retry: string;
  readonly goalMismatch: (goal: string) => string;
  readonly staleTexts: (language: string) => string;
  readonly requestAgain: string;
  readonly outdated: string;
  readonly currentPlan: (score: string, spent: string, weakest: string) => string;
  readonly spent: string;
  readonly score: string;
  readonly minDistrict: string;
  readonly versusCurrent: string;
  readonly gains: string;
  readonly losses: string;
  readonly noGains: string;
  readonly noLosses: string;
  readonly adds: (items: string) => string;
  readonly removes: (items: string) => string;
  readonly noVariant: (goal: string) => string;
  readonly sameAs: (goals: string) => string;
  readonly samePlan: string;
  readonly apply: string;
  readonly applyBlocked: string;
  readonly advice: string;
  readonly adviceSource: { readonly llm: string; readonly mock: string };
  readonly applied: string;
}> = {
  ru: {
    title: "Альтернативы плана",
    lead: "Сервер проверит все замены одной меры в текущем плане и покажет лучший найденный вариант для каждой цели. Запрос отправляется только по кнопке.",
    goalLegend: "Цель совета",
    goals: { score: "Максимальный Score", equity: "Помощь слабейшему району", economy: "Экономия бюджета" },
    yourGoal: "Ваша цель",
    find: "Найти альтернативы",
    finding: "Подбираем альтернативы…",
    unavailable: "Подбор альтернатив ещё не опубликован в API сервера. Кнопка станет активной после публикации контракта.",
    failures: { network: "Не удалось подключиться к серверу. Текущий план не изменён.", timeout: "Сервер не ответил вовремя. Текущий план не изменён.", server: "Сервер не смог подобрать альтернативы. Текущий план не изменён.", contract: "Сервер вернул альтернативы в неожиданном формате. Текущий план не изменён." },
    retry: "Повторить запрос",
    goalMismatch: (goal) => `Совет ниже дан для цели «${goal}». Чтобы получить совет для новой цели, нажмите «Найти альтернативы».`,
    staleTexts: (language) => `Тексты стратегий и совет получены на языке «${language}». Числа от языка не зависят. Чтобы получить тексты на русском, запросите альтернативы снова.`,
    requestAgain: "Запросить снова на русском",
    outdated: "Сервер сравнивал другой набор решений, поэтому эти альтернативы не показаны. Запросите их снова.",
    currentPlan: (score, spent, weakest) => `Текущий план: Score ${score} · расходы ${spent} ед. · минимальная оценка района ${weakest}`,
    spent: "Расходы",
    score: "Score",
    minDistrict: "Минимальная оценка района",
    versusCurrent: "Разница — к текущему плану, по данным сервера.",
    gains: "Преимущества",
    losses: "Потери",
    noGains: "Преимуществ относительно текущего плана нет.",
    noLosses: "Потерь относительно текущего плана нет.",
    adds: (items) => `Добавляет: ${items}`,
    removes: (items) => `Убирает: ${items}`,
    noVariant: (goal) => `Улучшения по цели «${goal}» не найдено: текущий план остаётся лучшим из проверенных.`,
    sameAs: (goals) => `Тот же план, что и в стратегии: ${goals}.`,
    samePlan: "Совпадает с текущим планом — применять нечего.",
    apply: "Применить",
    applyBlocked: "Набор не проходит проверку формы и не может быть применён.",
    advice: "Совет",
    adviceSource: { llm: "Источник: AI-анализ", mock: "Источник: шаблонный совет" },
    applied: "Стратегия перенесена в план. Проверьте решения и нажмите «Оценить», чтобы сравнить её с прошлой попыткой.",
  },
  kk: {
    title: "Жоспар баламалары",
    lead: "Сервер ағымдағы жоспардағы бір шараны ауыстырудың барлық нұсқаларын тексеріп, әр мақсатқа табылған ең жақсы нұсқаны көрсетеді. Сұрау тек батырма арқылы жіберіледі.",
    goalLegend: "Кеңес мақсаты",
    goals: { score: "Ең жоғары Score", equity: "Ең әлсіз ауданға көмек", economy: "Бюджетті үнемдеу" },
    yourGoal: "Сіздің мақсатыңыз",
    find: "Баламаларды табу",
    finding: "Баламалар іріктелуде…",
    unavailable: "Баламаларды іріктеу сервер API-інде әлі жарияланбаған. Келісімшарт жарияланғаннан кейін батырма белсенді болады.",
    failures: { network: "Серверге қосылу мүмкін болмады. Ағымдағы жоспар өзгерген жоқ.", timeout: "Сервер уақытында жауап бермеді. Ағымдағы жоспар өзгерген жоқ.", server: "Сервер баламаларды іріктей алмады. Ағымдағы жоспар өзгерген жоқ.", contract: "Сервер баламаларды күтпеген пішімде қайтарды. Ағымдағы жоспар өзгерген жоқ." },
    retry: "Сұрауды қайталау",
    goalMismatch: (goal) => `Төмендегі кеңес «${goal}» мақсатына берілген. Жаңа мақсатқа кеңес алу үшін «Баламаларды табу» батырмасын басыңыз.`,
    staleTexts: (language) => `Стратегия мәтіндері мен кеңес «${language}» тілінде алынған. Сандар тілге тәуелді емес. Мәтіндерді қазақ тілінде алу үшін баламаларды қайта сұраңыз.`,
    requestAgain: "Қазақ тілінде қайта сұрау",
    outdated: "Сервер басқа шешімдер жиынтығын салыстырды, сондықтан бұл баламалар көрсетілмейді. Оларды қайта сұраңыз.",
    currentPlan: (score, spent, weakest) => `Ағымдағы жоспар: Score ${score} · шығыстар ${spent} бірл. · ауданның ең төмен бағасы ${weakest}`,
    spent: "Шығыстар",
    score: "Score",
    minDistrict: "Ауданның ең төмен бағасы",
    versusCurrent: "Айырма — ағымдағы жоспарға қарағанда, сервер деректері бойынша.",
    gains: "Артықшылықтары",
    losses: "Жоғалтулары",
    noGains: "Ағымдағы жоспармен салыстырғанда артықшылық жоқ.",
    noLosses: "Ағымдағы жоспармен салыстырғанда жоғалту жоқ.",
    adds: (items) => `Қосады: ${items}`,
    removes: (items) => `Алып тастайды: ${items}`,
    noVariant: (goal) => `«${goal}» мақсаты бойынша жақсарту табылмады: ағымдағы жоспар тексерілгендердің ішінде ең жақсысы болып қалады.`,
    sameAs: (goals) => `Мына стратегиядағы жоспармен бірдей: ${goals}.`,
    samePlan: "Ағымдағы жоспармен бірдей — қолданатын ештеңе жоқ.",
    apply: "Қолдану",
    applyBlocked: "Жиынтық форма тексеруінен өтпейді, сондықтан қолдану мүмкін емес.",
    advice: "Кеңес",
    adviceSource: { llm: "Дереккөз: AI-талдау", mock: "Дереккөз: үлгілік кеңес" },
    applied: "Стратегия жоспарға көшірілді. Шешімдерді тексеріп, алдыңғы әрекетпен салыстыру үшін «Бағалау» батырмасын басыңыз.",
  },
  en: {
    title: "Plan alternatives",
    lead: "The server checks every replacement of one measure in your current plan and shows the best option found for each goal. The request is sent only when you press the button.",
    goalLegend: "Advice goal",
    goals: { score: "Highest Score", equity: "Help the weakest district", economy: "Save budget" },
    yourGoal: "Your goal",
    find: "Find alternatives",
    finding: "Finding alternatives…",
    unavailable: "Alternative search is not published in the server API yet. The button will be enabled once the contract is published.",
    failures: { network: "Could not connect to the server. Your current plan is unchanged.", timeout: "The server did not respond in time. Your current plan is unchanged.", server: "The server could not find alternatives. Your current plan is unchanged.", contract: "The server returned alternatives in an unexpected format. Your current plan is unchanged." },
    retry: "Try again",
    goalMismatch: (goal) => `The advice below is for the goal “${goal}”. Press “Find alternatives” to get advice for the new goal.`,
    staleTexts: (language) => `Strategy texts and advice were received in ${language}. Numbers do not depend on language. Request alternatives again to get the texts in English.`,
    requestAgain: "Request again in English",
    outdated: "The server compared a different set of decisions, so these alternatives are not shown. Request them again.",
    currentPlan: (score, spent, weakest) => `Current plan: Score ${score} · spending ${spent} units · lowest district score ${weakest}`,
    spent: "Spending",
    score: "Score",
    minDistrict: "Lowest district score",
    versusCurrent: "Differences are against the current plan, as reported by the server.",
    gains: "Gains",
    losses: "Trade-offs",
    noGains: "No gains compared with the current plan.",
    noLosses: "No trade-offs compared with the current plan.",
    adds: (items) => `Adds: ${items}`,
    removes: (items) => `Removes: ${items}`,
    noVariant: (goal) => `No improvement found for the goal “${goal}”: your current plan remains the best of those checked.`,
    sameAs: (goals) => `Same plan as the strategy: ${goals}.`,
    samePlan: "Same as your current plan — nothing to apply.",
    apply: "Apply",
    applyBlocked: "This set does not pass the form checks and cannot be applied.",
    advice: "Advice",
    adviceSource: { llm: "Source: AI analysis", mock: "Source: template advice" },
    applied: "The strategy has been moved into your plan. Review the decisions and press “Evaluate” to compare it with the previous attempt.",
  },
};
