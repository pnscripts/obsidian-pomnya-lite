import { Ymd, weekday } from "./core/dates";

export type Lang = "bg" | "en";

const MONTHS = {
	bg: ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"],
	en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const DAYS = {
	bg: ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"],
	en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
const SHORT_BG = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

export function longDate(a: Ymd, lang: Lang): string {
	return lang === "bg" ? `${DAYS.bg[weekday(a)]}, ${a.d} ${MONTHS.bg[a.m - 1]} ${a.y} г.` : `${DAYS.en[weekday(a)]} ${a.d} ${MONTHS.en[a.m - 1]} ${a.y}`;
}

export function shortDate(a: Ymd, lang: Lang): string {
	return lang === "bg" ? `${SHORT_BG[weekday(a)]} ${a.d} ${MONTHS.bg[a.m - 1].slice(0, 3)}` : `${DAYS.en[weekday(a)].slice(0, 3)} ${a.d} ${MONTHS.en[a.m - 1].slice(0, 3)}`;
}

const T = {
	today: ["Today", "Днес"],
	tomorrow: ["tomorrow", "утре"],
	inDays: ["in {n} days", "след {n} дни"],
	upcoming: ["Coming up", "Предстои"],
	nothingUpcoming: ["Nothing in the next {n} days.", "Нищо в следващите {n} дни."],
	nothingToday: ["Nothing today.", "Днес няма нищо."],
	birthday: ["birthday", "рожден ден"],
	anniversary: ["anniversary", "годишнина"],
	turns: ["turns {n}", "навършва {n}"],
	years: ["{n} years", "{n} години"],
	openView: ["Open sidebar", "Отвори панела"],
	noticeToday: ["Pomnya Lite: {list}", "Pomnya Lite: {list}"],
	people: ["{n} people", "{n} души"],
};

export function t(k: keyof typeof T, lang: Lang, vars: Record<string, string | number> = {}): string {
	let s = T[k][lang === "bg" ? 1 : 0];
	for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
	return s;
}

export function whenText(inDays: number, lang: Lang): string {
	return inDays === 0 ? t("today", lang).toLowerCase() : inDays === 1 ? t("tomorrow", lang) : t("inDays", lang, { n: inDays });
}
