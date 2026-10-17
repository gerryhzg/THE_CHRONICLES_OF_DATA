# The Chronicles of Data — Stage 1

A browser-playable prototype based on **Chapter One: The Awakening of Data — The False Forecast**. It includes Harvest Village, one wilderness route in Twin Scholars’ Forest, three starter Databeasts, turn-based combat, Voltkit recruitment, and the complete **Nocturnal Mystery** sampling investigation. DataDex tracking and save/load are part of the core game.

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
| Open DataDex | X or the DataDex button |
| Save and load | P or Save & load |
| View objectives, directions, and hints | Quest journal in the field journal |
| Close a dialog | Escape or its close button |

Touch controls appear on small screens. Battles use buttons and pause movement. Dialog buttons support Tab and Enter; Escape returns from save or DataDex to an unfinished battle.

Battle commands are grouped into **Skills**, **Tactics & supplies**, and **Switch partner**. Every card explains its effect, cost, turn timing, and limitations; unavailable commands show why. Select a card to highlight it and review the action, then press its **Use** button to perform it. Selecting, changing, or canceling a selection spends no turn or supplies. Tab and Enter/Space work with the cards and confirmation button. The menu reports your last action after it resolves. Attack power describes the skill's strength; actual HP damage depends on Databeast stats and guarding.

In battle, your Databeast and its messages stay on the left; the enemy and its messages stay on the right. Each action names its actor and target, with explicit HP, healing, Focus, and guard outcomes. The battle log sits below the creatures, groups events by turn in action order, and scrolls from oldest to newest. Focus the log with Tab to review earlier events using the keyboard. The result screen keeps a recap of the finishing turn. Existing saves retain their original messages as earlier history.

Story conversations show one dialogue segment at a time alongside the speaker's name, role, and portrait. Click **Next**, or press **Enter**, **Space**, or **E** to advance. **Back** revisits the previous segment; Tab and Enter also operate the Back button. Holding a key does not skip lines or automatically select a newly revealed choice. Expressions change with the conversation, and gameplay options appear on its final segment. Escape closes the conversation; reopening starts from its first segment. Character portraits include Lyra, Kai, Inferra, Rowan, the ranger, the player, and the DataDex.

Every visit to Professor Inferra opens her portrait conversation, including return visits during fieldwork, evidence review, and after the investigation. Her dialogue reflects your observation count and discoveries. Hints, finding corrections, and mastery feedback use the same controls; a retry returns to the sampling choices after you finish her feedback.

### Spoken dialogue

Click **Enable voice** in a conversation, or **Voices off** in the footer, to turn on spoken dialogue. Voices start off, and your choice is remembered in this browser separately from your game save and sound effects.

- Only the displayed segment is read aloud. Characters have their own voice, pace, and pitch settings.
- **Replay** reads the current line again. **Skip voice** stops its audio and leaves the text in place.
- **Next**, **Back**, and the usual dialogue keys work immediately. Moving to another segment or closing the conversation stops the previous audio; playback never advances dialogue automatically.

