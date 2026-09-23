export type Locale = "ru" | "kk" | "en";
export type IntlLocale = "ru-RU" | "kk-KZ" | "en-US";

export const intlLocales: Record<Locale, IntlLocale> = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
};

type LocalizedCatalog = Record<Locale, Record<string, string>>;

const districts: LocalizedCatalog = {
  ru: { yesil: "Есиль", almaty: "Алматы", saryarka: "Сарыарка", baikonur: "Байконур", nura: "Нура" },
  kk: { yesil: "Есіл", almaty: "Алматы", saryarka: "Сарыарқа", baikonur: "Байқоңыр", nura: "Нұра" },
  en: { yesil: "Yesil", almaty: "Almaty", saryarka: "Saryarka", baikonur: "Baikonur", nura: "Nura" },
};

const measures: LocalizedCatalog = {
  ru: { M1: "Выделенные полосы для автобусов", M2: "Умные светофоры (адаптивное управление)", M3: "Линия ЛРТ / расширение", M4: "Парк / сквер", M5: "Перевод частного сектора на чистое топливо", M6: "Городская программа озеленения и ветрозащитных полос", M7: "Школа + детсад (модульное строительство)", M8: "Центр семейного здоровья / поликлиника", M9: "Дворовые спорт-хабы", M10: "Освещение и камеры (расширение Safe City)", M11: "Безопасные переходы и школьные зоны", M12: "Единая цифровая платформа обращений", M13: "Модернизация тепло- и водосетей", M14: "Аварийные бригады ЖКХ + раннее оповещение" },
  kk: { M1: "Автобустарға арналған бөлек жолақтар", M2: "Ақылды бағдаршамдар (бейімделмелі басқару)", M3: "LRT желісі / кеңейту", M4: "Парк / шағын саябақ", M5: "Жеке секторды таза отынға көшіру", M6: "Қаланы көгалдандыру және желден қорғайтын белдеулер бағдарламасы", M7: "Мектеп + балабақша (модульдік құрылыс)", M8: "Отбасылық денсаулық орталығы / емхана", M9: "Аула спорт хабтары", M10: "Жарықтандыру және камералар (Safe City кеңейту)", M11: "Қауіпсіз өткелдер мен мектеп аймақтары", M12: "Өтініштерге арналған бірыңғай цифрлық платформа", M13: "Жылу және су желілерін жаңғырту", M14: "ТКШ апаттық бригадалары + ерте ескерту" },
  en: { M1: "Dedicated bus lanes", M2: "Smart traffic lights (adaptive control)", M3: "LRT line / expansion", M4: "Park / public garden", M5: "Clean-fuel transition for private housing", M6: "City greening and windbreak programme", M7: "School + kindergarten (modular construction)", M8: "Family health centre / clinic", M9: "Neighbourhood sports hubs", M10: "Lighting and cameras (Safe City expansion)", M11: "Safe crossings and school zones", M12: "Unified digital platform for resident requests", M13: "Heat and water network modernisation", M14: "Emergency utilities crews + early warning" },
};

const indicators: LocalizedCatalog = {
  ru: { T1: "Разгрузка дорог", T2: "Доступность общественного транспорта", E1: "Озеленение", E2: "Качество воздуха", S1: "Школы и детсады", S2: "Поликлиники и первичная медпомощь", B1: "Безопасность улиц", B2: "Безопасность дорожного движения", C1: "Надёжность ЖКХ", C2: "Скорость решения обращений жителей" },
  kk: { T1: "Жол кептелісін азайту", T2: "Қоғамдық көліктің қолжетімділігі", E1: "Көгалдандыру", E2: "Ауа сапасы", S1: "Мектептер мен балабақшалар", S2: "Емханалар мен алғашқы медициналық көмек", B1: "Көшелердің қауіпсіздігі", B2: "Жол қозғалысының қауіпсіздігі", C1: "ТКШ сенімділігі", C2: "Тұрғындардың өтініштерін шешу жылдамдығы" },
  en: { T1: "Road congestion relief", T2: "Public transport accessibility", E1: "Greening", E2: "Air quality", S1: "Schools and kindergartens", S2: "Clinics and primary care", B1: "Street safety", B2: "Road safety", C1: "Utility reliability", C2: "Speed of resolving resident requests" },
};

const categories: LocalizedCatalog = {
  ru: { transport: "Транспорт", ecology: "Экология", social: "Социальная сфера", safety: "Безопасность", services: "Городские сервисы" },
  kk: { transport: "Көлік", ecology: "Экология", social: "Әлеуметтік сала", safety: "Қауіпсіздік", services: "Қалалық сервистер" },
  en: { transport: "Transport", ecology: "Environment", social: "Social services", safety: "Safety", services: "City services" },
};

const incompatibilities: LocalizedCatalog = {
  ru: { "M1|M3": "Либо выделенные полосы (BRT), либо ЛРТ — в любом районе.", "M4|M7": "Парк и школа не могут быть в одном районе: конфликт за участок.", "M5|M13": "Чистое топливо и модернизация сетей не могут быть в одном районе: дублирование программы." },
  kk: { "M1|M3": "Кез келген ауданда не BRT жолағы, не LRT — екеуін бірге таңдауға болмайды.", "M4|M7": "Парк пен мектеп бір ауданда орналаспайды: жер телімі үшін қайшылық.", "M5|M13": "Таза отын мен желілерді жаңғырту бір ауданда қатар жүрмейді: бағдарлама қайталанады." },
  en: { "M1|M3": "Choose either dedicated BRT lanes or LRT in any district.", "M4|M7": "A park and a school cannot share one district: they compete for the site.", "M5|M13": "Clean fuel and network modernisation cannot be combined in one district: the programmes overlap." },
};

function lookup(catalog: LocalizedCatalog, id: string, locale: Locale, fallback: string) {
  return catalog[locale][id] ?? fallback;
}

export const districtName = (id: string, locale: Locale, fallback: string) => lookup(districts, id, locale, fallback);
export const measureName = (id: string, locale: Locale, fallback: string) => lookup(measures, id, locale, fallback);
export const indicatorName = (id: string, locale: Locale, fallback: string) => lookup(indicators, id, locale, fallback);
export const categoryName = (id: string, locale: Locale) => lookup(categories, id, locale, id);
const measurePairKey = (measureIds: readonly string[]) => [...measureIds]
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
  .join("|");

export const incompatibilityReason = (measureIds: readonly string[], locale: Locale, fallback: string) => lookup(incompatibilities, measurePairKey(measureIds), locale, fallback);

export const localeDocumentTitles: Record<Locale, string> = {
  ru: "Аким на 5 часов",
  kk: "5 сағаттық әкім",
  en: "Akim for 5 Hours",
};
