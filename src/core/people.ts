import { Ymd, addDays, diffDays, isLeap, key, parseYmd, ymd } from "./dates";

/** A yearly date: month and day, with the year it started when known. */
export interface Yearly {
	m: number;
	d: number;
	y?: number;
	label?: string;
}

/** A person from a note in your vault. */
export interface Person {
	path: string;
	name: string;
	firstName: string;
	birthday?: Yearly;
	anniversaries: Yearly[];
}

export interface PersonInput {
	path: string;
	basename: string;
	frontmatter?: Record<string, unknown>;
	tags?: string[];
}

export interface PeopleRules {
	folder: string; // notes in this folder (and below) are people
	tag: string; // or notes with this tag
}

const FIRST = ["first_name", "firstname", "given_name"];
const BIRTH = ["birthday", "born", "birthdate", "date_of_birth", "dob"];
const ANNIV = ["anniversary", "anniversaries", "dates"];

function asText(v: unknown): string {
	if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${v.getUTCMonth() + 1}-${v.getUTCDate()}`;
	return v === null || v === undefined ? "" : String(v).trim();
}

function field(fm: Record<string, unknown> | undefined, keys: string[]): unknown {
	if (!fm) return undefined;
	for (const [k, v] of Object.entries(fm)) if (keys.includes(k.toLowerCase().trim()) && asText(v) !== "") return v;
	return undefined;
}

/** 1985-03-14, 14.03.1985, 03/14/1985 is NOT read (ambiguous); --03-14 or 03-14 for a date without a year. */
export function parseYearly(s: string): Yearly | undefined {
	const text = s.trim();
	const full = parseYmd(text);
	if (full) return { m: full.m, d: full.d, y: full.y, label: text.replace(/^\S+\s*/, "").trim() || undefined };
	const m = /^(?:--)?(\d{1,2})-(\d{1,2})(?:\s+(.*))?$/.exec(text) ?? /^(\d{1,2})\.(\d{1,2})\.?(?:\s+(.*))?$/.exec(text);
	if (!m) return undefined;
	const [mo, d] = /^\d{1,2}\./.test(text) ? [+m[2], +m[1]] : [+m[1], +m[2]];
	const t = ymd(2024, mo, d);
	return t.m === mo && t.d === d ? { m: mo, d, label: m[3]?.trim() || undefined } : undefined;
}

export function isPerson(input: PersonInput, rules: PeopleRules): boolean {
	const folder = rules.folder.replace(/^\/+|\/+$/g, "");
	const inFolder = folder !== "" && input.path.startsWith(folder + "/");
	const tag = rules.tag.replace(/^#/, "").toLowerCase();
	const tagged = tag !== "" && (input.tags ?? []).some((t) => t.replace(/^#/, "").toLowerCase() === tag);
	if (inFolder || tagged) return true;
	// Without a folder or tag rule, any note with a birthday is a person.
	return folder === "" && tag === "" && (field(input.frontmatter, BIRTH) !== undefined);
}

export function toPerson(input: PersonInput): Person {
	const fm = input.frontmatter;
	const name = asText(fm?.["name"]) || input.basename;
	const firstName = asText(field(fm, FIRST)) || name.split(/[\s,]+/)[0] || "";
	const birthday = field(fm, BIRTH);
	const anniv = field(fm, ANNIV);
	return {
		path: input.path,
		name,
		firstName,
		birthday: birthday !== undefined ? parseYearly(asText(birthday)) : undefined,
		anniversaries: (Array.isArray(anniv) ? anniv : anniv !== undefined ? [anniv] : []).map((a) => parseYearly(asText(a))).filter((a): a is Yearly => !!a),
	};
}

export type EventKind = "birthday" | "anniversary";

export interface Upcoming {
	date: Ymd;
	kind: EventKind;
	person: Person;
	title: string; // anniversary label
	years?: number; // age or years since
	inDays: number;
}

function onYear(y: Yearly, year: number): Ymd {
	const d = y.m === 2 && y.d === 29 && !isLeap(year) ? 28 : y.d;
	return ymd(year, y.m, d);
}

/** Birthdays and anniversaries from `from` for `days` days. */
export function upcoming(from: Ymd, days: number, people: Person[]): Upcoming[] {
	const to = addDays(from, days - 1);
	const out: Upcoming[] = [];
	const push = (u: Omit<Upcoming, "inDays">) => {
		const inDays = diffDays(from, u.date);
		if (inDays >= 0 && inDays < days) out.push({ ...u, inDays });
	};
	for (let year = from.y; year <= to.y; year++) {
		for (const p of people) {
			if (p.birthday) push({ date: onYear(p.birthday, year), kind: "birthday", person: p, title: "", years: p.birthday.y ? year - p.birthday.y : undefined });
			for (const a of p.anniversaries) push({ date: onYear(a, year), kind: "anniversary", person: p, title: a.label ?? "", years: a.y ? year - a.y : undefined });
		}
	}
	const order: Record<EventKind, number> = { birthday: 0, anniversary: 1 };
	return out.sort((a, b) => a.inDays - b.inDays || order[a.kind] - order[b.kind] || a.person.name.localeCompare(b.person.name));
}

export { key };
