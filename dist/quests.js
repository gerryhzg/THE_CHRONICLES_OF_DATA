import { HABITATS } from './engine.js';

// A view of existing progress, never a second source of quest state.
export function getMissingObservations(state) {
  const recorded = new Set(state.quests.nocturnal.observations.map(row => `${row.habitatId}:${row.time}`));
  return ['day', 'night'].flatMap(time => HABITATS
    .filter(habitat => !recorded.has(`${habitat.id}:${time}`))
    .map(habitat => ({habitatId:habitat.id, targetId:habitat.id.replace('habitat_', ''), time,
      label:`${habitat.title} · ${time === 'day' ? 'daylight' : 'moonlight'}`})));
}

export function getJourneySteps(state) {
  const quest = state.quests.nocturnal;
  const done = [!!state.starter, state.flags.rivalDefeated, quest.status !== 'locked',
    quest.observations.length === 6, quest.status === 'complete', !!state.flags.reportedToLyra];
  const titles = ['Choose a companion', 'Practice with Kai', 'Meet Inferra in the forest',
    'Record six habitat/time categories', 'Explain what the sample leaves out', 'Bring the findings home to Lyra'];
  const current = done.findIndex(value => !value);
  return titles.map((title, index) => ({title, done:done[index], current:index === current}));
}

export function getQuestGuide(state) {
  const quest = state.quests.nocturnal;
  const guide = (id, title, why, text, completeWhen, hint, count, progress, map, targetId) =>
    ({id, title, why, text, completeWhen, hint, count, progress, map, targetId});
  if (!state.starter) return guide('first-bond', 'A companion for the road',
    'The Oracle promised dry fields, but Harvest Village measured 46 mm of rain. Lyra needs help checking what its evidence leaves out.',
    'Visit Professor Lyra at the research lab and choose any of the three companions.',
    'Choose one starter in Lyra’s lab.', 'All three companions can complete every investigation. The Weather Tower offers more context about the failed forecast.',
    'Choose a companion · Research lab', 0, 'village', 'lab');
  if (!state.flags.rivalDefeated) return guide('first-bond', 'Ready for the eastern road',
    'Lyra needs a field partner who can travel safely. Kai offers a friendly practice battle before you leave the village.',
    'Meet Kai in the village square. Try attacking, guarding, and the free DataDex scan.',
    'Win the friendly battle with Kai; your team is healed afterward.',
    'Guard restores Focus and reduces damage. A loss heals your team too; return to Kai and retry. Scanning is useful, but winning does not require it.',
    'Practice with Kai · Village square', 15, 'village', 'kai');
  if (quest.status === 'locked') return guide('nocturnal', 'A question beyond the village',
    'Before trusting another sweeping claim, learn how to check who and what a set of observations represents.',
    'Take the eastern gate to Twin Scholars’ Forest. Meet Professor Inferra at the field station and accept her assignment.',
    'Finish Inferra’s introduction and choose “Take the field assignment.”',
    'In the forest, follow the western path to the field station. Visiting a habitat before accepting the assignment does not record it.',
    'Accept the investigation · Forest field station', 30, 'forest', 'inferra');
  if (quest.status === 'active') {
    const missing = getMissingObservations(state);
    const next = missing.find(row => row.time === state.time);
    return guide('nocturnal', 'Give the whole forest a chance',
      'The ranger knows the canopy at night. Safer patrols need evidence from the places and times his route misses.',
      next ? `Record the next category: ${next.label}. Visit each habitat in daylight and moonlight, then return to Inferra.`
        : 'You have recorded every habitat at this time. Rest at the campfire to change time, then fill the remaining gaps.',
      'Record the meadow, riverbank, and canopy in both daylight and moonlight: six categories.',
      next ? 'Open the habitat and click “Record in DataDex.” Looking at its sightings alone does not save an observation.'
        : 'Rest at the campfire; changing time keeps every observation you have already recorded.',
      `${quest.observations.length} / 6 habitat & time observations`, 40 + quest.observations.length * 6, 'forest', next?.targetId || 'camp');
  }
  if (quest.status === 'ready') return guide('nocturnal', 'Turn field notes into a finding',
    'Six records give the ranger a broader view. Your conclusion must explain what his night-only patrol left out.',
    'Return to Inferra, review the habitat/time comparison, and choose the finding your evidence supports.',
    'Explain why the canopy-at-night sample cannot justify a claim about nearly every forest Databeast.',
    'Compare coverage before totals. A wider sample is better evidence, but it cannot promise how every creature will behave. Ask Inferra for a nudge if needed.',
    '6 / 6 recorded · Review your finding with Inferra', 78, 'forest', 'inferra');
  if (!state.flags.reportedToLyra) return guide('field-report', 'Bring the findings home',
    'The ranger will broaden his patrols. Lyra can use the same habit of checking missing evidence when the village reviews its weather records.',
    'Return through the forest’s western exit to Harvest Village. Show Professor Lyra your field report at her lab.',
    'Read Lyra’s report conversation and choose “Share the field report.”',
    'Your Sampling Compass and six records are already saved. Neither recruiting Voltkit nor completing mastery is required to report.',
    'Report to Lyra · Harvest Village research lab', 90, 'village', 'lab');
  return guide('stage-one-complete', 'A village that keeps looking',
    'Your fieldwork gave the village a way to question incomplete evidence. The failed forecast still needs investigation.',
    'Lyra has your report. You can befriend Voltkit, try Inferra’s optional mastery challenge, or revisit your DataDex.',
    'Stage 1 main story complete. Later Chapter One regions are not available in this prototype.',
    'Optional activities can be completed in either order. Healing and supplies at the village sanctuary are free.',
    'Stage 1 main story complete', 100, 'village', null);
}
