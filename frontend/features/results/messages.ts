import type { Locale } from "@/lib/i18n";

export const resultMessages: Record<Locale, {
  readonly eyebrow: string;
  readonly heading: string;
  readonly submitted: (selected: number, required: number, quarters: number) => string;
  readonly edit: string;
  readonly reset: string;
  readonly finalBudget: string;
  readonly budgetAria: (spent: string, budget: string) => string;
  readonly remaining: (remaining: string) => string;
  readonly scoreAria: string;
  readonly finalScore: string;
  readonly before: string;
  readonly after: string;
  readonly scoreBarAria: (before: string, after: string) => string;
  readonly change: string;
  readonly districts: string;
  readonly indicators: string;
  readonly below: (threshold: string) => string;
  readonly recovered: (threshold: string) => string;
  readonly synergies: string;
  readonly explanation: string;
  readonly strengths: string;
  readonly risks: string;
  readonly recommendations: string;
  readonly none: string;
  readonly explanationRussianOnly: string;
  readonly source: { readonly llm: string; readonly mock: string };
}> = {
  ru: {
    eyebrow: "Результат симуляции", heading: "Ваш план оценён", submitted: (selected, required, quarters) => `${selected} из ${required} решений отправлены на сервер и рассчитаны для горизонта ${quarters} кварталов.`, edit: "Изменить решения", reset: "Начать заново", finalBudget: "Финальный бюджет", budgetAria: (spent, budget) => `Потрачено ${spent} из ${budget}`, remaining: (remaining) => `Остаток: ${remaining} ед.`, scoreAria: "Сравнение итогового Score", finalScore: "Итоговый Score", before: "До", after: "После", scoreBarAria: (before, after) => `Score: ${before} до, ${after} после`, change: "Изменение", districts: "Районы: до и после", indicators: "Показатели: до и после", below: (threshold) => `Остаётся ниже ${threshold}`, recovered: (threshold) => `Выведен из критической зоны (было ниже ${threshold})`, synergies: "Применённые синергии", explanation: "Объяснение от сервера", strengths: "Сильные стороны", risks: "Риски", recommendations: "Рекомендации", none: "Нет.", explanationRussianOnly: "", source: { llm: "AI-анализ", mock: "Шаблонное объяснение" },
  },
  kk: {
    eyebrow: "Симуляция нәтижесі", heading: "Жоспарыңыз бағаланды", submitted: (selected, required, quarters) => `${selected} / ${required} шешім серверге жіберіліп, ${quarters} тоқсан көкжиегіне есептелді.`, edit: "Шешімдерді өзгерту", reset: "Қайта бастау", finalBudget: "Қорытынды бюджет", budgetAria: (spent, budget) => `${spent} / ${budget} жұмсалды`, remaining: (remaining) => `Қалдық: ${remaining} бірл.`, scoreAria: "Қорытынды Score салыстыруы", finalScore: "Қорытынды Score", before: "Бұрын", after: "Кейін", scoreBarAria: (before, after) => `Score: бұрын ${before}, кейін ${after}`, change: "Өзгеріс", districts: "Аудандар: бұрын және кейін", indicators: "Көрсеткіштер: бұрын және кейін", below: (threshold) => `${threshold} деңгейінен төмен болып қалды`, recovered: (threshold) => `Сындарлы аймақтан шықты (бұрын ${threshold} деңгейінен төмен)`, synergies: "Қолданылған синергиялар", explanation: "Сервер түсіндірмесі", strengths: "Күшті жақтары", risks: "Тәуекелдер", recommendations: "Ұсынымдар", none: "Жоқ.", explanationRussianOnly: "Түсіндірме әзірге орыс тілінде қолжетімді.", source: { llm: "AI-талдау", mock: "Үлгілік түсіндірме" },
  },
  en: {
    eyebrow: "Simulation result", heading: "Your plan has been evaluated", submitted: (selected, required, quarters) => `${selected} of ${required} decisions were sent to the server and calculated for a ${quarters}-quarter horizon.`, edit: "Edit decisions", reset: "Start over", finalBudget: "Final budget", budgetAria: (spent, budget) => `${spent} of ${budget} spent`, remaining: (remaining) => `Remaining: ${remaining} units`, scoreAria: "Final Score comparison", finalScore: "Final Score", before: "Before", after: "After", scoreBarAria: (before, after) => `Score: ${before} before, ${after} after`, change: "Change", districts: "Districts: before and after", indicators: "Indicators: before and after", below: (threshold) => `Remains below ${threshold}`, recovered: (threshold) => `Out of the critical zone (was below ${threshold})`, synergies: "Applied synergies", explanation: "Server explanation", strengths: "Strengths", risks: "Risks", recommendations: "Recommendations", none: "None.", explanationRussianOnly: "Explanation is currently available in Russian.", source: { llm: "AI analysis", mock: "Template explanation" },
  },
};
