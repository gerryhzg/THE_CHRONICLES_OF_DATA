# Quest brief

Use these fields where they clarify the requested quest; they are a design aid, not a requirement to create a new subsystem or fill out a lengthy document.

| Field | Decision to make |
| --- | --- |
| Identity and scope | Stable ID, title, main or optional, region, and whether it is playable now or planned. Preserve any existing serialized ID. |
| Person and purpose | Who needs help? What does the player care about? What could go wrong if no one acts? |
| Prerequisites | Exact required state and why it matters. List optional advantages separately. |
| Current objective | One concrete verb, target, and location. What does the player do next? |
| Activity and evidence | What can the player observe or manipulate? What record makes it into the DataDex? Specify categories, measurement meaning, and limits. |
| Decision | What useful choice becomes possible because of that evidence? State the intended inference and the tempting misconception. |
| Completion | Machine-checkable success condition; separate evidence collected from reviewed, rewarded, or reported if needed. |
| Consequence and reward | Who changes their plan? What is granted once? What becomes accessible? |
| Retry and feedback | What is preserved on an incorrect choice or defeat? What can be tried again? |
| Hints | Nudge; progress-specific direction; then method or worked comparison. Do not replace evidence gathering with a revealed answer. |
| Transition | Next destination or character, reason to go, and a truthful promise of what awaits. |
| Optional content | Extra interpretation, recruitment, calculations, or lore, with no required story gate. |
| Persistence and verification | State fields, old-save treatment, idempotent rewards, and meaningful progression checks. |

## Worked example: The Nocturnal Mystery

**Identity:** C1-03 in the design registry; the existing save uses `quests.nocturnal`. Do not rename the saved key to match the registry.

**Purpose:** The village needs better observations before making decisions. Inferra is concerned that a ranger's confident claim about nearly every forest Databeast comes from his night patrol. The ranger is an experienced scout with a limited route, not an incompetent person.

**Prerequisite:** Choose one starter and defeat Kai in the friendly tutorial battle to open the forest. Accept Inferra's field assignment. Recruitment and optional mastery are not prerequisites.

**Activity:** Visit meadow, riverbank, and canopy in daylight and moonlight. Rest at the campfire to change time. Record each habitat/time combination once. These six records contain multiple sightings; they are not six individual creatures. Compare them with the ranger's original 18 Bayowl and 12 Samplet sightings from the canopy at night.

**Decision:** Can a sample from one habitat at one time justify a claim about the entire forest? Daytime records make the missing coverage tangible. A broader sample challenges the claim without proving exactly how every creature behaves or why the Oracle's records are unreliable.

**Completion and consequence:** All six categories must be recorded before the finding can be submitted. Accept the finding that the original sample excluded relevant habitats and times. Inferra awards the Sampling Compass, 20 research points, and 40 coins once. The ranger can revise his observation route. Return to Lyra in Harvest Village to report the result and close this prototype's main story.

**Feedback:** For the nocturnal conclusion, point to activity in the daytime records. For certainty about every creature, distinguish observed sightings from a census or future guarantee. Preserve all records and allow revision.

**Hints:** First ask what the ranger did not observe. Next identify the player's missing habitat/time categories. Finally explain using the campfire and the observation grid to fill those gaps, or compare daytime records when all categories are present.

**Optional:** Bond with Voltkit or plan a representative follow-up expedition in the mastery reflection. Neither is required for the report to Lyra. The Compass marks unobserved categories; it does not currently unlock a new region.

**Checks:** Cannot observe before accepting, submit before six unique categories, or report before a successful finding. Duplicate observations and repeated completion cannot duplicate rewards. Save/load preserves observations and the separate report status. Old valid saves remain usable.
