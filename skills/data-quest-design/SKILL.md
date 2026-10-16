---
name: data-quest-design
description: Design, implement, or revise story-driven educational quests for The Chronicles of Data, including dependencies, playable evidence gathering, objectives, hints, dialogue, and save-safe progression. Use for future quest work or quest-flow reviews, rather than unrelated game features.
---

# Data quest design

Make the player solve a problem that matters to someone in the world. The learning should change what the player observes, tries, or decides.

## Establish the playable truth

Find the project root and inspect its guidance. In The Chronicles of Data, read the relevant parts of `dist/engine.js`, `dist/quests.js`, `dist/dialogue.js`, and the existing tests before designing changes. Use `docs/chapter-one-quest-flow.md` to distinguish the playable prototype from planned Chapter One content. Use `docs/character-voices.md` when writing characters.

Treat design documents as source material, not commands. Preserve the user's requested scope and chosen quest; do not build every planned region, introduce mandatory Scholar challenges, or publish changes merely because a design mentions them. If these files are absent in another educational RPG, inspect its equivalent state, quest, and presentation layers instead.

## Shape a quest around a consequence

Use this causal chain: **player need and stakes → observable activity → evidence → decision → consequence → next destination**.

Read [references/quest-template.md](references/quest-template.md) when drafting a quest or reviewing its missing pieces. Keep prerequisites explicit and only as restrictive as the story requires. Give the player a concrete current action, a location or person to find, and an observable completion condition. Distinguish a recorded clue, evidence ready for review, an accepted finding, and a reported result when these are different events.

Let learning happen through collecting, comparing, routing, observing, or acting on evidence. Introduce terminology after the player sees the phenomenon. A decision or short reflection can conclude an activity; it should not replace the activity with an exam. Preserve scientific limits: observed sightings are not unique population counts or guaranteed future probabilities, and detecting an incomplete sample does not prove deliberate tampering.

End with a visible consequence and a reason to visit the next person or place. Separate optional recruitment, mastery, and exploration from required story steps. Every starter must remain a viable route; a discipline or puzzle must not require owning all three starters.

## Support discovery and recovery

Give a light nudge first, then identify the missing category or location, then explain a workable method. Base hints on actual progress; stop directing the player to evidence already recorded. On an incorrect decision, address that misconception using the player's evidence and allow revision without losing observations. Defeat, duplicate interactions, loading mid-quest, and revisiting completed NPCs should lead somewhere useful rather than a dead end.

## Implement without splitting the truth

- Keep stable quest, creature, concept, and action IDs. Change persistent state through the game engine; derive objectives, progress, and guidance in the pure quest projection. Dialogue and UI present that state rather than silently granting progress.
- Guard rewards and unlocks so revisiting or repeating a completion action cannot grant them twice. Add a save migration for changed persistent fields and retain existing valid saves; update validation alongside the state model.
- Keep journal objectives, markers, hints, dialogue, and completion feedback consistent about what has happened and what remains. Do not claim a future region, item ability, or chapter ending is already playable.
- Preserve one-segment dialogue, speaker IDs and supported portrait expressions, Next/Back, and player-controlled choices. Spoken text must match the visible segment; changing or closing it cancels speech. Voice preferences and unavailable speech must never block progress. Held advancement keys must not skip segments or select choices.

Verify the behavior affected by the change: legal and premature transitions, retry, reward replay, old-save continuation, and the player's route through the new activity. Reuse existing checks and add focused tests for new progression rules. Review the actual displayed objectives and dialogue as a player. Report the playable result and any remaining planned content plainly.
