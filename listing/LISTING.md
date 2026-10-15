# Pomnya Lite: Obsidian community plugin submission

Status 2026-10-15: the repository is **public** (https://github.com/pnscripts/obsidian-pomnya-lite), GitHub release `1.0.0` (no "v", equals the manifest version) with `main.js`, `manifest.json`, `styles.css`: https://github.com/pnscripts/obsidian-pomnya-lite/releases/tag/1.0.0. The id `pomnya-lite` and the name are free (checked against the 8,982 entries of community-plugins.json on 2026-10-15). README, LICENSE, manifest.json, versions.json are at the repo root.

**The pull-request route is gone.** `obsidianmd/obsidian-releases` is now only an hourly mirror of community.obsidian.md; new plugins are submitted on the directory site (docs.obsidian.md/Plugins/Releasing/Submit+your+plugin, read 2026-10-15). Review is automatic. Steps (browser):

1. Sign in at https://community.obsidian.md with an Obsidian account (office@pnscripts.com).
2. Profile: link the GitHub account that controls `pnscripts/obsidian-pomnya-lite` (the directory verifies repo ownership through it).
3. "Add a plugin or theme" ("Set up and claim") → repository `pnscripts/obsidian-pomnya-lite`. The directory reads `manifest.json` from the HEAD of `main` and the files from the release whose tag equals the version.
4. Fix anything the automated review lists, then publish a new release with an incremented version (bump `manifest.json` and `versions.json`, `make release`, release tag = version).
5. When it is listed, set the URL on Pomnya's pnscripts.com page (Get it on, Obsidian community, edition lite).

Checks run here: `tsc`, 5 vitest tests on a stand-in for the Obsidian API (the built main.js loaded as Obsidian loads it), manifest/versions consistency, no "Obsidian" in the description, command name without the plugin name, no default hotkeys, no innerHTML. Not run inside the Obsidian app.
