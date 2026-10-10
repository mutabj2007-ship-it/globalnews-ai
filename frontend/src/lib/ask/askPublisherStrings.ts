/*
  P0 SOURCE-BACKED NEWS ANSWERS R1 — what the reader is told when they named a publisher
  (Claude G G-ASK-4 verdict, carried in payload.research.requestedPublisher). Recognition is not
  authorization and not retrieval: a recognised masthead this product does not carry was NOT
  searched, and no other publisher's reporting was put in its place. EN is Claude Code's wording for
  CTO review; PL / DE / FR / ES / PT / AR are drafts until Claude L qualifies them.
*/
import type { DisplayLocale } from '@globalnews-ai/shared';

export interface AskPublisherStrings {
  readonly notCarried: (publisher: string) => string;
  readonly unrecognised: (phrase: string) => string;
  readonly carriedOnly: (publisher: string) => string;
  readonly askWithout: (publisher: string) => string;
  readonly withoutDraft: (topic: string) => string;
  /** P3 — a reviewed spelling variant was searched under its canonical name */
  readonly searchedAs: (searched: string, asked: string) => string;
}

const q = (s: string) => `“${s}”`;

const EN: AskPublisherStrings = {
  notCarried: (p) => `${p} is a publisher Ask recognises but does not carry, so its reporting wasn’t searched. Reporting from other publishers wasn’t used in its place.`,
  unrecognised: (p) => `Ask couldn’t tell which publisher ${q(p)} refers to, so no source was searched.`,
  carriedOnly: (p) => `Searched ${p} only, as you asked.`,
  askWithout: (p) => `Ask again without ${p}`,
  withoutDraft: (t) => `What are the latest reports about ${t}?`,
  searchedAs: (s, a) => `Searched as ${s} (you wrote ${a}).`,
};
const PL: AskPublisherStrings = {
  notCarried: (p) => `${p} to wydawca rozpoznawany przez Ask, ale nieobsługiwany, więc jego doniesień nie przeszukano. Nie zastąpiono ich doniesieniami innych wydawców.`,
  unrecognised: (p) => `Ask nie rozpoznał, o którego wydawcę chodzi w ${q(p)}, więc nie przeszukano żadnego źródła.`,
  carriedOnly: (p) => `Przeszukano wyłącznie ${p}, zgodnie z prośbą.`,
  askWithout: (p) => `Zapytaj ponownie bez ${p}`,
  withoutDraft: (t) => `Jakie są najnowsze doniesienia o ${t}?`,
  searchedAs: (s, a) => `Wyszukano jako ${s} (wpisano: ${a}).`,
};
const DE: AskPublisherStrings = {
  notCarried: (p) => `${p} ist ein Herausgeber, den Ask kennt, aber nicht führt; seine Berichte wurden daher nicht durchsucht. Berichte anderer Herausgeber wurden nicht ersatzweise verwendet.`,
  unrecognised: (p) => `Ask konnte nicht erkennen, welcher Herausgeber mit ${q(p)} gemeint ist; daher wurde keine Quelle durchsucht.`,
  carriedOnly: (p) => `Wie gewünscht nur ${p} durchsucht.`,
  askWithout: (p) => `Ohne ${p} erneut fragen`,
  withoutDraft: (t) => `Was sind die neuesten Berichte über ${t}?`,
  searchedAs: (s, a) => `Gesucht als ${s} (Ihre Eingabe: ${a}).`,
};
const FR: AskPublisherStrings = {
  notCarried: (p) => `${p} est un éditeur qu’Ask reconnaît mais ne diffuse pas : ses articles n’ont donc pas été consultés. Aucun article d’un autre éditeur n’a été utilisé à sa place.`,
  unrecognised: (p) => `Ask n’a pas pu déterminer quel éditeur désigne ${q(p)} ; aucune source n’a donc été consultée.`,
  carriedOnly: (p) => `Recherche limitée à ${p}, comme demandé.`,
  askWithout: (p) => `Redemander sans ${p}`,
  withoutDraft: (t) => `Quels sont les derniers articles sur ${t} ?`,
  searchedAs: (s, a) => `Recherché sous ${s} (vous avez écrit ${a}).`,
};
const ES: AskPublisherStrings = {
  notCarried: (p) => `${p} es un medio que Ask reconoce pero no incluye, así que no se buscó en sus informes. No se usaron informes de otros medios en su lugar.`,
  unrecognised: (p) => `Ask no pudo determinar a qué medio se refiere ${q(p)}, así que no se buscó en ninguna fuente.`,
  carriedOnly: (p) => `Se buscó solo en ${p}, como pediste.`,
  askWithout: (p) => `Preguntar de nuevo sin ${p}`,
  withoutDraft: (t) => `¿Cuáles son los últimos informes sobre ${t}?`,
  searchedAs: (s, a) => `Buscado como ${s} (escribiste ${a}).`,
};
const PT: AskPublisherStrings = {
  notCarried: (p) => `${p} é um veículo que o Ask reconhece, mas não inclui, por isso as suas notícias não foram pesquisadas. Notícias de outros veículos não foram usadas no seu lugar.`,
  unrecognised: (p) => `O Ask não conseguiu identificar a que veículo ${q(p)} se refere, por isso nenhuma fonte foi pesquisada.`,
  carriedOnly: (p) => `Pesquisado apenas em ${p}, como pediu.`,
  askWithout: (p) => `Perguntar novamente sem ${p}`,
  withoutDraft: (t) => `Quais são as notícias mais recentes sobre ${t}?`,
  searchedAs: (s, a) => `Pesquisado como ${s} (escreveu ${a}).`,
};
const AR: AskPublisherStrings = {
  notCarried: (p) => `${p} ناشر يتعرّف عليه Ask لكنه لا يتضمّنه، لذلك لم يُبحث في تقاريره. ولم تُستخدم تقارير ناشرين آخرين بدلًا منه.`,
  unrecognised: (p) => `لم يتمكّن Ask من تحديد الناشر المقصود بـ ${q(p)}، لذلك لم يُبحث في أي مصدر.`,
  carriedOnly: (p) => `جرى البحث في ${p} فقط، كما طلبت.`,
  askWithout: (p) => `اسأل مجددًا من دون ${p}`,
  withoutDraft: (t) => `ما أحدث التقارير عن ${t}؟`,
  searchedAs: (s, a) => `جرى البحث باسم ${s} (كتبت ${a}).`,
};

const BY_LOCALE: Readonly<Record<string, AskPublisherStrings>> = { en: EN, pl: PL, de: DE, fr: FR, es: ES, pt: PT, ar: AR };
export const ASK_PUBLISHER_LOCALES = ['en', 'pl', 'de', 'fr', 'es', 'pt', 'ar'] as const;

export function askPublisherStrings(locale: DisplayLocale | string): AskPublisherStrings {
  return BY_LOCALE[String(locale).slice(0, 2)] ?? EN;
}
