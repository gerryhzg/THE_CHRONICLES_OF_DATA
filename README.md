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

## Controls

| Action | Control |
| --- | --- |
| Walk | WASD, arrow keys, or click an open map tile |
| Talk, observe, or enter | E, Space, Interact, or click a place |
| Choose a destination | Help → Places to visit |
| Open DataDex | X or the DataDex button |
| Save and load | P or Save & load |
| Close a dialog | Escape or its close button |

Touch controls appear on small screens. Battles use buttons and pause movement. Dialog buttons support Tab and Enter; Escape returns from save or DataDex to an unfinished battle.

Story conversations show one dialogue segment at a time alongside the speaker's name, role, and portrait. Click **Next**, or press **Enter**, **Space**, or **E** to advance. **Back** revisits the previous segment; Tab and Enter also operate the Back button. Holding a key does not skip lines or automatically select a newly revealed choice. Expressions change with the conversation, and gameplay options appear on its final segment. Escape closes the conversation; reopening starts from its first segment. Character portraits include Lyra, Kai, Inferra, Rowan, the ranger, the player, and the DataDex.

Every visit to Professor Inferra opens her portrait conversation, including return visits during fieldwork, evidence review, and after the investigation. Her dialogue reflects your observation count and discoveries. Hints, finding corrections, and mastery feedback use the same controls; a retry returns to the sampling choices after you finish her feedback.

## Complete Stage 1 walkthrough

1. Begin your journey and choose **Statifox**, **Algobear**, or **Terradeer**. If you choose to explore first, visit Lyra’s Lab to choose your companion. Every starter can complete the prototype.
2. Visit **Kai** in the village square and accept his friendly battle. Use the free **Scan**, then attack. Guard restores Focus and reduces damage; potions heal. Winning unlocks the eastern forest gate and heals your party. A defeat also heals your team so you can retry.
3. Visit the **Weather Tower** to read the evidence contradicting the Oracle’s forecast. Follow the eastern gate into **Twin Scholars’ Forest**.
4. Speak to **Professor Inferra** and begin **The Nocturnal Mystery**. The ranger recorded only the canopy at night and claims nearly every forest Databeast is nocturnal.
5. Visit **Sunlit Meadow**, **Riverbank**, and **High Canopy**, and press **Record in DataDex** at each. Visit **Observer Camp** and rest to switch between day and night, then record the same three habitats at the other time. You need all six habitat/time categories; existing observations remain recorded.
6. Open the investigation or return to Inferra. Compare the field notes and choose the conclusion that the ranger’s sample leaves out habitats and times. Incorrect findings can be revised, and Inferra offers progressively clearer hints. Completing the investigation awards the **Sampling Compass**, marks sampling bias **understood**, and records the discovery in your DataDex.
7. Optionally take the mastery challenge: select the plan that observes several habitats at different times using a consistent method. This advances the concept to **mastered**. The lesson distinguishes a broader sample from certainty about every creature.
8. Visit **Voltkit Glade**. Approach Voltkit, **Scan**, lower its HP with a basic attack, then use **Bond**. Avoid defeating it before bonding. If a crystal fails, try again; if you defeat it or leave the encounter, return for another attempt. Bonding adds Voltkit to your party and DataDex. The **Sanctuary** in Harvest Village provides free healing and replenishes potions and Bond Crystals.
9. Open **DataDex** to review seen and recruited species, knowledge stages, and the six field records. Completing the investigation and recruiting Voltkit finishes the Stage 1 adventure.

Return to Kai for a friendly rematch after recruiting Voltkit to try switching between companions.

## Save and load

Every successful game action autosaves, including movement, observations, and battle turns. Reloading the page resumes your latest browser save, including an unfinished battle. **Save & load** also offers **Save now**, **Load**, JSON **Export**, and **Import**. Export before starting a new journey if you want to keep the old one.

Saves are browser-local and belong to the exact site origin. Different browsers, private windows, ports, `localhost` versus `127.0.0.1`, and a hosted copy have separate storage. Export/import transfers progress between them. If browser storage is unavailable, keep a JSON export. Invalid or unsupported imports show an error and preserve the current game.

The save format is versioned (`schemaVersion: 1`) and uses stable species, habitat, and concept IDs. Supported save data is validated before loading. Future schema versions require an explicit migration; this prototype does not promise compatibility with unimplemented chapters.

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

It writes screenshots and a verification report under `artifacts/`. This README describes the checks available; consult their actual output for results.

The game is buildless HTML, CSS, and JavaScript. `dist/engine.js` contains serializable rules and save validation; `dist/world.js` contains maps and programmatically drawn pixel artwork; `dist/app.js` connects exploration, combat, investigation, and browser storage. `dist/dialogue.js` stores segmented conversations and navigation, while `dist/portraits.js` renders character portraits and expressions as accessible inline SVG. `scripts/serve.mjs` serves the playable `dist/` folder.

This is **Stage 1**, not the full Chapter One: later regions, the remaining quests and roster, evolutions, the Oracle finale, and a full chapter expansion framework remain future work. The pixel scenery and creature illustrations are original code-native prototype artwork.
