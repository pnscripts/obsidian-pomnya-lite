# Pomnya Lite

Free Obsidian plugin by [PN Scripts](https://pnscripts.com): birthdays and anniversaries from the people
notes in your vault, in a sidebar with today and the coming days, and a notice when the app opens.
It only reads your notes and sends nothing anywhere.

## Use

1. Install from Community plugins (search "Pomnya Lite") or copy `main.js`, `manifest.json` and
   `styles.css` into `.obsidian/plugins/pomnya-lite/`, then turn it on.
2. Keep people in the folder `People`, or tag their notes `#person` (both can be changed in the
   settings), with properties:

   ```yaml
   ---
   birthday: 1990-10-17
   anniversary: 2015-10-15 Wedding
   ---
   ```

3. Click the cake icon in the ribbon, or run **Pomnya Lite: Open sidebar**.

Birthdays can be `1990-10-17`, `17.10.1990`, `--10-17` or `10-17` (no age shown without the year);
`born`, `birthdate` and `dob` work too. `anniversary` or `anniversaries` take one date or a list, with
a label after the date. 29 February birthdays show on 28 February in other years. Settings: language
(auto, English or Bulgarian), people folder, people tag, days ahead, notice at startup.

## Lite and full edition

Pomnya Lite is complete for birthdays and anniversaries. The paid edition,
[Pomnya](https://pnscripts.com/marketplace/obsidian-pomnya), adds keep-in-touch rhythms with a
Log contact command, a month calendar, code blocks for dashboards, commands that insert dates into
daily notes, and optional name days.

## Development

```
npm ci
npm run build     # main.js
npx vitest run    # 5 tests on a stand-in for the Obsidian API, including the built main.js
```

Tested on a stand-in for the Obsidian API with Obsidian's published types; not run inside the
Obsidian app during development. MIT licence. Made by PN Scripts (office@pnscripts.com); created
with AI assistance and checked with automated tests.
