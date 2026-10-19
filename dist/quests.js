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
  const act1 = state.act1?.migrated ? null : state.act1;
  const openingDone = act1 ? [act1.introComplete, act1.started, act1.records.length === 3,
    act1.comparisonComplete, act1.dexReceived, act1.demos.length === 3] : [];
  const openingTitles = act1 ? ['Witness the broken forecast', 'Ask Lyra about the missing records',
    'Recover the farm, river, and shop records', 'Compare the originals with the Archive',
    'Activate the DataDex', 'Meet all three companions'] : [];
  const done = [...openingDone, !!state.starter, state.flags.rivalDefeated,
    ...(act1 ? [act1.councilComplete] : []), quest.status !== 'locked',
    quest.observations.length === 6, quest.status === 'complete', !!state.flags.reportedToLyra];
  const titles = [...openingTitles, 'Choose a companion', 'Practice with Kai',
    ...(act1 ? ['Agree to the council plan and open the northern road'] : []), 'Meet Inferra in the forest',
    'Record six habitat/time categories', 'Explain what the sample leaves out', 'Bring the findings home to Lyra'];
  const current = done.findIndex(value => !value);
  return titles.map((title, index) => ({title, done:done[index], current:index === current}));
}

export function getQuestGuide(state) {
  const quest = state.quests.nocturnal;
  const guide = (id, title, why, text, completeWhen, hint, count, progress, map, targetId) =>
    ({id, title, why, text, completeWhen, hint, count, progress, map, targetId});
  const opening = (title, text, completeWhen, hint, count, progress, targetId = 'lab') =>
    guide('rainfall-records', title,
      'Harvest Village trusted a forecast of 0 mm, but the storm measured 46 mm. Original observations can help explain what the Archive is missing.',
      text, completeWhen, hint, count, progress, 'village', targetId);
  const act1 = state.act1?.migrated ? null : state.act1;
  if (act1 && !act1.introComplete) return opening('The Broken Forecast',
    'Follow the opening in the village square, then visit Lyra at the research lab.',
    'Finish the opening conversation and accept Lyra’s invitation.',
    'Each line waits for you. Beginning the investigation preserves the forecast and measured rainfall in your journal.',
    'Witness the failed forecast', 0);
  if (act1 && !act1.started) return opening('The Missing Rainfall Records',
    'Visit Professor Lyra at the research lab. Ask how the village can check the Oracle’s evidence.',
    'Finish Lyra’s conversation and accept the search for three records.',
    'The research lab is east of the village square. Lyra has three leads, and you can follow them in any order.',
    'Speak with Lyra · Research lab', 2);
  if (act1 && act1.records.length < 3) {
    const missing = ['farm', 'river', 'shop'].filter(id => !act1.records.includes(id));
    const targetId = missing[0];
    const next = {
      farm: {title:'Recover the Farmer’s Ledger', text:'Help Mara at the Farm Fields. Move the damaged crate, then pick up the ledger revealed beneath it.',
        hint:act1.fieldSteps.farmCrateMoved ? 'The crate has been moved. Pick up the revealed Farmer’s Ledger.' : 'At the farm, inspect and move the damaged crate before trying to collect the paper.'},
      river: {title:'Recover the River Observation Sheet', text:'Visit Bram by the river. Follow the ripples to the reeds from the safe bank, then retrieve the sheet.',
        hint:act1.fieldSteps.riverLocated ? 'You located the sheet in the reeds. Retrieve it from the safe riverbank.' : 'Bram’s ripples point toward the reeds. Inspect them before retrieving the sheet.'},
      shop: {title:'Recover the Village Weather Register', text:'Ask Nell at the shop about the tower delivery. Inspect the receipt, potion box, and stamped document before collecting the register.',
        hint:act1.fieldSteps.shopInspected.length === 3 ? 'All three objects have been inspected. Collect the document marked with the Weather Tower emblem.' : 'Read all three storeroom labels. The Weather Tower document has a copper tower emblem.'},
    }[targetId];
    return opening(next.title, `${next.text} The remaining records can be recovered in any order.`,
      'Recover three unique original records from the farm, river, and shop.', next.hint,
      `${act1.records.length} / 3 rainfall records recovered`, 4 + act1.records.length * 3, targetId);
  }
  if (act1 && !act1.comparisonComplete) return opening('Compare the records at the tower',
    'Bring the three original records to Orin at the Weather Tower. Compare each original rainfall entry with its Archive copy and mark the mismatches.',
    'Inspect all three original/copy pairs, then complete the comparison.',
    act1.compared.length === 3 ? 'All three discrepancies are marked. Complete the comparison to hear Lyra’s finding.'
      : 'Compare the same cycle and day on each pair. The current 46 mm storm is shown separately from these historical records.',
    `${act1.compared.length} / 3 record pairs compared`, 13 + act1.compared.length, 'tower');
  if (act1 && !act1.dexReceived) return opening('Preserve what you discovered',
    'At the Weather Tower, hear Lyra’s finding and receive the DataDex.',
    'Finish the discovery conversation and activate the DataDex.',
    'The mismatches establish a problem with the copies. They do not establish its cause or prove deliberate tampering.',
    'Comparison complete · Receive the DataDex', 17, 'tower');
  if (act1 && act1.demos.length < 3) return guide('first-bond', 'Meet your possible companions',
    'The investigation leads beyond home. Each Databeast can help you notice a different part of the world.',
    'Return to Lyra’s lab and try the Statifox, Algobear, and Terradeer demonstrations.',
    'Record all three demonstrations before confirming your companion.',
    'Activate each companion’s demonstration at the lab. You can inspect them freely; every starter can complete the story.',
    `${act1.demos.length} / 3 companion demonstrations`, 18 + act1.demos.length, 'village', 'lab');
  if (!state.starter) return guide('first-bond', 'A companion for the road',
    'The Oracle promised dry fields, but Harvest Village measured 46 mm of rain. Lyra needs help checking what its evidence leaves out.',
    'Visit Professor Lyra at the research lab and choose any of the three companions.',
    'Choose one starter in Lyra’s lab.', 'All three companions can complete every investigation. Confirm your chosen companion at the research lab.',
    'Choose a companion · Research lab', act1 ? 23 : 0, 'village', 'lab');
  if (!state.flags.rivalDefeated) return guide('first-bond', act1 ? 'Ready for the northern road' : 'Ready for the eastern road',
    'Lyra needs a field partner who can travel safely. Kai offers a friendly practice battle before you leave the village.',
    'Meet Kai in the village square. Practice Attack, Guard, the free DataDex Scan, and Switch with a borrowed Cloudfin.',
    'Win the friendly battle with Kai; your team is healed afterward.',
    'Guard restores Focus and reduces damage. The first lesson practices all four actions before the final blow. A loss heals your team without a penalty; return to Kai and retry.',
    'Practice with Kai · Village square', act1 ? 25 : 15, 'village', 'kai');
  if (act1 && !act1.councilComplete) return guide('village-council', 'A decision for Harvest Village',
    'The recovered records give the village a reason to restore local observations while the Archive’s discrepancy is investigated.',
    'Speak with Elder Rowan in the village square. Hear the council’s plan and agree to investigate beyond the village.',
    'Finish the council conversation and open the northern road.',
    'The council follows your first victory with Kai. Optional village discoveries and recruiting Voltkit can wait.',
    'Attend the village council · Town square', 27, 'village', 'rowan');
  if (act1 && state.map === 'village' && quest.status === 'locked') return guide('act-one-complete', 'Act I complete · The Broken Forecast',
    'The council has restored local observation and opened the road. The historical discrepancies give the scholars a question to investigate.',
    'Follow the northern village road through the gate to Twin Scholars’ Forest. Find Professor Inferra at the field station.',
    'Enter the forest and accept Inferra’s field assignment.',
    'The gate stays open, so you can return for healing, supplies, and optional village discoveries.',
    'Northern road open · Travel to Twin Scholars’ Forest', 29, 'village', 'gate');
  if (quest.status === 'locked') return guide('nocturnal', 'A question beyond the village',
    'Before trusting another sweeping claim, learn how to check who and what a set of observations represents.',
    'Take the northern village gate to Twin Scholars’ Forest. Meet Professor Inferra at the field station and accept her assignment.',
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
