import { createGame as createCurrentGame, parseGame } from '../dist/engine.js';

// Retain coverage of the original prototype and its exported saves while the
// dedicated Act I suite exercises the new opening and its stricter milestones.
export function createLegacyGame() {
  const state=createCurrentGame();
  delete state.act1;
  delete state.inventory.antidotes;
  delete state.inventory.archiveFragments;
  delete state.dex.species.creature_cloudfin;
  delete state.dex.concepts.concept_historical_observation;
  return parseGame(JSON.stringify(state));
}
