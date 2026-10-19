// Conversation content is presentation only: reading a line never changes game state.
const line = (speaker, expression, text) => ({ speaker, expression, text });
const name = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function getConversation(id, context = {}) {
  const player = name(context.playerName, 'Observer');
  const starter = name(context.starterName, 'your companion');
  const events = Array.isArray(context.events) ? context.events.filter(event => typeof event === 'string') : [];
  const act1 = context.act1 || {};
  const recordIds = Array.isArray(act1.records) ? act1.records : [];
  const detailId = context.speciesId || context.data?.id || context.id;
  const conversation = (title, subtitle, segments, endLabel = 'Continue exploring') => ({ id, title, subtitle, segments, endLabel });

  switch (id) {
    case 'act1-intro':
      return conversation('The Broken Forecast', 'HARVEST VILLAGE · DAY 127', [
        line('narrator', 'neutral', 'Morning light warms Harvest Village. Farmers carry baskets into the fields. Above the square, the Oracle announces: expected rainfall 0 mm. Forecast confidence: absolute.'),
        line('narrator', 'concerned', 'The wind changes. Rain strikes the board, then pours across the fields. Baskets overturn. Water rises around the crops.'),
        line('narrator', 'concerned', 'The rain gauge records 46 mm. The Oracle flickers: “Predictions remain perfect.”'),
        line('rowan', 'concerned', 'The Oracle said the fields would be dry. We believed it.'),
        line('lyra', 'thoughtful', 'Then we need to understand why it was wrong.'),
        line('rowan', 'concerned', 'But the Oracle has never been wrong.'),
        line('lyra', 'concerned', "That's exactly what worries me."),
        line('narrator', 'concerned', 'The terminal crackles again. “Forecast accuracy remains perfect.” Behind it, villagers lift their ruined market stalls.'),
        line('lyra', 'thoughtful', `Come to my laboratory, ${player}. I need someone who will look for answers.`),
      ], 'Begin the investigation');
    case 'act1-lyra':
      if (act1.dexReceived) return conversation('A partner for the investigation', 'RESEARCH LAB', [
        line('lyra', 'happy', `Your DataDex is ready, ${player}. Now you need a friend for the road.`),
        line('lyra', 'thoughtful', 'Watch all three companions at their stations. Each notices something different. Any of them can help us investigate.'),
      ], 'Meet the three companions');
      if (act1.started) {
        const missing = [['farm', 'Mara at the Farm Fields'], ['river', 'Bram at the river'], ['shop', 'Nell at the shop']]
          .filter(([recordId]) => !recordIds.includes(recordId)).map(([, location]) => location);
        return conversation('Follow the missing records', 'RESEARCH LAB', [
          line('lyra', 'thoughtful', `You have ${recordIds.length} of the three original weather records. Keep each sheet somewhere dry. My pockets have proved unreliable.`),
          line('lyra', 'thoughtful', missing.length
            ? `Still to visit: ${missing.join('; ')}. You can follow those leads in any order.`
            : 'All three sheets are safe. Bring them to Orin at the Weather Tower and compare each original with its Archive copy.'),
          line('lyra', 'concerned', 'A mismatch would tell us the copies need investigation. It would not tell us who changed them, or whether anyone did it deliberately.'),
        ], missing.length ? 'Continue searching' : 'Visit the Weather Tower');
      }
      return conversation('The Missing Rainfall Records', 'RESEARCH LAB', [
        line('lyra', 'concerned', "You've seen what happened outside, haven't you?"),
        line('observer', 'thoughtful', 'The Oracle predicted no rain. But the village was flooded.'),
        line('lyra', 'concerned', 'Yes. And the strangest part is that it refuses to acknowledge the mistake.'),
        line('observer', 'thoughtful', 'Could the machine be broken?'),
        line('lyra', 'thoughtful', 'Perhaps. A machine can also produce a wrong answer when the information it receives is wrong.'),
        line('lyra', 'thoughtful', 'Before the Oracle existed, our ancestors kept careful weather observations in the old Weather Tower. The storm scattered three original sheets.'),
        line('lyra', 'thoughtful', "Mara saw one at the farm. Bram spotted paper by the river. Nell received a box from the tower. Find those records, and we'll compare them with the Archive."),
      ], 'Look for the three records');
    case 'act1-farm':
      return conversation("Mara's flooded fields", 'FARM FIELDS', recordIds.includes('farm') ? [
        line('mara', 'happy', "The Farmer's Ledger is safe with you. My family used it to decide when to plant, harvest, and prepare for storms."),
        line('mara', 'thoughtful', 'The garden still needs clearing, if you have time. The other records come first; the mud can wait.'),
      ] : [
        line('mara', 'concerned', 'The Oracle told us to prepare for drought. Now the rain has washed away half our work.'),
        line('observer', 'thoughtful', 'Professor Lyra asked me to find the old weather records.'),
        line('mara', 'thoughtful', act1.fieldSteps?.farmCrateMoved
          ? 'You shifted the damaged crate. There, beneath it: the ledger. Lift the paper carefully.'
          : "A sheet blew beneath that damaged storage crate. Help me move it, then we'll see what survived."),
      ], recordIds.includes('farm') ? 'Review the recovered ledger' : 'Inspect the damaged crate');
    case 'act1-river':
      return conversation('What the river remembers', 'RIVER AND OLD BRIDGE', recordIds.includes('river') ? [
        line('bram', 'happy', 'You saved the River Observation Sheet. Those old notes helped us prepare when the low bridge flooded before.'),
        line('bram', 'thoughtful', 'The river does not read forecasts. Best keep watching it ourselves.'),
      ] : [
        line('bram', 'concerned', "I've watched this river for thirty years. When it rises this quickly, the low bridge may flood."),
        line('observer', 'thoughtful', 'How do you know?'),
        line('bram', 'thoughtful', "Because I've seen it before, and wrote it down. Look along the bank: those ripples lead to paper caught in the reeds."),
        line('bram', 'neutral', act1.fieldSteps?.riverLocated
          ? 'You found the sheet. Reach from the safe bank and lift it out of the reeds.'
          : 'Follow the ripples from this bank. Stay clear of the deep water while you inspect the reeds.'),
      ], recordIds.includes('river') ? 'Review the river record' : 'Follow the ripples');
    case 'act1-shop':
      return conversation("Nell's unexpected delivery", 'GENERAL STORE', recordIds.includes('shop') ? [
        line('nell', 'happy', 'One Village Weather Register, rescued from my storeroom. A tower emblem beats my filing system, apparently.'),
        line('nell', 'thoughtful', 'Take a look at the supplies when you need them. No one should have to buy their way through an investigation.'),
      ] : [
        line('nell', 'thoughtful', 'A crate from the Weather Tower arrived after the storm. I thought it was another box of old papers.'),
        line('observer', 'thoughtful', 'Those papers might help explain why our weather forecast was wrong.'),
        line('nell', 'happy', "Then we'd better find the right one. Check the shipping receipt, the empty potion box, and that stamped document."),
        line('nell', 'thoughtful', 'The tower used a clear copper emblem. Read each label; you can leave the packing straw to me.'),
      ], recordIds.includes('shop') ? 'Browse supplies' : 'Inspect the storeroom');
    case 'act1-tower':
      return conversation('Originals beside the Archive', 'WEATHER TOWER', act1.dexReceived ? [
        line('orin', 'thoughtful', 'The original sheets remain here beside their Archive copies. Rain on the paper, zero rainfall in each copy.'),
        line('orin', 'concerned', 'We have preserved the discrepancy. Its cause still needs investigation.'),
      ] : recordIds.length === 3 ? [
        line('orin', 'happy', 'All three originals! Slide them onto the comparison table. We can check the copies without doing any sums.'),
        line('orin', 'thoughtful', 'Read the rainfall on each original, then its Archive copy. Mark a record when the two entries disagree.'),
        line('lyra', 'thoughtful', 'Keep the current storm separate: predicted 0 mm, measured 46 mm. These three sheets describe earlier years.'),
      ] : [
        line('orin', 'concerned', `The storm scattered three originals. You have recovered ${recordIds.length}. The empty places on this table belong to the missing sheets.`),
        line('orin', 'thoughtful', 'Lyra has leads at the farm, river, and shop. Bring the originals here so we can compare the same records, side by side.'),
      ], act1.dexReceived ? 'Review the comparison table' : 'Open the comparison table');
    case 'act1-discovery':
      return conversation('The evidence no longer agrees', 'WEATHER TOWER · DATA INTEGRITY WARNING', [
        line('narrator', 'concerned', 'Original records: rainfall detected. Archive copies: no rainfall recorded. Source history: incomplete.'),
        line('observer', 'thoughtful', 'These records show rain, but the Archive says there was none!'),
        line('lyra', 'thoughtful', 'Exactly. The observations and the records no longer agree.'),
        line('observer', 'concerned', 'Does that mean the Oracle is lying?'),
        line('lyra', 'thoughtful', 'It means something is wrong with the evidence it uses. We have not established the cause, or whether anyone changed it deliberately.'),
        line('lyra', 'thoughtful', 'Our ancestors learned by watching the world. They kept records so the next generation could make better decisions.'),
        line('lyra', 'happy', 'This is a DataDex. It collects observations and preserves discoveries. Basic Observation, Scan, and your research journal are ready. We can begin gathering our own evidence.'),
        line('lyra', 'happy', "Return to my lab when you're ready. You shouldn't go on this investigation alone."),
      ], 'Activate the DataDex');
    case 'act1-demo': {
      const demos = {
        creature_statifox: ['Statifox', 'The weather sensor clicks through its readings. Statifox tilts an ear, taps one flickering dial, and uncovers a loose connection.', 'Statifox notices inconsistencies that others overlook. That curious nose finds work even indoors.'],
        creature_algobear: ['Algobear', 'A little calculation machine jams. Algobear studies the gears, shifts their order, and turns the crank. The machine hums again.', 'Algobear enjoys solving mechanical problems. It prefers a stubborn gear to an easy afternoon.'],
        creature_terradeer: ['Terradeer', 'Terradeer lowers its glowing antlers toward a potted crop. A soft light reveals water collecting around its roots.', 'Terradeer understands the living world and notices environmental danger. We moved that pot above the flood line together.'],
      };
      const demo = demos[detailId] || demos.creature_statifox;
      return conversation(`Meet ${demo[0]}`, 'RESEARCH LAB · COMPANION DEMONSTRATION', [
        line('lyra', 'happy', `Let's give ${demo[0]} something to investigate. You can help by starting the demonstration.`),
        line('narrator', 'neutral', demo[1]),
        line('lyra', 'thoughtful', demo[2]),
        line('lyra', 'happy', 'Every companion can travel with you and complete our investigations. A friendship leaves room to learn from each other.'),
      ], `Record ${demo[0]}'s demonstration`);
    }
    case 'act1-bond':
      return conversation('The First Bond', 'RESEARCH LAB', [
        line('lyra', 'happy', "If you're going to investigate the Grand Archive, you shouldn't go alone."),
        line('observer', 'thoughtful', 'Are those Databeasts?'),
        line('lyra', 'thoughtful', 'They are. Each sees the world differently. Watch all three demonstrations before you choose your partner.'),
        line('lyra', 'happy', 'Take your time, then confirm your choice. A strong partnership begins with trust. Take care of each other.'),
      ], 'Meet and choose a companion');
    case 'act1-council':
      return conversation('A village that observes', 'TOWN SQUARE · VILLAGE COUNCIL', act1.councilComplete ? [
        line('rowan', 'thoughtful', 'Our neighbors are keeping local observations again. We will preserve the originals and question the copies.'),
        line('lyra', 'happy', 'The northern road is open. Professor Inferra in Twin Scholars’ Forest can help you investigate what records leave out.'),
      ] : [
        line('rowan', 'concerned', 'For generations, the Oracle has guided this village. We cannot abandon it over one storm.'),
        line('mara', 'concerned', 'But we lost crops because we followed its prediction.'),
        line('lyra', 'thoughtful', "The storm isn't the only problem. Our historical observations do not match the information stored in the Archive."),
        line('rowan', 'thoughtful', 'How could that happen?'),
        line('lyra', 'concerned', "I don't know yet. These mismatches do not prove deliberate tampering. Until we understand them, we shouldn't treat the Oracle as infallible."),
        line('rowan', 'thoughtful', 'Then what do you propose?'),
        line('lyra', 'thoughtful', 'We begin observing again. Every farmer, traveler, and researcher can help us collect evidence. Keep where, when, and how each observation was made.'),
        line('rowan', 'happy', 'Then we will keep local records and help the flooded farms. Tomas, open the northern road for our Observer.'),
        line('lyra', 'thoughtful', 'The mismatched records suggest that the Archive’s evidence has changed or been lost. The old scholars in the northern forest may help us understand how.'),
        line('kai', 'happy', "Twin Scholars' Forest? I've always wanted to explore that place!"),
        line('lyra', 'concerned', 'Be careful. Strange things have been happening beyond the village.'),
        line('observer', 'thoughtful', "I'll find out what's happening."),
      ], act1.councilComplete ? 'Follow the northern road' : 'Agree to the village plan');
    case 'act1-gate':
      return conversation('The northern road', 'VILLAGE GATE', act1.councilComplete ? [
        line('tomas', 'happy', 'The northern road is open. Your first companion, DataDex, and battle practice should serve you well.'),
        line('tomas', 'thoughtful', 'Find Professor Inferra at the forest field station. You can return to Harvest Village whenever you need a safe rest.'),
      ] : [
        line('tomas', 'concerned', 'The north road is closed while the village recovers from the storm.'),
        line('tomas', 'thoughtful', !act1.dexReceived ? 'Help Lyra recover and compare the rainfall records first. She is working from the research lab.'
          : context.hasStarter === false || !context.starterName ? 'Choose a companion at the lab, then practice with Kai in the square.'
          : !context.rivalDefeated ? 'Kai is waiting in the square. Practice together before you travel.'
          : 'Rowan and Lyra are gathering the council in the square. Speak to Rowan before you leave.'),
      ], act1.councilComplete ? 'Enter Twin Scholars’ Forest' : 'Return to the village');
    case 'act1-home':
      return conversation('A light left on', 'YOUR HOME', [
        line('narrator', 'neutral', 'Your boots leave a muddy pair of prints by the door. A dry blanket waits beside the bed.'),
        line('observer', 'thoughtful', 'The village needs answers. I can take a breath before I go looking.'),
        line('narrator', 'happy', 'Rest here to restore your companions. Save your journey when you are ready; your records will wait.'),
      ], 'Rest and save');
    case 'act1-sanctuary':
      return conversation('Care before the next journey', 'RESEARCH SANCTUARY', [
        line('elin', 'happy', `Welcome, ${player}. Adventuring is hard work for a pair of feet, or four.`),
        line('elin', 'thoughtful', 'We restore your companions and help replenish field supplies. You can review your team here before setting out.'),
        line('elin', 'happy', 'A borrowed training Cloudfin helps with Kai’s switching lesson. It returns to us afterward; your first partner stays with you.'),
      ], 'Open sanctuary services');
    case 'act1-side': {
      const side = act1.side || {};
      const sideConversations = {
        child: [line('child', side.scarfReturned ? 'happy' : 'concerned', side.scarfReturned ? 'My scarf is back! Next time the Oracle says dry weather, I am bringing my boots anyway.' : side.scarfFound ? 'You found my scarf! May I have it back? I saved a few coins to say thank you.' : 'The Oracle said no rain! So why are my boots full of water? My scarf blew toward the old bridge, too.')],
        scarf: [line('narrator', 'thoughtful', side.scarfFound ? 'The scarf is safe. Its owner is waiting near the village square.' : 'A red scarf flutters on a low branch beside the old bridge. A child in the square was looking for one.')],
        observer: [line('orin', 'thoughtful', side.oldJournal ? 'That old Observer journal reminds us to keep the place and time beside every reading. Your Archive Fragment preserves its story.' : 'An old Observer left a journal on the tower’s lower shelf. “Write what you see. Write where you stood. Leave room to be mistaken.”')],
        supply: [line('narrator', 'happy', side.supplyChest ? 'The hidden supply chest is empty. Its potion is already safely packed.' : 'A narrow way behind the shop crates leads to a forgotten supply chest. The bottle inside is still sealed.')],
        garden: [line('mara', side.gardenCleared ? 'happy' : 'concerned', side.gardenCleared ? 'Water is flowing through the garden channel again. You noticed what the plants needed and did something about it.' : 'The flood left branches across the garden drain. Clear the debris and the roots will have a chance to dry.')],
      };
      const aliases = {scarf_find:'scarf', scarf_return:'child', old_journal:'observer', supply_chest:'supply', garden_clear:'garden'};
      return conversation('Small things worth saving', 'OPTIONAL VILLAGE DISCOVERY', sideConversations[aliases[detailId] || detailId] || sideConversations.child, 'Help the village');
    }
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
        line('kai', 'happy', 'For our first lesson, Lyra lends you a training Cloudfin. Try Attack, Guard, Scan, and Switch, then finish the match. Cloudfin goes home afterward.'),
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
        line('kai', 'happy', context.act1 && !act1.migrated && !act1.councilComplete
          ? 'Rowan and Lyra are gathering the village council in the square. Show them you and your partner are ready. I will work on my rematch face.'
          : context.act1 && act1.councilComplete
            ? 'The northern road is open. Professor Inferra is waiting in the forest. Go on. I will work on my rematch face.'
            : 'The eastern road\'s open. Professor Inferra is waiting in the forest. Go on. I\'ll work on my rematch face.'),
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
