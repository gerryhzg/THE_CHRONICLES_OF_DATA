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
        line('lyra', 'happy', `Welcome, ${player}; your first companion is waiting.`),
        line('lyra', 'thoughtful', 'Each Databeast sees the world differently, and the best discoveries come from working together.'),
        line('lyra', 'happy', 'Take your time and choose the companion you want beside you.'),
      ], 'Meet the starters');
    case 'lyra':
      return conversation('Listen to the world', 'RESEARCH LAB', [
        line('lyra', 'happy', `It is good to see you and ${starter} working together, ${player}.`),
        line('lyra', 'concerned', 'The Oracle keeps dismissing our rainfall records; I worry that evidence has disappeared from the Archive.'),
        context.rivalDefeated
          ? line('lyra', 'thoughtful', 'Follow the eastern road to Professor Inferra in the forest, and keep your DataDex close.')
          : line('lyra', 'thoughtful', 'Kai is waiting in the square; try your companion’s moves and scan your opponent.'),
        line('lyra', 'happy', 'Your DataDex keeps the creatures and discoveries you record along the way.'),
      ], 'Review the DataDex');
    case 'rival':
      return conversation('A friendly rivalry', 'VILLAGE SQUARE', [
        line('kai', 'happy', context.rivalDefeated
          ? `Another match, ${player}? I want to see what you and ${starter} have learned.`
          : `There you are, ${player}! Let’s see what you and ${starter} can do.`),
        line('kai', 'determined', 'Choose an attack to take a turn, or Guard to reduce damage and recover Focus.'),
        line('kai', 'thoughtful', 'Your first DataDex scan is free and reveals my companion’s recent moves.'),
        line('kai', 'happy', 'Those observations describe past turns; they cannot guarantee my next move.'),
      ], 'Prepare for the battle');
    case 'kai-before-starter':
      return conversation('A friendly challenge', 'VILLAGE SQUARE', [
        line('kai', 'happy', `Hey, ${player}! Professor Lyra has three companions waiting in her lab.`),
        line('kai', 'determined', 'Choose one, then come back for our first battle!'),
      ]);
    case 'gate-locked':
      return conversation('Before the forest', 'VILLAGE GATE', [
        line('rowan', 'thoughtful', 'The forest road is easier with a companion you know and trust.'),
        line('rowan', 'happy', 'Choose your Databeast with Lyra and finish Kai’s friendly battle before heading out.'),
      ]);
    case 'sanctuary':
      return conversation('A place to catch your breath', 'RESEARCH SANCTUARY', [
        line('narrator', 'neutral', 'Your companions gather around the sanctuary’s warm glow.'),
        line('lyra', 'happy', 'The village looks after its Observers; you can heal your team and replenish your supplies here.'),
      ], 'Open sanctuary services');
    case 'tower':
      return conversation('The false forecast', 'WEATHER TOWER', [
        line('rowan', 'concerned', 'The Oracle predicted 0 mm of rain, but our gauge measured 46 mm.'),
        line('lyra', 'thoughtful', 'The soaked fields give us a reason to check the prediction against our observations.'),
        line('rowan', 'thoughtful', 'Our ancestors kept rainfall records so the next generation could make better decisions.'),
        line('lyra', 'concerned', 'One failed forecast does not tell us everything about the Oracle.'),
        line('lyra', 'thoughtful', 'It does give us a reason to investigate the evidence behind it.'),
      ], 'Review the rainfall records');
    case 'inferra': {
      const count = Number.isInteger(context.observationCount) ? Math.min(6, Math.max(0, context.observationCount)) : 0;
      if (context.questStatus === 'active') return conversation('A broader view of the forest', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `Welcome back, ${player}; your DataDex holds ${count} of the six field observations.`),
        line('inferra', 'thoughtful', 'Observe the meadow, riverbank, and canopy in both daylight and moonlight to include the habitats and times the ranger missed.'),
        line('inferra', 'neutral', 'Rest at the campfire to change the time, then bring me all six records so we can examine his claim together.'),
      ], 'Review your field observations');
      if (context.questStatus === 'ready') return conversation('What does the evidence support?', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `You have recorded all six habitat and time combinations, ${player}.`),
        line('inferra', 'thoughtful', 'Compare your daytime and nighttime records with the ranger\'s canopy-only sample.'),
        line('inferra', 'thoughtful', 'Does his sample support a claim about nearly every forest Databeast, and what uncertainty remains in ours?'),
      ], 'Examine the evidence');
      if (context.questStatus === 'complete') return conversation('Keep asking good questions', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `Good to see you, ${player}; you earned the Sampling Compass by questioning which observations were missing.`),
        line('inferra', 'thoughtful', 'Your broader sample challenged the ranger\'s claim, but it cannot prove how every creature will behave.'),
        line('inferra', 'neutral', 'Keep recording habitats and times, and leave room to revise your conclusions when new evidence arrives.'),
        ...(context.mastered ? [line('inferra', 'happy', 'Your DataDex also records your mastery of planning observations across the relevant habitats and times.')] : []),
      ], 'Review your investigation');
      return conversation('Is the whole forest nocturnal?', 'FOREST FIELD STATION', [
        line('inferra', 'happy', `Welcome to the field station, ${player}; a ranger has brought us a claim to investigate.`),
        line('ranger', 'happy', 'Nearly every Databeast in this forest must be nocturnal!'),
        line('ranger', 'neutral', 'I counted 18 Bayowl and 12 Samplet in the canopy, all at night.'),
        line('inferra', 'thoughtful', 'Those are real observations, but they cover only one habitat at one time of day.'),
        line('observer', 'thoughtful', 'How can we find out what the rest of the forest is doing?'),
        line('inferra', 'happy', 'Observe the meadow, riverbank, and canopy in both daylight and moonlight.'),
        line('inferra', 'neutral', 'Rest at the campfire to change the time, and record each visit in your DataDex.'),
        line('inferra', 'thoughtful', 'Bring me those six observations so we can compare the claim with a broader sample.'),
      ], 'Review the field assignment');
    }
    case 'inferra-hint': {
      const level = Number.isFinite(context.hintLevel) ? Math.min(3, Math.max(1, Math.floor(context.hintLevel))) : 1;
      const hints = [
        ['The ranger visits only the canopy, and only at night.', 'Which habitats and times are missing from his notebook?'],
        ['Compare the same habitat in daylight and moonlight, then compare habitats.', 'Does one place at one time represent all of them?'],
        ['A night-only sample favors the creatures visible at night.', 'It cannot establish that nearly every creature in the forest is nocturnal.'],
      ];
      return conversation('A nudge from Inferra', 'FIELD RESEARCH GUIDANCE', hints[level - 1].map(text => line('inferra', 'thoughtful', text)), 'Return to the evidence');
    }
    case 'inferra-finding-feedback':
      return conversation('Take another look', 'FIELD RESEARCH FEEDBACK', (context.answer === 'nocturnal' ? [
        'Look at your daytime records and consider what the ranger\'s night-only sample leaves out.',
        'Does that narrow sample describe the whole forest, or should you revise your finding?',
      ] : [
        'Your observations give us useful evidence about these habitats and times.',
        'They do not establish certainty about every creature or future sighting, so reconsider what your finding claims.',
      ]).map(text => line('inferra', 'thoughtful', text)), 'Revisit your finding');
    case 'inferra-mastery-feedback':
      return conversation(context.mastered ? 'A thoughtful research plan' : 'Reconsider the sampling plan', 'OPTIONAL FIELD CHALLENGE', context.mastered ? [
        line('inferra', 'happy', 'Well planned; observing several habitats at different times includes groups a night-only sample would miss.'),
        line('inferra', 'happy', 'Use a consistent method in each habitat so the observations can be compared fairly.'),
        line('inferra', 'happy', 'Your DataDex now records your sampling mastery, and future evidence can still teach us more.'),
      ] : [
        line('inferra', 'thoughtful', 'A larger sample does not fix sampling bias if it still leaves out important habitats or times.'),
        line('inferra', 'thoughtful', 'Try a plan that includes the relevant habitats in daylight and moonlight, using a consistent observation method.'),
      ], context.mastered ? 'Review your DataDex' : 'Try the plan again');
    case 'complete':
      return conversation('The Nocturnal Mystery, solved', 'FOREST FIELD STATION', [
        line('inferra', 'thoughtful', 'The ranger was studying the creatures he could see in the canopy at night.'),
        line('inferra', 'happy', 'Your observations show that activity varies across habitats and times.'),
        line('inferra', 'thoughtful', 'His narrow sample cannot support a claim about the entire forest.'),
        line('inferra', 'happy', 'Your broader sample helps us understand more, while leaving room for further evidence.'),
      ], 'View your research discovery');
    case 'mastery':
      return conversation('Plan the next expedition', 'OPTIONAL FIELD CHALLENGE', [
        line('inferra', 'happy', 'You have learned to ask who and what our observations leave out.'),
        line('inferra', 'thoughtful', 'Help me plan an expedition that gives us a more representative picture of the whole forest.'),
      ], 'Choose an observation plan');
    case 'wild':
      return conversation(context.recruited ? 'A familiar spark' : 'A spark in the tall grass', 'SPARK GLADE', context.recruited ? [
        line('narrator', 'neutral', 'Voltkit flicks its electric tail, happy to see a familiar friend.'),
        line('observer', 'happy', 'Patient observation brought us together.'),
      ] : [
        line('narrator', 'neutral', 'A curious Voltkit peeks out through the grass.'),
        line('observer', 'thoughtful', 'I can scan it, lower its HP, and offer a Bond Crystal to earn its trust.'),
        line('narrator', 'neutral', 'If it hesitates or escapes, you can try again.'),
      ], context.recruited ? 'Visit your companion' : 'Prepare to approach Voltkit');
    case 'camp':
      return conversation('A quiet moment by the fire', 'FOREST CAMP', [
        line('narrator', 'neutral', 'The campfire crackles as the forest settles around you.'),
        line('observer', 'thoughtful', context.time === 'night'
          ? 'I can rest until daylight and observe the forest at a different time.'
          : 'I can wait for moonlight and observe the forest at a different time.'),
      ], 'Choose when to rest');
    case 'battle-result': {
      if (context.recruited) return conversation('A new bond', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'Voltkit accepts your Bond Crystal and joins your team!'),
        line('observer', 'happy', 'A little patience and careful observation helped us make a new friend.'),
        line('narrator', 'neutral', 'Your DataDex now records Voltkit as a bonded companion.'),
      ], 'View the encounter result');
      if (events.some(event => event.includes('step away safely'))) return conversation('A peaceful retreat', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'You step away safely and leave Voltkit in peace.'),
        line('observer', 'thoughtful', 'I can return when my team is ready.'),
      ], 'View the encounter result');
      if (events.some(event => event.includes('Voltkit slipped back')) || context.won && context.kind === 'wild') {
        return conversation('Another chance to connect', 'ENCOUNTER COMPLETE', [
          line('narrator', 'neutral', 'Voltkit slips back into the grass.'),
          line('observer', 'thoughtful', 'Next time I can scan and weaken it before using a Bond Crystal.'),
          line('narrator', 'neutral', 'Another encounter is available whenever you are ready.'),
        ], 'View the encounter result');
      }
      if (context.won) return conversation('The first of many victories', 'ENCOUNTER COMPLETE', [
        line('kai', 'happy', `Well played, ${player}! You and your companion make a great team.`),
        line('kai', 'thoughtful', 'Careful observation helped you decide what to do.'),
        line('kai', 'happy', 'The eastern road is open, and Professor Inferra is waiting in the forest.'),
      ], 'View the encounter result');
      return conversation('Every encounter teaches you something', 'ENCOUNTER COMPLETE', [
        line('narrator', 'neutral', 'Lyra brings your team to the sanctuary and restores everyone’s health.'),
        line('observer', 'thoughtful', 'I can use what I learned and try again when I am ready.'),
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
