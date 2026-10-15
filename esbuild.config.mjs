import esbuild from "esbuild";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";
const banner = "/* Pomnya Lite by PN Scripts 1.0.0. MIT licence, (c) 2026 PN Scripts, https://pnscripts.com */";

const ctx = await esbuild.context({
	banner: { js: banner },
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtinModules],
	format: "cjs",
	target: "es2021",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
	charset: "utf8",
});
if (prod) {
	await ctx.rebuild();
	process.exit(0);
} else {
	await ctx.watch();
}
