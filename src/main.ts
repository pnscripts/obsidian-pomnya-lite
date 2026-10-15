import { App, ItemView, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, debounce, getAllTags, normalizePath } from "obsidian";
import { addDays, fromDate } from "./core/dates";
import { Person, Upcoming, isPerson, toPerson, upcoming } from "./core/people";
import { Lang, longDate, shortDate, t, whenText } from "./i18n";

export const VIEW_TYPE = "pomnya-lite-view";

export interface LiteSettings {
	language: "auto" | "en" | "bg";
	peopleFolder: string;
	peopleTag: string;
	daysAhead: number;
	notifyOnStartup: boolean;
}

export const DEFAULTS: LiteSettings = { language: "auto", peopleFolder: "People", peopleTag: "person", daysAhead: 14, notifyOnStartup: true };

export function describe(u: Upcoming, lang: Lang): string {
	if (u.kind === "birthday") return t("birthday", lang) + (u.years !== undefined ? `, ${t("turns", lang, { n: u.years })}` : "");
	return (u.title || t("anniversary", lang)) + (u.years !== undefined ? `, ${t("years", lang, { n: u.years })}` : "");
}

export class LiteView extends ItemView {
	constructor(leaf: WorkspaceLeaf, private plugin: PomnyaLitePlugin) {
		super(leaf);
	}
	getViewType(): string {
		return VIEW_TYPE;
	}
	getDisplayText(): string {
		return "Pomnya Lite";
	}
	getIcon(): string {
		return "cake";
	}
	async onOpen(): Promise<void> {
		this.render();
	}
	render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("pomnya-lite");
		const lang = this.plugin.lang();
		const today = fromDate(this.plugin.now());
		el.createDiv({ cls: "pomnya-lite-date", text: longDate(today, lang) });
		const todays = upcoming(today, 1, this.plugin.people);
		if (!todays.length) el.createDiv({ cls: "pomnya-lite-muted", text: t("nothingToday", lang) });
		for (const u of todays) this.row(el, u, lang, false);
		el.createDiv({ cls: "pomnya-lite-label", text: t("upcoming", lang) });
		const days = this.plugin.settings.daysAhead;
		const next = upcoming(addDays(today, 1), days, this.plugin.people).map((u) => ({ ...u, inDays: u.inDays + 1 }));
		if (!next.length) el.createDiv({ cls: "pomnya-lite-muted", text: t("nothingUpcoming", lang, { n: days }) });
		for (const u of next) this.row(el, u, lang, true);
		el.createDiv({ cls: "pomnya-lite-foot", text: t("people", lang, { n: this.plugin.people.length }) });
	}
	private row(el: HTMLElement, u: Upcoming, lang: Lang, when: boolean): void {
		const r = el.createDiv({ cls: `pomnya-lite-row pomnya-lite-${u.kind}` });
		if (when) r.createSpan({ cls: "pomnya-lite-when", text: `${shortDate(u.date, lang)} · ${whenText(u.inDays, lang)}` });
		const what = r.createSpan();
		const a = what.createEl("a", { cls: "pomnya-lite-person", text: u.person.name, attr: { href: "#", "data-path": u.person.path } });
		a.addEventListener("click", (e) => {
			e.preventDefault();
			const f = this.app.vault.getAbstractFileByPath(u.person.path);
			if (f instanceof TFile) void this.app.workspace.getLeaf(false).openFile(f);
		});
		what.createSpan({ cls: "pomnya-lite-extra", text: ` ${describe(u, lang)}` });
	}
}

export default class PomnyaLitePlugin extends Plugin {
	settings: LiteSettings = { ...DEFAULTS };
	people: Person[] = [];
	now: () => Date = () => new Date();

	async onload(): Promise<void> {
		this.settings = { ...DEFAULTS, ...((await this.loadData()) as Partial<LiteSettings> | null) };
		this.registerView(VIEW_TYPE, (leaf) => new LiteView(leaf, this));
		this.addRibbonIcon("cake", "Pomnya Lite", () => this.activate());
		this.addCommand({ id: "open", name: t("openView", this.lang()), callback: () => this.activate() });
		this.addSettingTab(new LiteSettingTab(this.app, this));
		const refresh = debounce(() => this.refresh(), 500, true);
		this.registerEvent(this.app.metadataCache.on("changed", refresh));
		this.registerEvent(this.app.vault.on("rename", refresh));
		this.registerEvent(this.app.vault.on("delete", refresh));
		this.app.workspace.onLayoutReady(() => {
			this.refresh();
			const lang = this.lang();
			const list = upcoming(fromDate(this.now()), 1, this.people);
			if (this.settings.notifyOnStartup && list.length) new Notice(t("noticeToday", lang, { list: list.map((u) => `${u.person.name} (${describe(u, lang)})`).join(", ") }));
		});
	}

	lang(): Lang {
		if (this.settings.language !== "auto") return this.settings.language;
		const app = (typeof window !== "undefined" && window.localStorage?.getItem("language")) || (typeof navigator !== "undefined" ? navigator.language : "en");
		return String(app).toLowerCase().startsWith("bg") ? "bg" : "en";
	}

	refresh(): void {
		const rules = { folder: normalizePath(this.settings.peopleFolder || ""), tag: this.settings.peopleTag };
		const out: Person[] = [];
		for (const f of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(f);
			const input = { path: f.path, basename: f.basename, frontmatter: cache?.frontmatter, tags: cache ? getAllTags(cache) ?? [] : [] };
			if (isPerson(input, rules)) out.push(toPerson(input));
		}
		this.people = out.sort((a, b) => a.name.localeCompare(b.name));
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) (leaf.view as LiteView).render();
	}

	async activate(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.refresh();
	}
}

class LiteSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: PomnyaLitePlugin) {
		super(app, plugin);
	}
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = async () => this.plugin.saveSettings();
		new Setting(containerEl).setName("Language").addDropdown((d) => d.addOptions({ auto: "Auto", en: "English", bg: "Български" }).setValue(s.language).onChange(async (v) => {
			s.language = v as LiteSettings["language"];
			await save();
		}));
		new Setting(containerEl).setName("People folder").setDesc("Notes in this folder are people. Empty: by tag only, or any note with a birthday.").addText((x) => x.setValue(s.peopleFolder).onChange(async (v) => {
			s.peopleFolder = v.trim();
			await save();
		}));
		new Setting(containerEl).setName("People tag").setDesc("Notes with this tag are people too, for example person.").addText((x) => x.setValue(s.peopleTag).onChange(async (v) => {
			s.peopleTag = v.trim().replace(/^#/, "");
			await save();
		}));
		new Setting(containerEl).setName("Days ahead").addText((x) => x.setValue(String(s.daysAhead)).onChange(async (v) => {
			const n = Number(v);
			if (n >= 1 && n <= 366) {
				s.daysAhead = Math.round(n);
				await save();
			}
		}));
		new Setting(containerEl).setName("Notice when Obsidian opens").addToggle((x) => x.setValue(s.notifyOnStartup).onChange(async (v) => {
			s.notifyOnStartup = v;
			await save();
		}));
	}
}
