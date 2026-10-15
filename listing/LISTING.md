# Pomnya Lite: Obsidian community plugin submission

Nothing has been submitted. The repository stays private until the coordinator publishes.

1. Make `github.com/pnscripts/obsidian-pomnya-lite` public (README, LICENSE, manifest.json, versions.json at the root).
2. `make release`, then create a GitHub release with the tag `1.0.0` (exactly the manifest version, no "v") and attach `dist/main.js`, `dist/manifest.json`, `dist/styles.css`.
3. Fork `obsidianmd/obsidian-releases`, add to the end of `community-plugins.json`:
   `{"id": "pomnya-lite", "name": "Pomnya Lite", "author": "PN Scripts", "description": "Birthdays and anniversaries from your people notes: today, the coming days and a notice at startup.", "repo": "pnscripts/obsidian-pomnya-lite"}`
   and open the pull request with the template filled in (it needs a GitHub account; the review bot checks the release and manifest).
4. When it is listed, set the URL on Pomnya's pnscripts.com page (Get it on, Obsidian community, edition lite).

Checks run here: `tsc`, 5 vitest tests on a stand-in for the Obsidian API (the built main.js loaded as Obsidian loads it), manifest/versions consistency, no "Obsidian" in the description, command name without the plugin name, no default hotkeys, no innerHTML. Not run inside the Obsidian app.
