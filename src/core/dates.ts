/** Plain calendar dates (no time zone surprises): year, month 1-12, day. */
export interface Ymd {
	y: number;
	m: number;
	d: number;
}

export function ymd(y: number, m: number, d: number): Ymd {
	const t = new Date(Date.UTC(y, m - 1, d));
	return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function fromDate(date: Date): Ymd {
	return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

export function addDays(a: Ymd, n: number): Ymd {
	return ymd(a.y, a.m, a.d + n);
}

/** 0 = Monday ... 6 = Sunday */
export function weekday(a: Ymd): number {
	return (new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay() + 6) % 7;
}

export function key(a: Ymd): string {
	return `${a.y}-${String(a.m).padStart(2, "0")}-${String(a.d).padStart(2, "0")}`;
}

export function parseYmd(s: string): Ymd | null {
	const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s.trim()) ?? /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s.trim());
	if (!m) return null;
	const [y, mo, d] = m[1].length === 4 ? [+m[1], +m[2], +m[3]] : [+m[3], +m[2], +m[1]];
	const r = ymd(y, mo, d);
	return r.y === y && r.m === mo && r.d === d ? r : null;
}

export function diffDays(a: Ymd, b: Ymd): number {
	return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function isLeap(y: number): boolean {
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
