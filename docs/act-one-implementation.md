# Act I implementation

`ACT1.docx` is the content reference for **Harvest Village: The Broken Forecast**. Its production proposals are implemented in the repository’s existing browser engine; the game has not been converted to Godot. The source’s 30–40 minute target still needs human pacing tests.

## Playable sequence

1. In-engine village panorama, changing weather, Oracle contradiction, and the Rowan–Lyra exchange. Subtitled manual dialogue preserves player control. Help offers replay and skipping after the first completion.
2. Lyra’s assignment and three recoverable historical records in any order. Each location has a saved object interaction before pickup: farm crate, river reeds, or three shop objects.
3. Orin’s Weather Tower comparison. Three illuminated reading panels compare matching cycle/day pairs, with the current storm kept separate. Each discrepancy must be inspected before completing the comparison.
4. Discovery dialogue, then an explicit DataDex reward. The historical observation entry records understanding without claiming the evidence proves deliberate tampering. Basic Observation and Scan unlock here; Pattern Sight remains a later reward.
5. Three interactive companion demonstrations. Stats can be previewed freely, then one level-5 starter is explicitly confirmed.
6. Kai’s Voltkit battle. A borrowed Cloudfin makes switching available. Attack, Guard, Scan, and switching are practiced before a final blow. The loan returns when the encounter ends, and the permanent starter receives the first victory EXP.
7. Rowan’s village council, explicit acceptance of the expedition, an Act I completion screen, and a permanently opened northern road. Forest travel and return preserve village state.

The village includes Mara, Orin, Nell, Bram, Elin, Tomas, Lyra, Rowan, Kai, and a child with a lost scarf. The map has flooded fields, homes, the laboratory, Sanctuary, shop, Oracle display, river, old bridge, fishing dock, and a northern exit. Existing art, portraits, movement, combat, music, speech, and save infrastructure are extended directly.

## Optional activities

| Activity | Completion | Reward |
| --- | --- | --- |
| Lost scarf | Retrieve near the bridge and return to the child | 15 coins |
| Old Observer | Read the old journal | One Archive Fragment |
| Hidden supply | Open the chest behind the shop | One potion |
| Flooded garden | Clear the drainage debris | 5 research points |
| First wild partner | Scan, carefully weaken, and bond with village Voltkit after Kai | Voltkit joins the party |

The old journal and garden can also support optional historical observation mastery after the comparison. All activities remain available after departure. Nell’s potion/crystal/antidote prices are 12/20/10 coins. Antidotes are stored for future travel; Act I has no poison encounters. Healing and restocking at the Sanctuary keep retry paths available without grinding.

## Persistence and accessibility

`state.act1` stores opening, assignment, unique records, field interactions, compared panels, DataDex, demonstrations, tutorial practice, council, side discoveries, and combat preference. All transitions go through `act()`; `quests.js` derives guidance. Rewards are replay safe. New evidence must be explicitly collected, compared, and accepted; merely reading dialogue does not grant progress.

The v1 parser migrates exact supported old save shapes without discarding companions, observations, or an unfinished battle. Migrated players retain their original starter and forest progression. New games use the document’s investigation-first order. Temporary Cloudfin persists only within the first lesson and returns afterward.

Help offers text size, gradual or instant dialogue reveal, a movement-key preset, standard-gamepad controls, and Adventure/Explorer/Scholar guidance preferences. Learning preference does not gate the story. Combat difficulty is separate. A reveal can be completed immediately, changing or closing a line cancels its reveal, and spoken dialogue reads the complete displayed segment. Existing separate voice/music/effects controls and reduced-motion support remain available.

## Verification

Run `npm.cmd run check` and `npm.cmd test`. With the local server running, `node scripts/act1-browser-smoke.mjs` walks through the actual UI using an isolated Edge profile. It covers alternate collection order, a two-record reload, all demonstrations, starter confirmation, the four training actions, midbattle reload, council/departure/return, optional bonding, all side activities, shop purchases, accessibility preferences, and the retained forest investigation. Reports and desktop/mobile screenshots are written under `artifacts/`.

Automated checks do not establish the target completion time, audible music/voice quality, physical controller behavior, or the proposed comprehension percentages. Those require human playtesting. Later chapter regions, evolutions, advanced Pattern Sight, and the Oracle finale remain planned.
