import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { App, Notice } from "obsidian";
import { key, ymd } from "../src/core/dates";
import { parseYearly, upcoming, toPerson } from "../src/core/people";
import PomnyaLitePlugin, { LiteView, VIEW_TYPE } from "../src/main";
import { VAULT } from "./fixtures";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function load(settings: Record<string, unknown> = {}) {
	const app = new App({ ...VAULT });
	const plugin = new PomnyaLitePlugin(app as never, { id: "pomnya-lite", name: "Pomnya Lite", version: "1.0.0" } as never);
	plugin.now = () => new Date(2026, 9, 15, 9);
	await plugin.saveData({ language: "en", ...settings });
	await plugin.onload();
	for (const cb of (app.workspace as unknown as { ready: (() => void)[] }).ready) cb();
	return { app, plugin };
}

beforeEach(() => {
	Notice.shown = [];
});

describe("Pomnya Lite", () => {
	it("reads dates the way people write them", () => {
		expect(parseYearly("17.10.1990")).toEqual({ m: 10, d: 17, y: 1990 });
		expect(parseYearly("--10-21")).toEqual({ m: 10, d: 21 });
		expect(parseYearly("2015-10-15 Wedding")).toEqual({ m: 10, d: 15, y: 2015, label: "Wedding" });
		const leap = toPerson({ path: "P/J.md", basename: "J", frontmatter: { birthday: "1988-02-29" } });
		expect(key(upcoming(ymd(2027, 2, 1), 28, [leap])[0].date)).toBe("2027-02-28");
	});

	it("shows today and the coming days, and a notice for today", async () => {
		const { app, plugin } = await load();
		expect(Notice.shown).toEqual(["Pomnya Lite: Mia and Tom Becker (Wedding, 11 years)"]);
		await plugin.activate();
		const view = app.workspace.getLeavesOfType(VIEW_TYPE)[0].view as LiteView;
		const rows = [...view.contentEl.querySelectorAll(".pomnya-lite-row")].map((r) => r.textContent);
		expect(rows).toEqual([
			"Mia and Tom Becker Wedding, 11 years",
			"Sat 17 Oct · in 2 daysAnna Schmidt birthday, turns 36",
			"Wed 21 Oct · in 6 daysLuca Rossi birthday",
			"Sat 24 Oct · in 9 daysLuca Rossi Started at Northwind, 8 years",
			"Wed 28 Oct · in 13 daysGrandma Rose birthday, turns 85",
		]);
		expect(view.contentEl.textContent).toContain("Thursday 15 October 2026");
	});

	it("in Bulgarian", async () => {
		const { app, plugin } = await load({ language: "bg" });
		await plugin.activate();
		expect(app.workspace.getLeavesOfType(VIEW_TYPE)[0].view!.contentEl.textContent).toContain("Anna Schmidt рожден ден, навършва 36");
	});

	it.skipIf(!existsSync(join(root, "main.js")))("the built main.js loads like Obsidian loads it", async () => {
		const out = join(root, "build", "test");
		mkdirSync(out, { recursive: true });
		const mock = join(out, "obsidian-mock.cjs");
		execFileSync(join(root, "node_modules/.bin/esbuild"), [join(root, "tests/mocks/obsidian.ts"), "--bundle", "--format=cjs", "--platform=node", `--outfile=${mock}`, "--log-level=error"]);
		writeFileSync(join(out, "package.json"), "{}");
		copyFileSync(join(root, "main.js"), join(out, "main.js"));
		const require = createRequire(import.meta.url);
		const M = Module as unknown as { _resolveFilename: (r: string, ...a: unknown[]) => string };
		const resolve = M._resolveFilename;
		M._resolveFilename = function (req: string, ...a: unknown[]) {
			return req === "obsidian" ? mock : resolve.call(this, req, ...a);
		};
		try {
			const obsidian = require(mock);
			obsidian.installDomHelpers(HTMLElement.prototype);
			const Plugin = require(join(out, "main.js")).default;
			const app = new obsidian.App(VAULT);
			const plugin = new Plugin(app, require(join(root, "manifest.json")));
			plugin.now = () => new Date(2026, 9, 15, 9);
			await plugin.onload();
			for (const cb of app.workspace.ready) cb();
			expect(plugin.people.length).toBe(8);
		} finally {
			M._resolveFilename = resolve;
		}
	});

	it("has the files the community list asks for", async () => {
		const manifest = (await import("../manifest.json", { with: { type: "json" } })).default;
		const versions = (await import("../versions.json", { with: { type: "json" } })).default as Record<string, string>;
		expect(manifest).toMatchObject({ id: "pomnya-lite", name: "Pomnya Lite", version: "1.0.0", author: "PN Scripts" });
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
		expect(manifest.description).not.toMatch(/Obsidian/);
		for (const f of ["README.md", "LICENSE", "styles.css"]) expect(existsSync(join(root, f))).toBe(true);
	});
});
