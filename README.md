# The Chronicles of Data - Act I

A browser-playable creature RPG with the complete **Act I: Harvest Village: The Broken Forecast**, implemented from `ACT1.docx` in the existing buildless game. Recover historical rainfall records, activate the DataDex, meet three starters, train with a borrowed Cloudfin, and help the council reopen the northern road. The existing **Nocturnal Mystery** in Twin Scholars' Forest remains playable afterward.

The document's suggested Godot project is an architectural proposal; this implementation extends the repository's existing HTML, CSS, and JavaScript engine. No installation or build is needed. Its 30-40 minute pacing is a design target, not a measured playtest result.

## Collaboration basics

Install Git and accept the repository invitation first. Replace `my-feature` with your own branch name.

**1. Clone the project (once)**

```text
git clone https://github.com/gerryhzg/THE_CHRONICLES_OF_DATA.git
cd THE_CHRONICLES_OF_DATA
```

Run the remaining commands inside this folder.

**2. Create your branch from the latest main**

```text
git switch main
git pull --ff-only origin main
git switch -c my-feature
```

To return to an existing branch, use `git switch my-feature`.

**3. Save your changes as a commit**

```text
git status
git add .
git commit -m "Describe your changes"
```

Review the files listed by `git status` before adding them.

**4. Pull from main before every push**

Commit your work first, then pull the latest `main` into your branch:

```text
git switch my-feature
git pull --no-rebase --no-edit origin main
```

This merges GitHub's `main` into your current branch. If Git reports conflicts, resolve them, stage the resolved files, and commit the merge before pushing. Ask a teammate if you need help.

**5. Push your branch to GitHub**

```text
git push -u origin my-feature
```

For later commits on that branch, pull from `main` again before pushing:

```text
git pull --no-rebase --no-edit origin main
git push
```

**6. Open a pull request**