Speech uses the [browser's built-in speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis). Available voices vary by browser and device. The game uses distinct English voices where available and falls back to the default voice with character-specific pace and pitch. If speech is unavailable or fails, all text and game controls still work; **Replay** can retry a failed line. Hiding the game stops the current voice; return and press **Replay** to hear it again.

## Complete Stage 1 walkthrough

1. Begin your journey and choose **Statifox**, **Algobear**, or **Terradeer**. If you choose to explore first, visit Lyra’s Lab to choose your companion. Every starter can complete the prototype.
2. Visit **Kai** in the village square and accept his friendly battle. Use the free **Scan**, then attack. Guard restores Focus and reduces damage; potions heal. Winning unlocks the eastern forest gate and heals your party. A defeat also heals your team so you can retry.
3. Visit the **Weather Tower** to read the evidence contradicting the Oracle’s forecast. Follow the eastern gate into **Twin Scholars’ Forest**.
4. Speak to **Professor Inferra** and begin **The Nocturnal Mystery**. The ranger recorded only the canopy at night and claims nearly every forest Databeast is nocturnal.
5. Visit **Sunlit Meadow**, **Riverbank**, and **High Canopy**, and press **Record in DataDex** at each. Visit **Observer Camp** and rest to switch between day and night, then record the same three habitats at the other time. You need all six habitat/time categories; existing observations remain recorded.
6. Open the investigation or return to Inferra. Compare the field notes and choose the conclusion that the ranger’s sample leaves out habitats and times. Incorrect findings can be revised, and Inferra offers progressively clearer hints. Completing the investigation awards the **Sampling Compass**, marks sampling bias **understood**, and records the discovery in your DataDex.
7. Return through the forest's western exit to **Harvest Village**, visit **Lyra's Lab**, read the report conversation, and choose **Share the field report**. Lyra and Rowan will plan broader weather observations. This completes the **Stage 1 main story**; it does not solve the entire Oracle mystery. **Quest journal** shows the next destination, why it matters, completion conditions, missing observation categories, and a button to walk toward the current objective.
8. Optionally take Inferra's mastery challenge: select the plan that observes several habitats at different times using a consistent method. This advances the concept to **mastered**. The lesson distinguishes a broader sample from certainty about every creature.
9. Optionally visit **Voltkit Glade** after Kai's battle. Approach Voltkit, **Scan**, lower its HP with a basic attack, then use **Bond**. Avoid defeating it before bonding. If a crystal fails, try again; if you defeat it or leave the encounter, return for another attempt. Bonding adds Voltkit to your party and DataDex. The **Sanctuary** in Harvest Village provides free healing and replenishes potions and Bond Crystals.

Recruitment and mastery can be completed before or after the report and never block the main story. Open **DataDex** to review discoveries and the six field records. See the [Chapter One quest-flow guide](docs/chapter-one-quest-flow.md) for the full fourteen-quest sequence and the distinction between playable and planned content.

Return to Kai for a friendly rematch after recruiting Voltkit to try switching between companions.

## Save and load

Every successful game action autosaves, including movement, observations, and battle turns. Reloading the page resumes your latest browser save, including an unfinished battle. **Save & load** also offers **Save now**, **Load**, JSON **Export**, and **Import**. Export before starting a new journey if you want to keep the old one.

Saves are browser-local and belong to the exact site origin. Different browsers, private windows, ports, `localhost` versus `127.0.0.1`, and a hosted copy have separate storage. Export/import transfers progress between them. If browser storage is unavailable, keep a JSON export. Invalid or unsupported imports show an error and preserve the current game.

The save format is versioned (`schemaVersion: 1`) and uses stable species, habitat, and concept IDs. Supported save data is validated before loading. Earlier valid v1 saves gain the new village-report flag automatically without losing observations, companions, or unfinished battles. An older completed investigation can continue by returning to Lyra. Future schema versions require an explicit migration; this prototype does not promise compatibility with unimplemented chapters.

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
node scripts/browser-smoke.mjs
```

It writes screenshots and a verification report under `artifacts/`. Speech checks use a mock browser audio API to verify text synchronization, interruptions, controls, and unavailable-browser behavior; they do not verify audible output or voice quality. This README describes the checks available; consult their actual output for results.

Battle checks cover matching species on opposing sides, actor and target labels, turn order, damage and healing outcomes, keyboard access, desktop and mobile layout, and old and new save histories. Command checks cover descriptions, costs, disabled reasons, selection without spending resources, confirmation, and repeated keys. Battle screenshots are saved as `artifacts/battle-desktop.png` and `artifacts/battle-mobile.png`; command previews use `artifacts/battle-actions-desktop.png` and `artifacts/battle-actions-mobile.png`.

The game is buildless HTML, CSS, and JavaScript. `dist/engine.js` contains serializable rules and save validation; `dist/quests.js` derives objectives, journey steps, and missing field categories from that state; `dist/world.js` contains maps and programmatically drawn pixel artwork; `dist/app.js` connects exploration, combat, investigation, and browser storage. `dist/dialogue.js` stores segmented conversations and navigation, while `dist/portraits.js` renders character portraits and expressions as accessible inline SVG. `dist/speech.js` manages optional spoken dialogue, character delivery, and the voice preference. `scripts/serve.mjs` serves the playable `dist/` folder. For dialogue contributions, see the [character voice guide](docs/character-voices.md).

This is **Stage 1**, not the full Chapter One: later regions, the remaining quests and roster, evolutions, the Oracle finale, and a full chapter expansion framework remain future work. The pixel scenery and creature illustrations are original code-native prototype artwork.
