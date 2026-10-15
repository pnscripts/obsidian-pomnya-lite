/**
 * An in-memory stand-in for the parts of the Obsidian API that Linkscour uses.
 * The metadata cache parses Markdown the way Obsidian reports it: links,
 * embeds, frontmatter links, headings, blocks and tags, with offsets.
 * Used by the tests (through a module alias) and by the gallery harness.
 */

/* ----- DOM helpers Obsidian adds to HTMLElement ------------------------- */

type ElInfo = { cls?: string; text?: string; type?: string; placeholder?: string; attr?: Record<string, string> };

declare global {
	interface HTMLElement {
		createEl<K extends keyof HTMLElementTagNameMap>(tag: K, o?: ElInfo | string): HTMLElementTagNameMap[K];
		createDiv(o?: ElInfo | string): HTMLDivElement;
		createSpan(o?: ElInfo | string): HTMLSpanElement;
		empty(): void;
		setText(text: string): void;
		addClass(...cls: string[]): void;
		removeClass(...cls: string[]): void;
	}
}

function make<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, o?: ElInfo | string) {
	const el = parent.ownerDocument.createElement(tag);
	const info: ElInfo = typeof o === "string" ? { cls: o } : o ?? {};
	if (info.cls) el.className = info.cls;
	if (info.text !== undefined) el.textContent = info.text;
	if (info.type) el.setAttribute("type", info.type);
	if (info.placeholder) el.setAttribute("placeholder", info.placeholder);
	for (const [k, v] of Object.entries(info.attr ?? {})) el.setAttribute(k, v);
	parent.appendChild(el);
	return el;
}