On [GitHub](https://github.com/gerryhzg/THE_CHRONICLES_OF_DATA), select **Pull requests**, then **New pull request**. Choose **base: main** and **compare: my-feature**, add a title and description, then click **Create pull request**.

To update your pull request, commit your changes, repeat step 4, then push to the same branch. After it is merged, repeat step 2 with a new branch name for your next task.

## Run locally

Install Node.js 22 or later, then run from this folder:

```powershell
npm.cmd start
```

Open **http://127.0.0.1:4173** in a modern browser. Keep the terminal open while playing; press Ctrl+C to stop the server. No dependencies or build step are needed. On PowerShell, `npm.cmd` avoids the execution-policy restriction that can affect `npm.ps1`.

If this game is already running, `npm.cmd start` prints its existing URL. If another application uses the starting port, the server tries the next available port and prints the correct URL. Use that printed address. `PORT` can set a different starting port; browser saves belong to each exact address, so export/import when changing ports.

## Deploy to Vercel

The root `vercel.json` configures this project as a static site and publishes the ready-to-use `dist/` folder. Commit and push this file to the GitHub branch connected to Vercel, using the collaboration steps above.

In your Vercel project's **Settings → Build and Deployment**, use:

| Setting | Value |
| --- | --- |
| Root Directory | Repository root (leave blank or `./`) |
| Framework Preset | Other |
| Build Command | Empty (no build step) |
| Output Directory | `dist` |

The configuration file supplies the framework, build, and output settings. Keep Root Directory at the repository root so Vercel can read it. `npm start` runs the local preview server; Vercel serves the static files directly.

Deploy the new commit, then open the production URL without a trailing comma: **https://thechroniclesofdata.vercel.app/**. Redeploying an older commit will not include the new configuration. If `/dist/index.html` works but `/` returns 404, the deployment is still serving the repository root rather than `dist`.

## Controls

| Action | Control |
| --- | --- |
| Walk | WASD, arrow keys, or click an open map tile |
| Talk, observe, or enter | E, Space, Interact, or click a place |
| Choose a destination | Help → Places to visit |
| Open DataDex after activation | X or the DataDex button |
| Quest journal | J, Q, or the journal button; use Q with IJKL movement |
| Save and load | P or Save & load |
| View objectives, directions, and hints | Quest journal in the field journal |
| Close a dialog | Escape or its close button |

Touch controls appear on small screens. Battles use buttons and pause movement. Dialog buttons support Tab and Enter; Escape returns from save or DataDex to an unfinished battle.

Battle commands are grouped into **Skills**, **Tactics & supplies**, and **Switch partner**. Every card explains its effect, cost, turn timing, and limitations; unavailable commands show why. Select a card to highlight it and review the action, then press its **Use** button to perform it. Selecting, changing, or canceling a selection spends no turn or supplies. Tab and Enter/Space work with the cards and confirmation button. The menu reports your last action after it resolves. Attack power describes the skill's strength; actual HP damage depends on Databeast stats and guarding.

In battle, your Databeast and its messages stay on the left; the enemy and its messages stay on the right. Each action names its actor and target, with explicit HP, healing, Focus, and guard outcomes. The battle log sits below the creatures, groups events by turn in action order, and scrolls from oldest to newest. Focus the log with Tab to review earlier events using the keyboard. The result screen keeps a recap of the finishing turn. Existing saves retain their original messages as earlier history.

Battle results show EXP immediately: the active partner earns **30 EXP** for a rival win or **18 EXP** for a wild win or successful bond. Defeats and leaving award **0 EXP**. Party cards and your battle panel show stored EXP and the amount needed for the next level. Each level requires `current level × 20` EXP, carries the remainder forward, and adds **3 maximum HP**; attack strength increases every third level. Results list every level gained and its actual stat improvements. The current roster starts with all its skills available. Level **50** is the maximum; its display shows the cap instead of a next-level target. EXP and levels are saved automatically; reloading returns to the saved progress without awarding the battle again.

Story conversations show one dialogue segment at a time alongside the speaker's name, role, and portrait. Click **Next**, or press **Enter**, **Space**, or **E** to advance. **Back** revisits the previous segment; Tab and Enter also operate the Back button. Holding a key does not skip lines or automatically select a newly revealed choice. Expressions change with the conversation, and gameplay options appear on its final segment. Escape closes the conversation; reopening starts from its first segment. Character portraits include Lyra, Kai, Inferra, Rowan, the ranger, the player, and the DataDex.

Every visit to Professor Inferra opens her portrait conversation, including return visits during fieldwork, evidence review, and after the investigation. Her dialogue reflects your observation count and discoveries. Hints, finding corrections, and mastery feedback use the same controls; a retry returns to the sampling choices after you finish her feedback.

### Spoken dialogue

Click **Enable voice** in a conversation, or **Voices off** in the footer, to turn on spoken dialogue. Voices start off, and your choice is remembered in this browser separately from your game save and sound effects.

- Only the displayed segment is read aloud. Characters have their own voice, pace, and pitch settings.
- **Replay** reads the current line again. **Skip voice** stops its audio and leaves the text in place.
- **Next**, **Back**, and the usual dialogue keys work immediately. Moving to another segment or closing the conversation stops the previous audio; playback never advances dialogue automatically.

Speech uses the [browser's built-in speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). Available voices vary by browser and device. The game uses distinct English voices where available and falls back to the default voice with character-specific pace and pitch. If speech is unavailable or fails, all text and game controls still work; **Replay** can retry a failed line. Hiding the game stops the current voice; return and press **Replay** to hear it again.

### Background music

Seven instrumental themes accompany the game: **Lanterns of Harvest** in the village, **Paths Between Leaves** in the forest, **Moonlit Field Notes** at night, **Partners in Motion** in battle, **The Missing Observation** during key investigation scenes, **A Finding to Share** for victories and discoveries, and **Shelter and Embers** for rest. Each scene plays its corresponding MP3 from `dist/music/`: `village.mp3`, `forest.mp3`, `night.mp3`, `battle.mp3`, `mystery.mp3`, `celebration.mp3`, and `rest.mp3`. Tracks load and decode on first use, then loop and remain cached for return visits during the session. Playback uses no external music service. If an MP3 cannot load or decode, that scene's original generated theme provides a backup.

Music starts at **30%** after your first click, tap, or key press, subject to browser audio permission. **Music on/off** and the **Music volume** slider appear in the footer and inside dialogs, so music can be adjusted during battles and conversations. **Voices** and **Effects** have separate controls. Music preferences are remembered in this browser independently of game saves. At zero volume or while muted, no music plays; **Retry music** appears if the browser interrupts playback.

Scene changes crossfade over one second. Opening save or DataDex during battle keeps the battle theme. Dialogue lowers the music, and spoken narration lowers it further; finishing or skipping narration returns to the quieter dialogue level until the conversation closes. Hiding or leaving the page pauses playback; returning resumes an already-started soundtrack when the browser permits it.

## Complete Act I walkthrough

1. **The broken forecast.** Name your Observer and follow the in-engine village scene. The Oracle predicts 0 mm; the gauge records 46 mm. Every line has subtitles and waits for you. Visit Lyra's laboratory and accept **The Missing Rainfall Records**.
2. **Recover three originals, in any order.** At Mara's farm, move the damaged crate and preserve the ledger. At Bram's riverbank, follow the ripples, part the reeds, and retrieve the sheet. In Nell's shop, inspect the receipt, potion box, and tower-stamped document, then collect the register. Field interactions and pickups are separate saved steps.
3. **Compare at the Weather Tower.** Orin's three reading panels show original historical rainfall of 12, 28, and 7 mm against Archive copies of 0 mm. Slide and inspect each pair, then complete the comparison. Today's 46 mm storm is displayed separately. Hear Lyra's discovery and explicitly accept the **DataDex**, research tracking, and 50 supply coins. The discrepancies establish unreliable copies; their cause remains unknown.
4. **The First Bond.** Return to Lyra's laboratory. Help Statifox inspect a faulty sensor, Algobear align a gear, and Terradeer examine wet roots. Watch all three, inspect their stats, and confirm one starter. Previewing does not select a companion. Any starter can complete the story.
5. **Practice with Kai.** Lyra lends a temporary Cloudfin. Use an attack, Guard, the free DataDex Scan, and Switch, then finish the match. The practice opponent cannot be defeated before all four actions are tried. Cloudfin returns after the lesson; your permanent starter receives its first EXP. Defeat heals the team and allows another attempt. The Sanctuary offers free care and restocking.
6. **The village council.** Speak to Rowan in the square after the investigation and Kai's battle. Hear the council's decision to restore local observations, then commit to the expedition. **Act I complete** appears and Tomas permanently opens the northern gate.
7. **Depart when ready.** Follow the northern road into Twin Scholars' Forest. You can return to the village at any time. Act I completion does not depend on recruiting Voltkit or any optional activity.

Optional village activities: retrieve the scarf near the old bridge and return it to the child for 15 coins; read the old Observer journal for an Archive Fragment; find the hidden supply chest for a potion; clear the flooded garden for 5 research points; and bond with a wild Voltkit in the village grass after Kai. Reading the journal and helping the garden after comparing the records advances historical observation to **mastered**. Rewards cannot be claimed twice. Nell sells potions for 12 coins, Bond Crystals for 20, and antidotes for 10. No Act I encounter inflicts poison, so antidotes are carried for later travel.

**Forest continuation:** Meet Inferra, accept her assignment, and record meadow, riverbank, and canopy in daylight and moonlight. Rest at Observer Camp to change time. Review all six categories and conclude that the ranger's canopy-at-night sample leaves out relevant habitats and times. Earn the Sampling Compass, then return to Lyra and explicitly share the field report. Sampling mastery and Voltkit recruitment remain optional. The rest of Chapter One is planned, as explained in the [quest-flow guide](docs/chapter-one-quest-flow.md).

### Accessibility and preferences

Help offers large text, instant/steady/slow dialogue reveal, WASD or IJKL movement with arrows always available, and separate **Adventure**, **Explorer**, and **Scholar** learning preferences. Explorer shows directions alongside the current objective; Scholar expands historical context. Every preference has the same story and available quests. **Standard** and **Relaxed** combat are selected separately between battles. A gradual dialogue line can be revealed immediately; enabling speech reveals it in full before narration. Character voices, music, and effects retain separate controls.

A standard connected gamepad supports stick/D-pad movement, A to interact or activate the focused control, B to close, Start to open the journal, and D-pad focus navigation in dialogs. Browser and device support varies. Reduced-motion preferences disable the opening camera pan and animated weather. The opening can be replayed through Help and skipped after its first completion.

## Save and load

Every successful game action autosaves, including movement, observations, and battle turns. Reloading the page resumes your latest browser save, including an unfinished battle. **Save & load** also offers **Save now**, **Load**, JSON **Export**, and **Import**. Export before starting a new journey if you want to keep the old one.

Saves are browser-local and belong to the exact site origin. Different browsers, private windows, ports, `localhost` versus `127.0.0.1`, and a hosted copy have separate storage. Export/import transfers progress between them. If browser storage is unavailable, keep a JSON export. Invalid or unsupported imports show an error and preserve the current game.

The save format is versioned (`schemaVersion: 1`) and uses stable species, habitat, and concept IDs. Supported save data is validated before loading. Earlier valid v1 saves gain Act I defaults and preserve observations, companions, and unfinished battles. Existing partners and unlocked forest access remain valid; older saves do not have to replay the new investigation. Fresh saves preserve every field interaction, compared record, demonstration, borrowed training partner, optional reward, and council decision. Future schema versions require an explicit migration; this prototype does not promise compatibility with unimplemented chapters.

## Create future quests

The reusable [Data Quest Design skill](skills/data-quest-design/SKILL.md) includes a quest template and guidance for story stakes, dependencies, evidence-based gameplay, hints, completion feedback, and save compatibility. It is also installed in the creator's Codex skills folder. For example:

```text
Use $data-quest-design to build The Last Delivery as the next quest after the Stage 1 field report.
```

Collaborators can read the tracked skill directly by asking Codex to use `skills/data-quest-design/SKILL.md`. Later quests are plans until explicitly implemented; the skill does not authorize publishing or expanding the requested scope.

## Development and verification

```powershell
npm.cmd run check
npm.cmd test
```

`check` validates the JavaScript syntax. Tests cover game rules, all starters, recruitment and retry paths, investigation completion, concept progression, save validation, and map reachability. A restricted environment may need permission for the Node test runner to spawn its process.

With the local server running and Microsoft Edge installed, an optional browser smoke test uses Edge’s standard debugging protocol with a fresh isolated profile:

```powershell
node scripts/act1-browser-smoke.mjs
```

It writes `artifacts/act1-browser-smoke.json` and Act I desktop/mobile screenshots. The original `node scripts/browser-smoke.mjs` also remains available as a broader regression pass using migrated prototype saves. Its speech checks use a mock browser API to verify text synchronization, interruptions, controls, and unavailable-browser behavior; they do not verify audible output or voice quality. Consult each report for its actual results.

Battle checks cover matching species on opposing sides, actor and target labels, turn order, damage and healing outcomes, keyboard access, desktop and mobile layout, and old and new save histories. Command checks cover descriptions, costs, disabled reasons, selection without spending resources, confirmation, and repeated keys. Battle screenshots are saved as `artifacts/battle-desktop.png` and `artifacts/battle-mobile.png`; command previews use `artifacts/battle-actions-desktop.png` and `artifacts/battle-actions-mobile.png`.

Progression checks cover EXP rewards, active-party attribution, threshold rollover, multiple levels, maximum HP and attack changes, the level cap, and save/reload consistency. Result screenshots use `artifacts/battle-exp-desktop.png` and `artifacts/battle-exp-mobile.png`.

Music tests cover MP3 loading and caching, late download and decode completion, generated backups, original rendered waveforms, scene priorities, crossfades, rapid transitions, volume and mute persistence, narration ducking, hidden-page pausing, and blocked-audio recovery. Browser checks exercise the real controls, decode all seven actual MP3s, and render procedural backup themes with native offline audio; headless checks do not verify audible speaker output. Local preview WAVs and a render report can be generated from `renderMusicSamples` in `dist/music-tracks.js`.

The game is buildless HTML, CSS, and JavaScript. `dist/act1-ui.js` presents village activities and record panels; `dist/preferences.js` keeps browser-local accessibility settings separate from quest progress. `dist/engine.js` contains serializable rules and save validation; `dist/quests.js` derives objectives, journey steps, and missing field categories from that state; `dist/world.js` contains maps and programmatically drawn pixel artwork; `dist/app.js` connects exploration, combat, investigation, and browser storage. `dist/dialogue.js` stores segmented conversations and navigation, while `dist/portraits.js` renders character portraits and expressions as accessible inline SVG. `dist/speech.js` manages optional spoken dialogue, character delivery, and the voice preference. `scripts/serve.mjs` serves the playable `dist/` folder. For dialogue contributions, see the [character voice guide](docs/character-voices.md).

The complete Act I and the existing forest investigation are playable. Later chapter regions, the remaining roster, evolutions, and the Oracle finale remain future work. Pixel scenery, weather effects, character portraits, and creature illustrations use the existing original code-native artwork system.
