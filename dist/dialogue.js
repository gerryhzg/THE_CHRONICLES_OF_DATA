// Conversation content is presentation only: reading a line never changes game state.
const line = (speaker, expression, text) => ({ speaker, expression, text });
const name = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function getConversation(id, context = {}) {
  const player = name(context.playerName, 'Observer');
  const starter = name(context.starterName, 'your companion');
  const events = Array.isArray(context.events) ? context.events.filter(event => typeof event === 'string') : [];
  const conversation = (title, subtitle, segments, endLabel = 'Continue exploring') => ({ id, title, subtitle, segments, endLabel });

  switch (id) {
    case 'starters':
      return conversation('The first bond', 'RESEARCH LAB', [
        line('lyra', 'happy', `Come in, ${player}. Your first companion is waiting. Or possibly deciding whether you look interesting.`),
        line('observer', 'thoughtful', 'Do I choose them, or do they choose me?'),
        line('lyra', 'thoughtful', 'A little of both. Every Databeast notices different things. A good partner will help you see what you miss.'),
        line('lyra', 'happy', 'Take your time. This is a friendship, not a race. Kai can survive a few more minutes.'),
      ], 'Meet the starters');
    case 'lyra':
      if (context.reportedToLyra) return conversation('Listen to the world', 'RESEARCH LAB', [
        line('lyra', 'happy', `${player}, good to see you. Your field report is safely in the village records. Dry shelf, this time.`),
        line('lyra', 'thoughtful', 'Rowan and I are arranging weather observations across different places and times. We need to know whose weather our records describe.'),
        line('lyra', 'happy', 'Your first expedition is complete. Explore with your companions, or revisit Inferra if you fancy her optional research challenge.'),
      ], 'Review the DataDex');
      return conversation('Listen to the world', 'RESEARCH LAB', [
        line('lyra', 'happy', `Good to see you, ${player}. ${starter} looks quite at home beside you.`),
        line('lyra', 'concerned', 'The Archive keeps dismissing our rainfall records. I used to call that place home. Now I wonder what evidence it\'s leaving out.'),
        line('observer', 'thoughtful', 'How do we find out who or what is missing?'),
        context.rivalDefeated
          ? line('lyra', 'thoughtful', 'Take the eastern road to Professor Inferra in the forest. She can help you test whether a set of records leaves out whole places or times.')
          : line('lyra', 'thoughtful', 'Kai is waiting in the square. Try your companion\'s moves and a DataDex scan before taking the eastern road to Inferra. You\'ll want to look after each other out there.'),
        line('lyra', 'thoughtful', 'Bring Inferra\'s findings back to me here. We won\'t solve the forecast by counting forest creatures, but we can learn which questions to ask about our weather records.'),
        line('lyra', 'happy', 'Your DataDex keeps the creatures and discoveries you record. Leave room for questions, too. That\'s where the interesting work starts.'),
      ], 'Review the DataDex');
    case 'lyra-report':
      return conversation('Bring the evidence home', 'RESEARCH LAB', [
        line('lyra', 'happy', `${player}! You made it back. And that compass looks considerably more useful than the mud on your boots.`),
        line('observer', 'thoughtful', 'We recorded the meadow, riverbank, and canopy in daylight and moonlight. Six habitat and time records, all in the DataDex.'),
        line('lyra', 'thoughtful', 'And what did those places and times add to the ranger\'s picture?'),
        line('observer', 'thoughtful', 'His canopy-at-night patrol missed other activity. Our wider sample challenged his claim, but we still haven\'t seen every creature.'),
        line('lyra', 'thoughtful', 'That\'s a useful finding. Rowan\'s rainfall book deserves the same care: where and when were readings taken, and which places went unrecorded?'),
        line('lyra', 'concerned', 'The forest records don\'t tell us why the Oracle missed our rain. They do give us a better way to investigate, without dismissing the people standing in it.'),
        line('lyra', 'happy', 'Show me your six records and Inferra\'s finding. Let\'s put your field report in the village records.'),
      ], 'Share the field report');
    case 'report-complete':
      return conversation('A first step for Harvest Village', 'FIELD REPORT COMPLETE', [
        line('lyra', 'happy', `Your report is filed, ${player}. Six habitat and time records, Inferra\'s finding, and a note about what we still don\'t know.`),
        line('rowan', 'thoughtful', 'I brought the rainfall book. A wet field is worth writing down, even if the Oracle would rather it stayed dry.'),
        line('lyra', 'thoughtful', 'Rowan and I will arrange weather readings across different places and times. We\'ll keep how and where we measure alongside the numbers.'),
        line('observer', 'thoughtful', 'So we haven\'t found why the forecast failed yet.'),
        line('lyra', 'thoughtful', 'Not yet. But we have a stronger question than "who should we trust?" Now we can ask what each record includes, and what it leaves out.'),
        line('rowan', 'happy', 'And someone came home with notes instead of another promise. That gives me something to work with.'),
        line('lyra', 'happy', 'Your first expedition is complete. Computron wrote about a delivery problem; we\'ll visit on a later journey. For today, you\'ve brought something useful home.'),
      ], 'Return to Harvest Village');
    case 'rival':
      return conversation('A friendly rivalry', 'VILLAGE SQUARE', [
        line('kai', 'happy', context.rivalDefeated
          ? `Back for a rematch, ${player}? Good. I was just about to declare myself unbeatable.`
          : `There you are, ${player}! You, ${starter}, and me. I hope you brought a victory pose.`),
        line('kai', 'thoughtful', 'Lyra asked me to give you some practice before the forest. I volunteered immediately. Very public-spirited of me.'),
        line('kai', 'determined', 'Attack when you\'re ready. Need Focus back? Guard. You\'ll take less damage, too. I do give sensible advice occasionally.'),
        line('observer', 'thoughtful', 'Does scanning use my turn?'),
        line('kai', 'thoughtful', 'Nope. One free scan per battle, no turn spent. It shows moves already observed, not a promise about my next one. I enjoy being unpredictable.'),
        line('observer', 'happy', 'Right. Let\'s see what actually happens.'),
      ], 'Prepare for the battle');
    case 'kai-before-starter':
      return conversation('A friendly challenge', 'VILLAGE SQUARE', [
        line('kai', 'happy', `Hey, ${player}! Lyra has three companions waiting in her lab. One of them could be your partner.`),
        line('kai', 'determined', 'Pick one, then come find me. I\'ve got a victory pose to test.'),
      ]);
    case 'gate-locked':
      return conversation('Before the forest', 'VILLAGE GATE', [
        line('rowan', 'thoughtful', 'That forest mud can swallow a boot. Best go with a companion you know and trust.'),
        line('rowan', 'happy', 'Choose one at Lyra\'s lab, then finish Kai\'s friendly battle. He\'ll wear a trench in the square if you keep him waiting.'),
      ]);
    case 'sanctuary':
      return conversation('A place to catch your breath', 'RESEARCH SANCTUARY', [
        line('narrator', 'neutral', 'Warm light pools beneath the sanctuary roof. Your companions settle close.'),
        line('lyra', 'happy', 'Come in. We\'ll heal your team and replenish your supplies. Even the boldest Observer is allowed a sit-down.'),
      ], 'Open sanctuary services');
    case 'tower':
      return conversation('The false forecast', 'WEATHER TOWER', [
        line('rowan', 'concerned', 'The Oracle promised 0 mm of rain. The gauge says 46 mm, and my seedlings are swimming.'),
        line('lyra', 'thoughtful', 'Forty-six. That\'s quite a lot of "no rain." Did you keep the gauge record?'),
        line('rowan', 'thoughtful', 'Right here. My father started this rainfall book. I use it to decide when to sow. Those seedlings need to get us through winter.'),
        line('lyra', 'concerned', 'We\'ll make sure those records are heard. One failed forecast doesn\'t explain the whole Oracle, but it gives us a reason to investigate.'),
        line('lyra', 'thoughtful', 'Inferra studies how records can miss parts of the world. Once you and your companion are ready for the forest, her fieldwork is a good place to start.'),
        line('rowan', 'thoughtful', 'Then take a look. The rain\'s done enough talking for both of us.'),
      ], 'Review the rainfall records');
    case 'inferra': {
      const count = Number.isInteger(context.observationCount) ? Math.min(6, Math.max(0, context.observationCount)) : 0;
      if (context.questStatus === 'active') return conversation('A broader view of the forest', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `Welcome back, ${player}. You've recorded ${count} of the six field observations. Let's see what's left.`),
        line('inferra', 'thoughtful', 'We need the meadow, riverbank, and canopy in both daylight and moonlight. Check your DataDex for the gaps.'),
        line('inferra', 'neutral', 'Rest at the campfire to change the time. Bring all six records back, and we\'ll see how the ranger\'s claim holds up.'),
      ], 'Review your field observations');
      if (context.questStatus === 'ready') return conversation('What does the evidence support?', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `${player}, all six records! Good. Now we can compare more than one corner of the forest.`),
        line('inferra', 'thoughtful', 'Set your daylight and moonlight notes beside the ranger\'s canopy-at-night records. What did his route leave out?'),
        line('inferra', 'thoughtful', 'Does his sample support a claim about nearly every forest Databeast? What are we still unsure of, even with our wider view?'),
      ], 'Examine the evidence');
      if (context.questStatus === 'complete') return conversation('Keep asking good questions', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `${player}! How's the Sampling Compass? You earned it by noticing the gaps in a very tidy notebook.`),
        line('inferra', 'thoughtful', 'Your broader sample challenged the ranger\'s claim. It still can\'t tell us how every creature behaves. Forests rarely fit neatly in notebooks.'),
        line('inferra', 'neutral', 'Keep noting where and when you look. If fresh evidence changes the picture, change your conclusion. That\'s progress.'),
        context.reportedToLyra
          ? line('inferra', 'happy', 'Lyra has your report now. Good. A useful discovery ought to make it out of the notebook and back to the people who need it.')
          : line('inferra', 'neutral', 'Take the western path back to Harvest Village and show Lyra your six records at her lab. Tell her what our sample missed, too.'),
        ...(context.mastered ? [line('inferra', 'happy', 'And your DataDex records your sampling mastery. Next expedition, you can plan the route. I\'ll carry the notebooks.')] : []),
      ], 'Review your investigation');
      return conversation('Is the whole forest nocturnal?', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `Ah, ${player}. Just in time. Our ranger has brought back a full notebook and a very big claim.`),
        line('ranger', 'happy', 'Nearly every Databeast in this forest must be nocturnal. You should hear that canopy after dark.'),
        line('ranger', 'concerned', 'I plan patrols to keep travelers safe. If most creatures are only out at night, that seems the time to watch.'),
        line('ranger', 'neutral', 'I counted 18 Bayowl and 12 Samplet in the canopy, all at night. I know that patrol route well.'),
        line('inferra', 'thoughtful', 'I believe your count. Where did you look in daylight?'),
        line('ranger', 'thoughtful', 'I\'m off duty by then. I know the night route, though.'),
        line('observer', 'thoughtful', 'What about the meadow and riverbank?'),
        line('inferra', 'happy', 'Exactly. Let\'s observe the meadow, riverbank, and canopy in both daylight and moonlight. Six combinations, not one.'),
        line('ranger', 'thoughtful', 'I\'d like to hear what you find. My usual patrol might be missing a few things.'),
        line('inferra', 'thoughtful', 'Then let\'s find out before we plan around it. Safe patrols need a picture of the places and times travelers actually use.'),
        line('inferra', 'neutral', 'Rest at the campfire to change the time. Record each habitat visit in your DataDex.'),
        line('inferra', 'thoughtful', 'Bring all six records back. Then we can test his claim against a broader sample.'),
      ], 'Review the field assignment');
    }
    case 'inferra-hint': {
      const level = Number.isFinite(context.hintLevel) ? Math.min(3, Math.max(1, Math.floor(context.hintLevel))) : 1;
      let hints = [
        ['The ranger knows the canopy after dark. His notebook is good at telling that story.', 'Which habitats and times are still missing?'],
        ['Compare the same habitat in daylight and moonlight. Then compare it with the other habitats.', 'What would a canopy-only patrol never get a chance to see?'],
        ['If you only look at night, you find the creatures you can see at night.', 'A night-only canopy sample cannot establish that nearly every forest Databeast is nocturnal. That claim needs evidence from the places and times left out.'],
      ];
      if (context.questStatus === 'ready') {
        hints = [
          ['All six records are here. You have the evidence; now we need a finding.', 'Look at the comparison beside the ranger\'s records. Does his patrol describe as much of the forest as your visits do?'],
          ['Compare the same habitat in daylight and moonlight. Then compare it with the other habitats.', 'Your daytime records show activity outside his night patrol. Which parts of that picture could his canopy-only route capture?'],
          ['A night-only canopy sample cannot establish that nearly every forest Databeast is nocturnal. It leaves out other habitats and daytime activity.', 'Choose the finding about the original sample\'s limited coverage. Your broader records challenge his claim, but they still cannot tell us how every creature behaves.'],
        ];
      } else if (context.questStatus === 'active') {
        const missing = Array.isArray(context.missingObservations)
          ? context.missingObservations.filter(label => typeof label === 'string' && label.trim()).map(label => label.trim()) : [];
        const timeLabel = context.time === 'night' ? 'moonlight' : 'daylight';
        const nextObservation = missing.find(label => label.toLowerCase().includes(timeLabel)) || missing[0];
        hints[1] = [
          'Your DataDex marks the habitat and time combinations you have not recorded yet.',
          missing.length ? `Still to record: ${missing.join('; ')}.` : 'Check the observation grid for an empty habitat and time combination.',
        ];
        hints[2] = context.hintTarget === 'camp' ? [
          'You have recorded every habitat at this time. Rest at the campfire to change the time; your existing records will stay safe.',
          missing.length ? `After resting, fill these remaining combinations: ${missing.join('; ')}.` : 'Then visit a habitat with an empty category in the observation grid and choose "Record in DataDex."',
        ] : [
          nextObservation ? `Record ${nextObservation} next. Visit that habitat at the time shown in the DataDex.` : 'Visit a habitat with an empty category at the current time in your observation grid.',
          'Open the habitat and choose "Record in DataDex." Looking at the sightings alone does not save an observation.',
        ];
      }
      return conversation('A nudge from Inferra', 'FIELD RESEARCH GUIDANCE', hints[level - 1].map(text => line('inferra', 'thoughtful', text)), 'Return to the evidence');
    }
    case 'inferra-finding-feedback':
      return conversation('Take another look', 'FIELD RESEARCH FEEDBACK', (context.answer === 'nocturnal' ? [
        'I see why that answer is tempting. Now look at your daytime records. Who was moving while the ranger was off duty?',
        'His night-only canopy sample misses them. Would you still let it speak for every habitat, day and night?',
      ] : [
        'Those six records show us more of the forest. They don\'t show us every creature, every day.',
        'We have better evidence, not certainty about every creature or future sighting. Can you leave room for what we haven\'t seen?',
      ]).map(text => line('inferra', 'thoughtful', text)), 'Revisit your finding');
    case 'inferra-mastery-feedback':
      return conversation(context.mastered ? 'A thoughtful research plan' : 'Reconsider the sampling plan', 'OPTIONAL FIELD CHALLENGE', context.mastered ? [
        line('inferra', 'happy', 'That\'s a route I\'d be happy to walk. Several habitats, daylight and moonlight. You\'re making room for creatures our night patrol missed.'),
        line('inferra', 'happy', 'Keep the observation method consistent, too. Otherwise we might compare how we counted instead of what the creatures were doing.'),
        line('inferra', 'happy', 'Sampling mastery, recorded in your DataDex. Nicely done. Next expedition, you choose the route.'),
      ] : [
        line('inferra', 'thoughtful', 'More sightings on the same night patrol would still leave out the same habitats and times. A bigger sample can keep the same blind spot.'),
        line('inferra', 'thoughtful', 'Try covering the relevant habitats in daylight and moonlight, with a consistent observation method. Who gets a chance to be counted this time?'),
      ], context.mastered ? 'Review your DataDex' : 'Try the plan again');
    case 'complete':
      return conversation('The Nocturnal Mystery, solved', 'FOREST FIELD STATION', [
        line('inferra', 'thoughtful', 'Your notes show activity changing with habitat and time. The ranger\'s canopy-at-night sample left out other groups. We call that sampling bias.'),
        line('ranger', 'thoughtful', 'I know my patrol route well. I shouldn\'t have mistaken it for the whole forest. I\'ll vary my routes and patrol times.'),
        line('observer', 'thoughtful', 'What about the creatures we still haven\'t seen?'),
        line('inferra', 'happy', `Good question. Then we keep looking. We haven't seen every creature, and tomorrow could surprise us. You've earned that Sampling Compass, ${player}.`),
        line('ranger', 'happy', 'Next patrol, you\'re welcome to join me. This time we\'ll go while the sun\'s up.'),
        line('inferra', 'neutral', 'Take your Sampling Compass and six records back to Lyra\'s lab in Harvest Village, along the western path. Your report can help her ask better questions about those rainfall records.'),
      ], 'View your research discovery');
    case 'mastery':
      return conversation('Plan the next expedition', 'OPTIONAL FIELD CHALLENGE', [
        line('inferra', 'happy', 'You\'ve got a knack for spotting who isn\'t in the notebook.'),
        line('inferra', 'thoughtful', 'Help me plan the next expedition. How do we include more of the forest without just counting more creatures on the same old route?'),
      ], 'Choose an observation plan');
    case 'wild':
      return conversation(context.recruited ? 'A familiar spark' : 'A spark in the tall grass', 'SPARK GLADE', context.recruited ? [
        line('narrator', 'neutral', 'A small crackle runs through the grass. Voltkit\'s tail lights up as you approach.'),
        line('observer', 'happy', 'Hey, spark. Still checking on your old hiding place?'),
      ] : [
        line('narrator', 'neutral', 'A Voltkit peeks through the grass, ears high and tail sparking.'),
        line('observer', 'thoughtful', 'Easy, little spark. Let\'s get a look at you.'),
        line('narrator', 'neutral', 'Scan Voltkit, then lower its HP before offering a Bond Crystal. Avoid defeating it. If the bond fails or Voltkit escapes, you can try again.'),
      ], context.recruited ? 'Visit your companion' : 'Prepare to approach Voltkit');
    case 'camp':
      return conversation('A quiet moment by the fire', 'FOREST CAMP', [
        line('narrator', 'neutral', 'A twig snaps in the fire. Your companion settles beside your boots.'),
        line('observer', 'thoughtful', context.time === 'night'
          ? 'Let\'s stay until daylight. I want to see who wakes up with the sun.'
          : 'Let\'s wait for moonlight. I want to see who comes out after dark.'),
      ], 'Choose when to rest');
    case 'battle-result': {
      if (context.recruited) return conversation('A new bond', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'Voltkit noses the Bond Crystal. A bright flick of its tail, and it joins your team!'),
        line('observer', 'happy', 'You can keep the sparks. Just aim them away from my bag.'),
        line('narrator', 'neutral', 'Voltkit\'s DataDex entry is updated: bonded companion.'),
      ], 'View the encounter result');
      if (events.some(event => event.includes('step away safely'))) return conversation('A peaceful retreat', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'You step away safely. A last spark vanishes into the grass.'),
        line('observer', 'thoughtful', 'We\'ll come back when we\'re ready. No rush, little spark.'),
      ], 'View the encounter result');
      if (events.some(event => event.includes('Voltkit slipped back')) || context.won && context.kind === 'wild') {
        return conversation('Another chance to connect', 'ENCOUNTER COMPLETE', [
          line('narrator', 'neutral', 'Voltkit slips back into the grass before you can form a bond.'),
          line('observer', 'concerned', 'Ah, too much power. Next time I\'ll scan first and leave enough HP for a Bond Crystal.'),
          line('narrator', 'neutral', 'You can return for another encounter whenever you\'re ready.'),
        ], 'View the encounter result');
      }
      if (context.won) return conversation('The first of many victories', 'ENCOUNTER COMPLETE', [
        line('kai', 'happy', `You win, ${player}. There goes the victory pose. I'd practiced the eyebrows and everything.`),
        line('observer', 'happy', 'You made us work for it.'),
        line('kai', 'thoughtful', 'I did, didn\'t I? Still... you watched my partner. I was busy imagining the applause. Next time I\'m watching, too.'),
        line('kai', 'happy', 'The eastern road\'s open. Professor Inferra is waiting in the forest. Go on. I\'ll work on my rematch face.'),
      ], 'View the encounter result');
      return conversation('Every encounter teaches you something', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'Lyra guides your tired team to the sanctuary. Warm light restores everyone\'s health.'),
        line('lyra', 'happy', 'There. Everyone\'s well again. No need to solve the whole adventure in one attempt.'),
        line('observer', 'thoughtful', 'Let\'s try again. This time, I\'ll watch before I charge in.'),
      ], 'View the encounter result');
    }
    default:
      throw new RangeError(`Unknown conversation: ${String(id)}`);
  }
}

export function createDialogue(conversation) {
  if (!conversation || !Array.isArray(conversation.segments) || conversation.segments.length === 0) {
    throw new TypeError('A conversation must include at least one dialogue segment.');
  }
  for (const segment of conversation.segments) {
    if (!segment || !['speaker', 'expression', 'text'].every(key => typeof segment[key] === 'string' && segment[key].trim())) {
      throw new TypeError('Each dialogue segment needs a speaker, expression, and readable text.');
    }
  }
  return { conversation, index: 0 };
}

export function currentSegment(dialogue) {
  return dialogue.conversation.segments[dialogue.index];
}

export function advanceDialogue(dialogue) {
  return { ...dialogue, index: Math.min(dialogue.index + 1, dialogue.conversation.segments.length - 1) };
}

export function previousDialogue(dialogue) {
  return { ...dialogue, index: Math.max(0, dialogue.index - 1) };
}

export function isDialogueComplete(dialogue) {
  return dialogue.index === dialogue.conversation.segments.length - 1;
}
