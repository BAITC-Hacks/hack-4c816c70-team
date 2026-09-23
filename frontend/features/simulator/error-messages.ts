import { ApiClientError, type ApiErrorKind } from "../../lib/api/errors";
import type { Locale } from "../../lib/i18n";

export interface SimulationError {
  readonly kind: ApiErrorKind | "unknown";
  readonly code?: string;
  readonly status?: number;
  readonly detail?: string;
}

const knownCodes = ["WRONG_CHOICE_COUNT", "BUDGET_EXCEEDED", "INVALID_REQUEST", "UNKNOWN_MEASURE", "DUPLICATE_MEASURE", "DISTRICT_REQUIRED", "DISTRICT_NOT_ALLOWED", "UNKNOWN_DISTRICT", "CATEGORY_LIMIT_EXCEEDED", "INCOMPATIBLE_MEASURES"] as const;

const messages: Record<Locale, { readonly network: string; readonly timeout: string; readonly invalidJson: string; readonly contract: string; readonly http: (status?: number) => string; readonly unknown: string; readonly codes: Readonly<Record<(typeof knownCodes)[number], string>> }> = {
  ru: { network: "Не удалось подключиться к серверу. Проверьте соединение и адрес API.", timeout: "Время ожидания ответа сервера истекло.", invalidJson: "Сервер вернул ответ в неверном формате.", contract: "Сервер вернул данные в неподдерживаемом формате.", http: (status) => status ? `Сервер вернул ошибку ${status}.` : "Сервер вернул ошибку.", unknown: "Не удалось выполнить запрос к серверу.", codes: { WRONG_CHOICE_COUNT: "Нужно выбрать ровно 5 решений.", BUDGET_EXCEEDED: "Этот набор превышает бюджет.", INVALID_REQUEST: "Сервер не принял запрос.", UNKNOWN_MEASURE: "Выбрана неизвестная мера.", DUPLICATE_MEASURE: "Одну и ту же меру нельзя выбрать дважды.", DISTRICT_REQUIRED: "Для районной меры нужно выбрать район.", DISTRICT_NOT_ALLOWED: "Для городской меры район не указывается.", UNKNOWN_DISTRICT: "Выбран неизвестный район.", CATEGORY_LIMIT_EXCEEDED: "Превышен лимит мер одного направления.", INCOMPATIBLE_MEASURES: "Выбраны несовместимые меры." } },
  kk: { network: "Серверге қосылу мүмкін болмады. Қосылымды және API мекенжайын тексеріңіз.", timeout: "Сервер жауабын күту уақыты аяқталды.", invalidJson: "Сервер жауапты қате пішімде жіберді.", contract: "Сервер қолдау көрсетілмейтін пішімдегі деректерді жіберді.", http: (status) => status ? `Сервер ${status} қатесін қайтарды.` : "Сервер қате қайтарды.", unknown: "Серверге сұрау жіберу мүмкін болмады.", codes: { WRONG_CHOICE_COUNT: "Дәл 5 шешім таңдау керек.", BUDGET_EXCEEDED: "Бұл жиынтық бюджеттен асады.", INVALID_REQUEST: "Сервер сұрауды қабылдамады.", UNKNOWN_MEASURE: "Белгісіз шара таңдалды.", DUPLICATE_MEASURE: "Бір шараны екі рет таңдауға болмайды.", DISTRICT_REQUIRED: "Аудандық шара үшін ауданды таңдаңыз.", DISTRICT_NOT_ALLOWED: "Қалалық шараға аудан көрсетілмейді.", UNKNOWN_DISTRICT: "Белгісіз аудан таңдалды.", CATEGORY_LIMIT_EXCEEDED: "Бір бағыттағы шаралар лимиті асты.", INCOMPATIBLE_MEASURES: "Үйлеспейтін шаралар таңдалды." } },
  en: { network: "Could not connect to the server. Check the connection and API address.", timeout: "The server response timed out.", invalidJson: "The server returned an invalid response format.", contract: "The server returned data in an unsupported format.", http: (status) => status ? `The server returned error ${status}.` : "The server returned an error.", unknown: "Could not complete the server request.", codes: { WRONG_CHOICE_COUNT: "Choose exactly 5 decisions.", BUDGET_EXCEEDED: "This set exceeds the budget.", INVALID_REQUEST: "The server did not accept the request.", UNKNOWN_MEASURE: "An unknown measure was selected.", DUPLICATE_MEASURE: "The same measure cannot be selected twice.", DISTRICT_REQUIRED: "Choose a district for the district measure.", DISTRICT_NOT_ALLOWED: "A city measure must not include a district.", UNKNOWN_DISTRICT: "An unknown district was selected.", CATEGORY_LIMIT_EXCEEDED: "The limit for one category was exceeded.", INCOMPATIBLE_MEASURES: "Incompatible measures were selected." } },
};

export function simulationError(error: unknown): SimulationError {
  if (error instanceof ApiClientError) return { kind: error.kind, code: error.code, status: error.status, detail: error.message };
  return { kind: "unknown", detail: error instanceof Error ? error.message : undefined };
}

export function formatSimulationError(error: SimulationError, locale: Locale): string {
  const copy = messages[locale];
  if (error.code && knownCodes.includes(error.code as (typeof knownCodes)[number])) return copy.codes[error.code as (typeof knownCodes)[number]];
  const base = error.kind === "network" ? copy.network : error.kind === "timeout" ? copy.timeout : error.kind === "invalid-json" ? copy.invalidJson : error.kind === "contract" ? copy.contract : error.kind === "http" ? copy.http(error.status) : copy.unknown;
  return base;
}