export function installDomHelpers(proto: HTMLElement = HTMLElement.prototype): void {
	proto.createEl = function (tag, o) {
		return make(this, tag, o);
	} as HTMLElement["createEl"];
	proto.createDiv = function (o) {
		return make(this, "div", o);
	};
	proto.createSpan = function (o) {
		return make(this, "span", o);
	};
	proto.empty = function () {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
	proto.setText = function (text) {
		this.textContent = text;
	};
	proto.addClass = function (...cls) {
		this.classList.add(...cls);
	};
	proto.removeClass = function (...cls) {
		this.classList.remove(...cls);
	};
}
if (typeof HTMLElement !== "undefined") installDomHelpers();

/* ----- files ------------------------------------------------------------ */

export class TAbstractFile {
	vault!: Vault;
	constructor(public path: string) {}
	get name(): string {
		return this.path.split("/").pop() ?? this.path;
	}
	get parent(): TFolder | null {
		const i = this.path.lastIndexOf("/");
		return new TFolder(i < 0 ? "/" : this.path.slice(0, i));
	}
}

export class TFile extends TAbstractFile {
	stat = { ctime: 0, mtime: 0, size: 0 };
	get extension(): string {
		const i = this.name.lastIndexOf(".");
		return i > 0 ? this.name.slice(i + 1) : "";
	}
	get basename(): string {
		const i = this.name.lastIndexOf(".");
		return i > 0 ? this.name.slice(0, i) : this.name;
	}
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	isRoot(): boolean {
		return this.path === "/";
	}
}

/* ----- events ----------------------------------------------------------- */

export interface EventRef {
	name: string;
	fn: (...a: unknown[]) => unknown;
}

export class Events {
	private handlers = new Map<string, Set<(...a: unknown[]) => unknown>>();
	on(name: string, fn: (...a: unknown[]) => unknown): EventRef {
		if (!this.handlers.has(name)) this.handlers.set(name, new Set());
		this.handlers.get(name)!.add(fn);
		return { name, fn };
	}
	offref(ref: EventRef): void {
		this.handlers.get(ref.name)?.delete(ref.fn);
	}
	trigger(name: string, ...args: unknown[]): void {
		for (const fn of this.handlers.get(name) ?? []) fn(...args);
	}
}

/* ----- vault ------------------------------------------------------------ */

export class Vault extends Events {
	private data = new Map<string, string>();
	private folders = new Set<string>();
	private list: TFile[] | null = null;
	trashed: string[] = [];

	constructor(initial: Record<string, string> = {}) {
		super();
		for (const [p, c] of Object.entries(initial)) this.put(p, c);
	}

	private put(path: string, content: string): void {
		if (!this.data.has(path)) this.list = null;
		this.data.set(path, content);
		const parts = path.split("/");
		for (let i = 1; i < parts.length; i++) this.folders.add(parts.slice(0, i).join("/"));
	}

	private fileObj(path: string): TFile {
		const f = new TFile(path);
		f.vault = this;
		f.stat.size = this.data.get(path)?.length ?? 0;
		return f;
	}

	getFiles(): TFile[] {
		this.list ??= [...this.data.keys()].sort().map((p) => this.fileObj(p));
		return this.list;
	}

	getMarkdownFiles(): TFile[] {
		return this.getFiles().filter((f) => f.extension === "md");
	}

	getAbstractFileByPath(path: string): TAbstractFile | null {
		if (this.data.has(path)) return this.fileObj(path);
		if (this.folders.has(path)) return new TFolder(path);
		return null;
	}

	contents(path: string): string | undefined {
		return this.data.get(path);
	}

	async read(file: TFile): Promise<string> {
		return this.data.get(file.path) ?? "";
	}

	async cachedRead(file: TFile): Promise<string> {
		return this.read(file);
	}

	async modify(file: TFile, text: string): Promise<void> {
		this.put(file.path, text);
		this.trigger("modify", file);
	}

	async process(file: TFile, fn: (data: string) => string): Promise<string> {
		const next = fn(this.data.get(file.path) ?? "");
		await this.modify(file, next);
		return next;
	}

	async create(path: string, text: string): Promise<TFile> {
		if (this.data.has(path)) throw new Error("File already exists.");
		this.put(path, text);
		const f = this.fileObj(path);
		this.trigger("create", f);
		return f;
	}

	async createFolder(path: string): Promise<void> {
		this.folders.add(path);
	}

	async delete(file: TAbstractFile): Promise<void> {
		this.data.delete(file.path);
		this.list = null;
		this.trigger("delete", file);
	}
}

/* ----- metadata --------------------------------------------------------- */

export interface Loc {
	line: number;
	col: number;
	offset: number;
}
export interface Pos {
	start: Loc;
	end: Loc;
}
export interface LinkCache {
	link: string;
	original: string;
	displayText?: string;
	position: Pos;
}
export interface HeadingCache {
	heading: string;
	level: number;
	position: Pos;
}
export interface CachedMetadata {
	links?: LinkCache[];
	embeds?: LinkCache[];
	frontmatterLinks?: { key: string; link: string; original: string; displayText?: string }[];
	headings?: HeadingCache[];
	blocks?: Record<string, { id: string; position: Pos }>;
	tags?: { tag: string; position: Pos }[];
	frontmatter?: Record<string, unknown>;
}

function loc(text: string, offset: number): Loc {
	const before = text.slice(0, offset);
	const line = before.split("\n").length - 1;
	return { line, col: offset - (before.lastIndexOf("\n") + 1), offset };
}

/** Strip characters Obsidian ignores when matching headings. */
export function stripHeading(heading: string): string {
	return heading.replace(/[!"#$%&()*+,.:;<=>?@^`{|}~/[\]\\]/g, " ").replace(/\s+/g, " ").trim();
}

export function parseMarkdown(text: string): CachedMetadata {
	const cache: CachedMetadata = { links: [], embeds: [], headings: [], blocks: {}, tags: [], frontmatterLinks: [] };
	let body = text;
	let bodyStart = 0;
	const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (fm) {
		bodyStart = fm[0].length;
		body = text.slice(bodyStart);
		const front: Record<string, unknown> = {};
		let listKey: string | null = null;
		for (const line of fm[1].split("\n")) {
			const item = /^\s+-\s+(.*)$/.exec(line);
			if (item && listKey) {
				(front[listKey] as string[]).push(item[1].replace(/^["']|["']$/g, ""));
				continue;
			}
			const kv = /^([\w-]+):\s*(.*)$/.exec(line);
			if (!kv) continue;
			const [, k, v] = kv;
			if (v === "") {
				front[k] = [];
				listKey = k;
			} else if (v.startsWith("[") && !v.startsWith("[[")) {
				front[k] = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
				listKey = null;
			} else {
				front[k] = v.replace(/^["']|["']$/g, "");
				listKey = null;
			}
		}
		cache.frontmatter = front;
		for (const [k, v] of Object.entries(front)) {
			for (const value of Array.isArray(v) ? v : [v]) {
				const w = /^\[\[([^\]|]+)(\|[^\]]*)?\]\]$/.exec(String(value));
				if (w) cache.frontmatterLinks!.push({ key: k, link: w[1], original: String(value) });
			}
		}
	}
	// Blank out code so links in code are ignored, keeping offsets.
	const masked = body
		.replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, " "))
		.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
	const wiki = /(!?)\[\[([^\]\n]+?)\]\]/g;
	for (let m; (m = wiki.exec(masked)); ) {
		const inner = m[2];
		const [target, alias] = inner.split("|");
		const start = bodyStart + m.index;
		const entry: LinkCache = {
			link: target.trim(),
			original: text.slice(start, start + m[0].length),
			displayText: alias ?? target,
			position: { start: loc(text, start), end: loc(text, start + m[0].length) },
		};
		(m[1] ? cache.embeds! : cache.links!).push(entry);
	}
	const md = /(!?)\[([^\]\n]*)\]\((<[^>\n]*>|[^)\s]*)(\s+"[^"]*")?\)/g;
	for (let m; (m = md.exec(masked)); ) {
		let target = m[3];
		if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
		target = target.startsWith("<") ? target.slice(1, -1) : decodeURIComponent(target);
		const start = bodyStart + m.index;
		const entry: LinkCache = {
			link: target.replace(/\.md(#|$)/, "$1"),
			original: text.slice(start, start + m[0].length),
			displayText: m[2],
			position: { start: loc(text, start), end: loc(text, start + m[0].length) },
		};
		(m[1] ? cache.embeds! : cache.links!).push(entry);
	}
	const lines = body.split("\n");
	let offset = bodyStart;
	for (const line of lines) {
		const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
		if (h && masked.slice(offset - bodyStart, offset - bodyStart + line.length).trim() !== "") {
			cache.headings!.push({ heading: h[2], level: h[1].length, position: { start: loc(text, offset), end: loc(text, offset + line.length) } });
		}
		const b = /\s\^([A-Za-z0-9-]+)\s*$/.exec(line);
		if (b) cache.blocks![b[1].toLowerCase()] = { id: b[1], position: { start: loc(text, offset), end: loc(text, offset + line.length) } };
		for (const t of line.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)) {
			if (!h) cache.tags!.push({ tag: "#" + t[1], position: { start: loc(text, offset), end: loc(text, offset) } });
		}
		offset += line.length + 1;
	}
	return cache;
}

export class MetadataCache extends Events {
	private parsed = new Map<string, { text: string; cache: CachedMetadata }>();
	private names: { files: TFile[]; byName: Map<string, TFile[]> } | null = null;

	constructor(private vault: Vault) {
		super();
	}

	getFileCache(file: TFile): CachedMetadata | null {
		const text = this.vault.contents(file.path);
		if (text === undefined || file.extension !== "md") return null;
		const hit = this.parsed.get(file.path);
		if (hit && hit.text === text) return hit.cache;
		const cache = parseMarkdown(text);
		this.parsed.set(file.path, { text, cache });
		return cache;
	}

	private index() {
		const files = this.vault.getFiles();
		if (this.names?.files !== files) {
			const byName = new Map<string, TFile[]>();
			for (const f of files) {
				const k = f.name.toLowerCase();
				byName.set(k, [...(byName.get(k) ?? []), f]);
			}
			this.names = { files, byName };
		}
		return this.names;
	}

	/** Obsidian's rule in short: exact path first, then the closest file with that name. */
	getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
		const want = /\.[a-z0-9]+$/i.test(linkpath) ? linkpath : `${linkpath}.md`;
		const lower = want.toLowerCase();
		const named = this.index().byName.get(lower.split("/").pop() ?? lower) ?? [];
		const exact = named.find((f) => f.path.toLowerCase() === lower);
		if (exact) return exact;
		const dir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1) : "";
		const relative = named.find((f) => f.path.toLowerCase() === (dir + want).toLowerCase());
		if (relative) return relative;
		const byEnd = named.filter((f) => ("/" + f.path.toLowerCase()).endsWith("/" + lower));
		if (!byEnd.length) return null;
		const sameDir = byEnd.find((f) => f.path.startsWith(dir) && !f.path.slice(dir.length).includes("/"));
		return sameDir ?? byEnd.sort((a, b) => a.path.split("/").length - b.path.split("/").length || a.path.localeCompare(b.path))[0];
	}

	fileToLinktext(file: TFile, sourcePath: string, omitMdExtension = true): string {
		const name = omitMdExtension && file.extension === "md" ? file.basename : file.name;
		const same = this.index().byName.get(file.name.toLowerCase()) ?? [];
		if (same.length <= 1) return name;
		return omitMdExtension && file.extension === "md" ? file.path.replace(/\.md$/, "") : file.path;
	}
}

export function resolveSubpath(cache: CachedMetadata, subpath: string): { type: string } | null {
	if (subpath.startsWith("#^")) {
		const id = subpath.slice(2).toLowerCase();
		return cache.blocks?.[id] ? { type: "block" } : null;
	}
	const parts = subpath.split("#").filter(Boolean).map((p) => stripHeading(p).toLowerCase());
	const heads = cache.headings ?? [];
	let from = 0;
	let level = 0;
	for (const part of parts) {
		const i = heads.findIndex((h, idx) => idx >= from && h.level > level && stripHeading(h.heading).toLowerCase() === part);
		if (i < 0) return null;
		from = i + 1;
		level = heads[i].level;
	}
	return { type: "heading" };
}

export function getAllTags(cache: CachedMetadata): string[] | null {
	const out = (cache.tags ?? []).map((t) => t.tag);
	const fm = cache.frontmatter?.tags;
	for (const t of Array.isArray(fm) ? fm : fm ? [fm] : []) out.push("#" + String(t).replace(/^#/, ""));
	return out;
}

export function parseFrontMatterTags(fm: Record<string, unknown> | undefined): string[] | null {
	const t = fm?.tags;
	if (!t) return null;
	return (Array.isArray(t) ? t : [t]).map((x) => "#" + String(x).replace(/^#/, ""));
}

export function normalizePath(p: string): string {
	return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "").trim();
}

export function debounce<T extends (...a: never[]) => unknown>(fn: T): T & { cancel(): void } {
	const wrapped = ((...a: Parameters<T>) => fn(...a)) as T & { cancel(): void };
	wrapped.cancel = () => undefined;
	return wrapped;
}

/* ----- workspace and plugin -------------------------------------------- */

export class Editor {
	text = "";
	replaceSelection(t: string): void {
		this.text += t;
	}
}

export class MarkdownView {
	editor = new Editor();
	constructor(public file: TFile | null = null) {}
}

export class Notice {
	static shown: string[] = [];
	constructor(public message: string) {
		Notice.shown.push(message);
	}
}

export class Component {
	private refs: (() => void)[] = [];
	registerEvent(ref: EventRef): void {
		this.refs.push(() => undefined);
		void ref;
	}
}

export class View extends Component {
	app: App;
	containerEl: HTMLElement;
	contentEl: HTMLElement;
	constructor(public leaf: WorkspaceLeaf) {
		super();
		this.app = leaf.app;
		this.containerEl = document.createElement("div");
		this.contentEl = this.containerEl.createDiv({ cls: "view-content" });
	}
	getViewType(): string {
		return "";
	}
	async onOpen(): Promise<void> {}
}

export class ItemView extends View {}

export class WorkspaceLeaf {
	view: View | null = null;
	opened: { path: string; line: number }[] = [];
	constructor(public app: App) {}
	async setViewState(state: { type: string }): Promise<void> {
		const factory = this.app.workspace.factories.get(state.type);
		if (!factory) throw new Error("no view " + state.type);
		this.view = factory(this);
		this.app.workspace.leaves.push(this);
		await this.view.onOpen();
	}
	async openFile(file: TFile, state?: { eState?: { line?: number } }): Promise<void> {
		this.opened.push({ path: file.path, line: state?.eState?.line ?? 0 });
		this.app.workspace.lastOpened = { path: file.path, line: state?.eState?.line ?? 0 };
	}
}

export class Workspace extends Events {
	factories = new Map<string, (leaf: WorkspaceLeaf) => View>();
	leaves: WorkspaceLeaf[] = [];
	lastOpened: { path: string; line: number } | null = null;
	constructor(private app: App) {
		super();
	}
	getLeavesOfType(type: string): WorkspaceLeaf[] {
		return this.leaves.filter((l) => l.view?.getViewType() === type);
	}
	getRightLeaf(): WorkspaceLeaf {
		return new WorkspaceLeaf(this.app);
	}
	getLeaf(): WorkspaceLeaf {
		return new WorkspaceLeaf(this.app);
	}
	async revealLeaf(): Promise<void> {}
	activeFile: TFile | null = null;
	activeView: MarkdownView | null = null;
	ready: (() => void)[] = [];
	getActiveFile(): TFile | null {
		return this.activeFile;
	}
	getActiveViewOfType<T>(_t: unknown): T | null {
		return this.activeView as unknown as T;
	}
	onLayoutReady(cb: () => void): void {
		this.ready.push(cb);
	}
}

export class FileManager {
	constructor(private app: App) {}
	async trashFile(file: TAbstractFile): Promise<void> {
		this.app.vault.trashed.push(file.path);
		await this.app.vault.delete(file);
	}
	/** Obsidian rewrites the YAML; the stand-in writes simple "key: value" lines, enough for the tests. */
	async processFrontMatter(file: TFile, fn: (fm: Record<string, unknown>) => void): Promise<void> {
		const text = this.app.vault.contents(file.path) ?? "";
		const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
		const fm: Record<string, unknown> = m ? { ...(parseMarkdown(text).frontmatter ?? {}) } : {};
		fn(fm);
		const yaml = Object.entries(fm).map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${v}`)).join("\n");
		const body = m ? text.slice(m[0].length) : text;
		await this.app.vault.modify(file, `---\n${yaml}\n---\n${body}`);
	}
	getNewFileParent(): TFolder {
		return new TFolder("/");
	}
}

export class App {
	vault: Vault;
	metadataCache: MetadataCache;
	workspace: Workspace;
	fileManager: FileManager;
	constructor(files: Record<string, string> = {}) {
		this.vault = new Vault(files);
		this.metadataCache = new MetadataCache(this.vault);
		this.workspace = new Workspace(this);
		this.fileManager = new FileManager(this);
	}
}

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
}

export class Plugin extends Component {
	commands = new Map<string, { id: string; name: string; callback: () => unknown }>();
	settingTabs: PluginSettingTab[] = [];
	private stored: unknown = null;
	constructor(public app: App, public manifest: PluginManifest) {
		super();
	}
	async loadData(): Promise<unknown> {
		return this.stored;
	}
	async saveData(data: unknown): Promise<void> {
		this.stored = JSON.parse(JSON.stringify(data));
	}
	registerView(type: string, factory: (leaf: WorkspaceLeaf) => View): void {
		this.app.workspace.factories.set(type, factory);
	}
	addCommand(cmd: { id: string; name: string; callback: () => unknown }): void {
		this.commands.set(cmd.id, cmd);
	}
	addRibbonIcon(_icon: string, _title: string, _cb: () => unknown): HTMLElement {
		return document.createElement("div");
	}
	codeBlocks = new Map<string, (source: string, el: HTMLElement) => unknown>();
	registerMarkdownCodeBlockProcessor(lang: string, fn: (source: string, el: HTMLElement) => unknown): void {
		this.codeBlocks.set(lang, fn);
	}
	addSettingTab(tab: PluginSettingTab): void {
		this.settingTabs.push(tab);
	}
}

export class Modal {
	static opened: Modal[] = [];
	titleEl: HTMLElement;
	contentEl: HTMLElement;
	constructor(public app: App) {
		this.titleEl = document.createElement("div");
		this.contentEl = document.createElement("div");
	}
	open(): void {
		Modal.opened.push(this);
		this.onOpen();
	}
	close(): void {
		this.onClose();
	}
	onOpen(): void {}
	onClose(): void {}
}

type Handler<T> = (v: T) => unknown;
class Comp<T> {
	value!: T;
	handler: Handler<T> | null = null;
	setValue(v: T): this {
		this.value = v;
		return this;
	}
	onChange(h: Handler<T>): this {
		this.handler = h;
		return this;
	}
	async change(v: T): Promise<void> {
		this.value = v;
		await this.handler?.(v);
	}
}

export class Setting {
	static all: Setting[] = [];
	name = "";
	desc = "";
	components: Comp<unknown>[] = [];
	constructor(public containerEl: HTMLElement) {
		Setting.all.push(this);
	}
	setName(n: string): this {
		this.name = n;
		return this;
	}
	setDesc(d: string): this {
		this.desc = d;
		return this;
	}
	private add<T>(cb: (c: Comp<T>) => unknown): this {
		const c = new Comp<T>();
		cb(c);
		this.components.push(c as Comp<unknown>);
		return this;
	}
	addText(cb: (c: Comp<string>) => unknown): this {
		return this.add(cb);
	}
	addTextArea(cb: (c: Comp<string>) => unknown): this {
		return this.add(cb);
	}
	addDropdown(cb: (c: Comp<string> & { addOptions(o: Record<string, string>): Comp<string> & { setValue(v: string): Comp<string> } }) => unknown): this {
		return this.add<string>((c) => {
			const d = c as Comp<string> & { options?: Record<string, string>; addOptions(o: Record<string, string>): typeof d };
			d.addOptions = (o) => {
				d.options = o;
				return d;
			};
			cb(d);
		});
	}
	addToggle(cb: (c: Comp<boolean>) => unknown): this {
		return this.add(cb);
	}
}

export class PluginSettingTab {
	containerEl: HTMLElement;
	constructor(public app: App, public plugin: Plugin) {
		this.containerEl = document.createElement("div");
	}
	display(): void {}
}
