import { SPECIES, HABITATS, createGame, act, saveGame, loadGame, serializeGame, parseGame, SAVE_KEY } from './engine.js';
import { MAPS, isWalkable, renderWorld, drawCreature } from './world.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = createGame();
let storage = null;
let resumed = false;
let savingAvailable = true;
let unreadableSave = false;
const checkedWorldState = candidate => {
  if (!isWalkable(candidate.map,candidate.player.x,candidate.player.y)) throw new Error('The saved player position is outside the walkable map.');
  return candidate;
};
try {
  storage = window.localStorage;
  const loaded = loadGame(storage);
  if (loaded) {
    try { state = checkedWorldState(loaded); resumed = true; } catch { unreadableSave = true; }
  } else if (storage.getItem(SAVE_KEY) !== null) unreadableSave = true;
} catch { savingAvailable = false; }
let modal = null;
let modalData = {};
let returnFocus = null;
let path = [];
let pathTarget = null;
let lastStep = 0;
let lastDraw = 0;
let toastTimer;
let dexTab = 'creatures';
let sound = false;
let audioContext;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const speciesEntries = () => Object.entries(SPECIES);
const habitats = () => Array.isArray(HABITATS) ? HABITATS : Object.values(HABITATS);
const creatureName = (id) => SPECIES[id]?.name || id?.replace('creature_', '') || 'Databeast';
const conceptStatus = (id) => state.dex.concepts[id]?.status || state.dex.concepts[id] || 'unknown';
const quest = () => state.quests.nocturnal;
const observations = () => quest().observations || [];
const hasObserved = (habitatId, time) => observations().some(o => o.habitatId === habitatId && o.time === time);
const dexEntry = (id) => state.dex.species[id] || {};
const habitatName = (id) => habitats().find(h => h.id === id)?.title || id;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}

function chime(kind = 'action') {
  if (!sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(kind === 'success' ? 660 : 440, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'success' ? 990 : 550, audioContext.currentTime + .14);
    gain.gain.setValueAtTime(.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .2);
  } catch { sound = false; }
}

function persist(manual = false) {
  try {
    if (!storage) throw new Error('Browser storage is unavailable');
    saveGame(state, storage);
    savingAvailable = true;
    $('save-status').innerHTML = '<span>●</span> Saved in this browser · ' + esc(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    if (manual) toast('Your journey has been saved.');
  } catch {
    savingAvailable = false;
    $('save-status').textContent = 'Automatic saving unavailable · Export a save in Save & load';
    if (manual) toast('Browser storage is unavailable. Export your save to keep your progress.');
  }
}

function dispatch(action, {quiet = false} = {}) {
  const before = state;
  try {
    const result = act(state, action);
    state = result.state;
    persist();
    updateUI();
    if (!quiet && result.events?.length) toast(result.events[result.events.length - 1]);
    if (before.battle && !state.battle) {
      const won = before.battle.kind === 'rival' && (result.events || []).some(event => event.startsWith('Kai:'));
      const recruited = !before.flags.recruitedVoltkit && state.flags.recruitedVoltkit;
      modal = 'battle-result';
      modalData = {won, recruited, events:result.events || []};
      chime(won || recruited ? 'success' : 'action');
    }
    if (modal) renderModal();
    return true;
  } catch (error) { toast(error.message || 'That action is not available yet.'); return false; }
}

function objectiveContent() {
  const q = quest();
  if (!state.starter) return {title:'A new Observer',text:'Meet Professor Lyra at the research lab. A Databeast is waiting to become your first companion.',count:'Speak to Lyra · Research lab',progress:0};
  if (!state.flags.rivalDefeated) return {title:'The first bond',text:'Kai is waiting in the village square. Try your companion’s moves, guard, and a free DataDex scan.',count:'Challenge Kai · Village square',progress:20};
  if (q.status === 'locked') return {title:'Beyond the village',text:'Follow the eastern road into the Twin Scholars’ Forest. Professor Inferra has a mystery for you.',count:'Meet Inferra · Forest field station',progress:35};
  if (q.status === 'active' || q.status === 'ready') return {title:'The Nocturnal Mystery',text:observations().length < 6 ? 'The ranger only watches at night. Visit three habitats in both daylight and moonlight to test the claim.' : 'Your field notes tell a fuller story. Bring your evidence to Inferra and draw a conclusion.',count:observations().length + ' / 6 habitat & time observations',progress:40+observations().length*8};
  if (!state.flags.recruitedVoltkit) return {title:'A spark of friendship',text:'Your investigation is complete. A curious Voltkit waits in the forest glade. Scan, weaken, and use a Bond Crystal.',count:'Recruit Voltkit · Spark glade',progress:90};
  return {title:'An Observer awakens',text:'You questioned the evidence and made a new friend. Explore, review your DataDex, or master the sampling challenge.',count:'Stage 1 adventure complete',progress:100};
}

function portrait(id, size = 120, extra = '') { return `<canvas class="creature-art ${extra}" width="${size}" height="${size}" data-species="${esc(id)}" aria-label="${esc(creatureName(id))}"></canvas>`; }

function paintPortraits(root = document) {
  root.querySelectorAll('canvas[data-species]').forEach(canvas => drawCreature(canvas, canvas.dataset.species, {x:0,y:0,size:Math.min(canvas.width,canvas.height),flip:canvas.classList.contains('player-art')}));
}

function updateUI() {
  const forest = state.map === 'forest';
  $('location-title').textContent = forest ? 'Twin Scholars’ Forest' : 'Harvest Village';
  $('region-label').textContent = forest ? 'Route 01 · A question in the trees' : 'Your home in the Vale of Records';
  $('time-button').innerHTML = state.time === 'night' ? '☾ <span>Nighttime</span>' : '☀ <span>Daytime</span>';
  $('time-button').title = forest ? 'Walk to the campfire to change time' : 'Day and night change at the forest campfire';
  $('map-weather').textContent = state.time === 'night' ? 'UNDER THE MOON' : forest ? 'THROUGH THE CANOPY' : 'AFTER THE RAIN';
  $('map-coordinates').textContent = forest ? 'TWIN SCHOLARS · ROUTE 01' : 'VALE OF RECORDS · 01';
  $('world').setAttribute('aria-label', `${forest ? 'Twin Scholars’ Forest' : 'Harvest Village'}, ${state.time}. Use arrow keys or WASD to walk. E to interact. Click a destination.`);
  const objective = objectiveContent();
  $('objective').innerHTML = `<div class="eyebrow">CURRENT OBJECTIVE</div><h3>${esc(objective.title)}</h3><p>${esc(objective.text)}</p><div class="objective-progress"><i style="width:${objective.progress}%"></i></div><div class="objective-count">${esc(objective.count)}</div>`;
  const steps = [
    {title:'Choose a companion',done:!!state.starter},
    {title:'Battle your rival',done:state.flags.rivalDefeated},
    {title:'Follow the forest road',done:quest().status !== 'locked'},
    {title:'Question the evidence',done:quest().status === 'complete'},
    {title:'Befriend a wild Databeast',done:state.flags.recruitedVoltkit}
  ];
  let currentSet = false;
  $('journey-list').innerHTML = steps.map((s,i) => {
    const current = !s.done && !currentSet; if (current) currentSet = true;
    return `<li class="${s.done ? 'done' : current ? 'current' : ''}"><span class="step-circle">${s.done ? '✓' : i+1}</span>${esc(s.title)}</li>`;
  }).join('');
  $('party-count').textContent = `${state.party.length} / 4`;
  $('party-grid').innerHTML = state.party.map(c => `<div class="party-card">${portrait(c.speciesId,80)}<div><h3>${esc(creatureName(c.speciesId))}</h3><p>Lv. ${c.level} · ${c.hp}/${c.maxHp} HP</p><div class="mini-hp"><i style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></i></div></div></div>`).join('') + Array.from({length:Math.max(0,4-state.party.length)}, () => '<div class="party-card empty"><span>+</span><small>A bond to discover</small></div>').join('');
  $('supplies').innerHTML = `<span title="Healing potions"><b>♧</b> ${state.inventory.potions} potions</span><span title="Bond Crystals"><b>◇</b> ${state.inventory.bondCrystals} crystals</span><span title="Aether Coins"><b>◉</b> ${state.coins || 0}</span>`;
  $('investigation-button').innerHTML = `Open investigation <span>↗</span>`;
  if (!savingAvailable) $('save-status').textContent = 'Automatic saving unavailable · Export a save in Save & load';
  paintPortraits($('party-grid'));
  updatePrompt();
}

function currentTargets() { return MAPS[state.map].interactables; }
function nearTarget() { return currentTargets().map(t => ({...t,distance:Math.abs(t.x-state.player.x)+Math.abs(t.y-state.player.y)})).filter(t=>t.distance<=1).sort((a,b)=>a.distance-b.distance)[0]; }
function updatePrompt() {
  const target = nearTarget();
  $('interaction-prompt').hidden = !target || !!modal;
  if (target) $('interaction-prompt').innerHTML = '<kbd>E</kbd>' + esc(target.name);
  $('interact-button').textContent = target ? `${target.name} ↗` : 'Places to visit ↗';
}

function findPath(x, y, adjacency = false) {
  const start = {x:state.player.x,y:state.player.y};
  const queue = [start]; const visited = new Set([`${start.x},${start.y}`]); const parents = new Map();
  let end;
  for (let i=0;i<queue.length;i++) {
    const p=queue[i];
    if (Math.abs(p.x-x)+Math.abs(p.y-y) <= (adjacency ? 1 : 0)) { end=p; break; }
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const n={x:p.x+dx,y:p.y+dy}; const key=`${n.x},${n.y}`;
      if (visited.has(key) || !isWalkable(state.map,n.x,n.y)) continue;
      visited.add(key); parents.set(key,p); queue.push(n);
    }
  }
  if (!end) return null;
  const points=[];
  while (end.x!==start.x || end.y!==start.y) { points.unshift(end); end=parents.get(`${end.x},${end.y}`); }
  return points;
}

function goTo(target) {
  const route=findPath(target.x,target.y,true);
  if (!route) { toast('The path is blocked. Try approaching from the road.'); return; }
  path=route; pathTarget=target;
  if (!path.length) { pathTarget=null; interact(target); }
}

function step(direction) {
  if (modal || state.battle) return;
  const [dx,dy]=({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]})[direction];
  const x=state.player.x+dx,y=state.player.y+dy;
  if (!isWalkable(state.map,x,y)) return;
  dispatch({type:'MOVE',x,y,facing:direction},{quiet:true});
}

function travel(map) {
  const p=MAPS[map].spawn;
  if (dispatch({type:'MOVE',map,x:p.x,y:p.y,facing:'down'},{quiet:true})) {
    closeModal(); toast(map === 'forest' ? 'Twin Scholars’ Forest · Follow your curiosity.' : 'Welcome back to Harvest Village.');
  }
}

function interact(target = nearTarget()) {
  if (state.battle) { openModal('battle'); return; }
  if (!target) { openModal('places'); return; }
  path=[]; pathTarget=null;
  if (target.id === 'lab') { openModal(state.starter ? 'lyra' : 'starters'); }
  else if (target.id === 'kai') {
    if (!state.starter) { openDialogue('Kai','A friendly challenge','“Lyra has three companions waiting for you. Choose one, then we can have our first battle!”'); }
    else if (state.flags.rivalDefeated) { openModal('rival'); }
    else openModal('rival');
  } else if (target.id === 'sanctuary') openModal('sanctuary');
  else if (target.id === 'gate') {
    if (!state.flags.rivalDefeated) openDialogue('Village gate','Before the forest','Your first adventure lies beyond this road. Choose a companion and finish Kai’s friendly battle before venturing into the wilderness.');
    else travel('forest');
  } else if (target.id === 'exit') travel('village');
  else if (target.id === 'home') openModal('save');
  else if (target.id === 'sign') openModal('places');
  else if (target.id === 'tower') openModal('tower');
  else if (target.id === 'inferra') {
    if (quest().status === 'locked') openModal('inferra'); else openModal('investigation');
  } else if (target.id === 'camp') openModal('camp');
  else if (['meadow','riverbank','canopy'].includes(target.id)) openModal('habitat',{habitatId:`habitat_${target.id}`});
  else if (target.id === 'voltkit') openModal('wild');
  chime();
}

function openDialogue(title, subtitle, text) { openModal('dialogue',{title,subtitle,text}); }
function openModal(type, data = {}) {
  if (!modal) returnFocus=document.activeElement;
  path=[]; pathTarget=null; modal=type; modalData=data;
  renderModal(); updatePrompt();
}
function closeModal() {
  if (state.battle) {
    if (modal !== 'battle') { openModal('battle'); return; }
    toast('Finish this encounter, or flee from a wild battle.'); return;
  }
  modal=null; modalData={}; $('modal-root').innerHTML=''; updatePrompt();
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); else $('world').focus({preventScroll:true});
}

function modalShell(title, subtitle, body, {wide=false,battle=false}={}) {
  return `<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div class="modal-top"><div><p class="eyebrow">${esc(subtitle)}</p><h2 id="modal-heading">${esc(title)}</h2></div>${battle?'<div class="battle-menu"><button data-action="dex" aria-label="Open DataDex">▧ DataDex</button><button data-action="save-menu" aria-label="Open save and load">↓ Save & load</button></div>': '<button class="close-modal" data-action="close" aria-label="Close dialog">×</button>'}</div>${battle ? body : `<div class="modal-content">${body}</div>`}</section></div>`;
}

function renderModal() {
  if (!modal) return;
  let html='';
  if (modal === 'welcome') {
    html=modalShell('Every adventure begins with a question.','WELCOME, OBSERVER',`<div class="welcome-art"><span class="diamond">✧</span>${portrait('creature_statifox')}${portrait('creature_algobear')}${portrait('creature_terradeer')}</div><div class="forecast-strip"><div><span>ORACLE FORECAST · DAY 127</span><strong>0 mm</strong></div><div><span>ACTUAL RAINFALL</span><strong class="rain">46 mm</strong></div><div><span>ARCHIVE STATUS</span><strong style="font-size:17px">“Perfect.”</strong></div></div><p>The fields of Harvest Village are soaked. The Grand Archive insists no rain has fallen. Professor Lyra needs an Observer willing to trust what they can see.</p><label class="name-label" for="observer-name">What should we call you?</label><input id="observer-name" class="text-input" autocomplete="nickname" maxlength="24" value="Observer" placeholder="Your name"><div class="modal-actions"><button class="primary-button" data-action="begin">Begin your journey <span>→</span></button><button class="secondary-button" data-action="close">Explore the village</button></div><p class="save-info">A short, complete prototype adventure. Progress saves in this browser after every action.</p>`);
  } else if (modal === 'starters') {
    const descriptions={creature_statifox:'Notices patterns others miss. Quick on its paws, with a sharp eye for evidence.',creature_algobear:'A dependable thinker. Strong defenses and precise, powerful attacks.',creature_terradeer:'Reads the landscape like an old friend. Balanced strength and gentle healing.'};
    const roles={creature_statifox:'Mathematics & statistics',creature_algobear:'Computer science',creature_terradeer:'Domain knowledge'};
    html=modalShell('Choose your first companion','PROFESSOR LYRA · THE FIRST BOND',`<p>“Each of them sees the world a little differently. The strongest discoveries come from working together. Who will join your journey?”</p><div class="starter-grid">${['creature_statifox','creature_algobear','creature_terradeer'].map(id=>`<button class="starter-card" data-action="choose" data-id="${id}">${portrait(id,140)}<h3>${esc(creatureName(id))}</h3><span class="type">${roles[id]}</span><p>${descriptions[id]}</p><div class="starter-stats"><span>Lv. 5</span><span>${esc(SPECIES[id]?.role || 'Starter companion')}</span></div><span class="choose">Choose ${esc(creatureName(id))} ↗</span></button>`).join('')}</div>`,{wide:true});
  } else if (modal === 'lyra') {
    html=modalShell('Listen to the world','PROFESSOR LYRA · RESEARCH LAB',`<p>“The Oracle’s forecast is only as useful as the observations behind it. Someone may have removed evidence from the Archive.”</p><p>${state.flags.rivalDefeated?'“Professor Inferra is investigating strange reports in the northern forest. Follow the eastern road, and keep your DataDex close.”':'“Kai is waiting in the square. Try your companion’s moves, and scan your opponent. Curiosity is a strength.”'}</p><div class="evidence-note">Your DataDex records creatures and research discoveries. Open it at any time to see how your understanding grows.</div><div class="modal-actions"><button class="primary-button" data-action="dex">Open DataDex</button><button class="secondary-button" data-action="close">Back to exploring</button></div>`);
  } else if (modal === 'rival') {
    html=modalShell('A friendly rivalry','KAI · VILLAGE SQUARE',`<p>“There you are, ${esc(state.player.name)}! Let’s see what your new companion can do. I’ll help you up if things go sideways.”</p><div class="evidence-note">Choose an attack to take a turn. Guard reduces incoming damage and restores Focus. Your first DataDex scan is free and reveals your opponent’s recent behavior.</div><p>Healing potions restore HP. After you recruit another companion, you can switch your active Databeast during a battle.</p><div class="modal-actions"><button class="primary-button" data-action="start-battle" data-kind="rival">Challenge Kai ⚔</button><button class="secondary-button" data-action="close">A little more exploring</button></div>`);
  } else if (modal === 'sanctuary') {
    html=modalShell('A place to catch your breath','RESEARCH SANCTUARY',`<p>Your companions gather around the warm glow of the sanctuary. The village takes care of its Observers.</p><div class="settings-grid"><div class="settings-row"><div><strong>Restore your party</strong><p>Recover all HP and Focus. Always free.</p></div><button class="primary-button small-button" data-action="heal">Heal party</button></div><div class="settings-row"><div><strong>Field supplies</strong><p>Replenish potions and Bond Crystals for this prototype.</p></div><button class="secondary-button small-button" data-action="restock">Restock</button></div></div><div class="modal-actions"><button class="secondary-button" data-action="close">Back to the village</button></div>`);
  } else if (modal === 'tower') {
    html=modalShell('The rain that wasn’t supposed to fall','WEATHER TOWER · FIELD RECORDS',`<div class="forecast-strip"><div><span>ORACLE PREDICTION</span><strong>0 mm</strong></div><div><span>MEASURED RAINFALL</span><strong class="rain">46 mm</strong></div></div><p>The village’s rain gauge disagrees with the Oracle. Farmer Rowan shows you years of handwritten rainfall records.</p><div class="opening-quote">“Our ancestors learned by watching the world. They kept records so the next generation could make better decisions.”</div><p>One bad forecast does not tell us everything about the system. It does give us a reason to investigate its evidence.</p><div class="modal-actions"><button class="primary-button" data-action="dex">Review observations</button><button class="secondary-button" data-action="close">Keep exploring</button></div>`);
  } else if (modal === 'inferra') {
    html=modalShell('Is the whole forest nocturnal?','PROFESSOR INFERRA · FIELD STATION',`<p>“The ranger says nearly every Databeast here is active at night. His notes look convincing… until you ask when he goes looking.”</p><div class="evidence-note">Ranger’s notebook: 18 Bayowl and 12 Samplet sightings. All recorded at night, in the canopy. A real observation — from a narrow part of the forest.</div><p>“Visit the meadow, riverbank, and canopy. Observe each one by day <strong>and</strong> by night. Rest at the campfire to change time. Then bring me a fuller picture.”</p><div class="modal-actions"><button class="primary-button" data-action="start-investigation">Take the field assignment →</button><button class="secondary-button" data-action="close">Look around first</button></div>`);
  } else if (modal === 'camp') {
    html=modalShell(state.time === 'day'?'Wait for the stars':'Wait for the morning','FOREST CAMP · DAY & NIGHT',`<p>The campfire crackles. Different creatures stir at different times. Changing when you look can change what you discover.</p><div class="evidence-note">Current time: ${state.time === 'day'?'daylight ☀':'nighttime ☾'}. Observations already collected stay in your DataDex.</div><div class="modal-actions"><button class="primary-button" data-action="change-time">Rest until ${state.time === 'day'?'night ☾':'day ☀'}</button><button class="secondary-button" data-action="close">Keep exploring</button></div>`);
  } else if (modal === 'habitat') {
    const id=modalData.habitatId; const h=habitats().find(h=>h.id===id); const data=h?.observations?.[state.time] || h?.[state.time] || [];
    const recorded=hasObserved(id,state.time); const active=['active','ready','complete'].includes(quest().status);
    html=modalShell(h?.title || 'Forest habitat',`${state.time === 'day'?'☀ DAYLIGHT':'☾ MOONLIGHT'} · FIELD OBSERVATION`, `<p>${esc(h?.description || 'You take a quiet moment to watch the creatures in this habitat. These sightings belong to this place and this time.')}</p><div class="sighting-list">${data.map(o=>`<div class="sighting">${portrait(o.speciesId,100)}<h3>${esc(creatureName(o.speciesId))}</h3><small>${o.count} sightings</small></div>`).join('')}</div><div class="evidence-note">${recorded?'✓ This habitat and time are already in your field notes.':active?'Record this snapshot to compare it with other habitats and times.':'Meet Professor Inferra at the field station to begin the investigation.'} A sighting count describes what you saw; it does not count every creature living in the forest.</div><div class="modal-actions"><button class="primary-button" data-action="observe" data-id="${esc(id)}" ${recorded||!active?'disabled':''}>${recorded?'Observation recorded ✓':'Record in DataDex'}</button><button class="secondary-button" data-action="close">Continue exploring</button></div>`);
  } else if (modal === 'investigation') html=investigationModal();
  else if (modal === 'wild') {
    html=modalShell(state.flags.recruitedVoltkit?'A familiar spark':'A spark in the tall grass','WILD VOLTKIT · SPARK GLADE',`<div class="welcome-art">${portrait('creature_voltkit')}</div><p>${state.flags.recruitedVoltkit?'Your Voltkit gives a cheerful flick of its electric tail. You remember the patient observation that brought you together.':'A Voltkit peeks through the grass. Electricity dances between its ears. Perhaps an Observer with a little patience could earn its trust.'}</p><div class="evidence-note">Scan once for free, lower its HP, then use a Bond Crystal. Scanning and weakening improve your chance to bond. If it escapes the crystal, try again. If you defeat it, you can return for another encounter.</div><div class="modal-actions"><button class="primary-button" data-action="start-battle" data-kind="wild" ${!state.starter||state.flags.recruitedVoltkit?'disabled':''}>Approach Voltkit ◇</button><button class="secondary-button" data-action="close">Leave it in peace</button></div>`);
  } else if (modal === 'battle') html=battleModal();
  else if (modal === 'battle-result') {
    const {won,recruited,events}=modalData;
    html=modalShell(recruited?'A new bond':won?'The first of many victories':'Every encounter teaches you something','ENCOUNTER COMPLETE',`<div class="completion"><div class="completion-mark">${recruited?'◇':won?'✧':'♧'}</div><h3>${recruited?'Voltkit joined your team!':won?'Well played, Observer.':'Take a breath. Try again.'}</h3><p>${esc(events.join(' '))}</p>${won?'<p>Kai grins. “All right, you’ve got this! The eastern road is open. Professor Inferra is waiting in the forest.”</p>':''}<div class="modal-actions"><button class="primary-button" data-action="close">Continue the adventure →</button>${recruited?'<button class="secondary-button" data-action="dex">See DataDex entry</button>':''}</div></div>`);
  } else if (modal === 'complete') {
    html=modalShell('The Nocturnal Mystery, solved','DISCOVERY · THE VALUE OF A BETTER SAMPLE',`<div class="completion"><div class="completion-mark">✧</div><h3>A fuller picture of the forest.</h3><p>“We weren’t studying the whole forest,” Inferra says. “We were only studying the creatures we could see at night.”</p><p>Your observations show that activity varies across habitats and times. The ranger’s sample cannot support his claim about the entire forest. Your broader sample helps, while leaving room for more evidence.</p><div class="reward-row"><span>✥ Sampling Compass</span><span>Sampling bias · Understood</span><span>Research discovery recorded</span></div><div class="modal-actions"><button class="primary-button" data-action="close">Keep exploring →</button><button class="secondary-button" data-action="mastery">Try the optional challenge</button></div></div>`);
  } else if (modal === 'mastery' && conceptStatus('concept_sampling_bias') === 'mastered') {
    html=modalShell('A thoughtful field researcher','SAMPLING BIAS ? MASTERED','<p>Your DataDex has recorded your mastery: observe several habitats at different times using a consistent method. More observations help, and the collection method still matters.</p><div class="modal-actions"><button class="primary-button" data-action="dex">Review discoveries</button><button class="secondary-button" data-action="close">Keep exploring</button></div>');
  } else if (modal === 'mastery') {
    html=modalShell('Plan the next expedition','OPTIONAL CHALLENGE · SAMPLING BIAS',`<p>Inferra wants to learn about activity across the <strong>whole forest</strong>. Which plan gives her a more representative sample?</p><div class="findings"><button class="finding-button" data-action="master" data-answer="representative">Observe several habitats at different times, using a consistent method in each.</button><button class="finding-button" data-action="master" data-answer="night">Collect many more observations from the same canopy at night.</button><button class="finding-button" data-action="master" data-answer="certain">Watch one creature until we are certain about the entire forest.</button></div><p class="save-info">More observations alone do not fix a sampling method that leaves out important groups.</p>`);
  } else if (modal === 'dex') html=dexModal();
  else if (modal === 'save') html=saveModal();
  else if (modal === 'reset') {
    html=modalShell('Begin a new journey?','SAVE & LOAD',`<p>This replaces the progress saved in this browser. You can export your current journey first to keep it.</p><div class="modal-actions"><button class="secondary-button" data-action="export">Export current save</button><button class="danger-button" data-action="reset-confirm">Start a new journey</button><button class="secondary-button" data-action="save-menu">Keep playing</button></div>`);
  } else if (modal === 'places') {
    html=modalShell('Follow the village paths',state.map==='forest'?'TWIN SCHOLARS’ FOREST · PLACES TO VISIT':'HARVEST VILLAGE · PLACES TO VISIT',`<p>Click a place below to walk there. You can also click directly on the map or use WASD and the arrow keys.</p><div class="destination-list">${currentTargets().filter(t=>t.id!=='sign').map(t=>`<button data-action="walk-to" data-id="${esc(t.id)}">${esc(t.name)} <span style="float:right">↗</span></button>`).join('')}</div>`);
  } else if (modal === 'help') {
    html=modalShell('Your first field guide','THE CHRONICLES OF DATA · STAGE 1',`<p>Explore a small original RPG world, form a team, and uncover a misleading claim by collecting evidence. You can complete the investigation with any starter.</p><table class="control-table"><tr><td>Walk</td><td>WASD / arrow keys / click map</td></tr><tr><td>Talk, observe, or enter</td><td>E / Space / click a place</td></tr><tr><td>Open DataDex</td><td>X</td></tr><tr><td>Save & load</td><td>P</td></tr><tr><td>Close a dialog</td><td>Escape</td></tr></table><p>Choose a companion in Lyra’s lab, battle Kai, then enter the forest from the eastern gate. Speak to Inferra and observe each habitat by day and night. Rest at the campfire to change time.</p><p>Visit the sanctuary for free healing and supplies. Battles are turn based: scan, attack, guard, switch, use a potion, or bond with a weakened wild creature.</p><div class="evidence-note">This prototype includes one village, one route, three starters, Kai’s battle, Voltkit recruitment, and one complete investigation. Later chapter regions and evolutions belong to future stages.</div><div class="modal-actions"><button class="primary-button" data-action="close">Back to the adventure</button><button class="secondary-button" data-action="places">Places to visit</button></div>`);
  } else if (modal === 'dialogue') html=modalShell(modalData.title,modalData.subtitle,`<p>${esc(modalData.text)}</p><div class="modal-actions"><button class="primary-button" data-action="close">Continue exploring</button></div>`);
  $('modal-root').innerHTML=html;
  paintPortraits($('modal-root'));
  const focusable=$('modal-root').querySelector('input, button:not(:disabled), [tabindex="0"]');
  focusable?.focus({preventScroll:true});
  const log=$('modal-root').querySelector('.battle-log'); if (log) log.scrollTop=log.scrollHeight;
}

function investigationModal() {
  const q=quest();
  if (q.status === 'locked') return modalShell('A mystery awaits','FIELD JOURNAL',`<p>Finish Kai’s battle in Harvest Village, then follow the eastern road into the forest. Professor Inferra will explain her field investigation.</p><div class="modal-actions"><button class="primary-button" data-action="close">Back to exploring</button></div>`);
  const count=observations().length;
  const complete=q.status==='complete';
  const totals={day:0,night:0};
  observations().forEach(o=>{const h=habitats().find(h=>h.id===o.habitatId); const data=o.sightings||o.observations||h?.observations?.[o.time]||h?.[o.time]||[]; totals[o.time]+=(Array.isArray(data)?data.reduce((n,s)=>n+s.count,0):0);});
  const max=Math.max(totals.day,totals.night,1);
  const hintTexts=[
    'The ranger visits only the canopy, and only at night. What part of the forest is missing from his notebook?',
    'Compare the same habitat in daylight and moonlight. Then compare habitats. Does one place and time represent all of them?',
    'A sample collected only at night is biased toward creatures visible at night. It does not establish that nearly every creature in the forest is nocturnal.'
  ];
  return modalShell('The Nocturnal Mystery',`C1-03 · ${complete?'INVESTIGATION COMPLETE':`${count} / 6 FIELD OBSERVATIONS`}`,`<p>The ranger claims nearly every forest Databeast is nocturnal. His original sample came only from the canopy at night. Test whether those records represent the entire forest.</p><div class="sampling-grid"><div class="sample-heading">HABITAT</div><div class="sample-heading">☀ DAYLIGHT</div><div class="sample-heading">☾ MOONLIGHT</div>${habitats().map(h=>`<div class="sample-title">${esc(h.title)}</div>${['day','night'].map(t=>`<div class="${hasObserved(h.id,t)?'recorded':''}">${hasObserved(h.id,t)?'✓ Recorded':state.flags.compass?'✥ Unobserved':'○ Not observed'}</div>`).join('')}`).join('')}</div><h3>What your sample shows</h3><div class="chart-legend"><span><i></i>Day sightings</span><span><i class="night"></i>Night sightings</span></div><div class="research-chart">${['day','night'].map(t=>`<div class="chart-row ${t}"><span>${t==='day'?'Daylight':'Moonlight'}</span><div class="bar"><i style="width:${totals[t]/max*100}%"></i></div><span>${totals[t]}</span></div>`).join('')}</div><div class="evidence-note">These are recorded sightings, not a census of unique creatures or an estimate of an individual creature’s probability of activity. Compare habitat and time coverage before drawing a conclusion.</div>${complete?'<p><strong>Conclusion:</strong> The initial sample was biased. Activity varies across habitats and times; the ranger’s records cannot justify a claim about the entire forest.</p><div class="modal-actions"><button class="primary-button" data-action="mastery">Optional mastery challenge</button><button class="secondary-button" data-action="dex">View learning entry</button></div>':`<h3>What can we conclude?</h3><div class="findings"><button class="finding-button" data-action="finding" data-answer="nocturnal" ${count<6?'disabled':''}>Nearly every forest Databeast must be nocturnal.</button><button class="finding-button" data-action="finding" data-answer="biased" ${count<6?'disabled':''}>The ranger’s sample leaves out habitats and times. We need broader evidence.</button><button class="finding-button" data-action="finding" data-answer="certain" ${count<6?'disabled':''}>Our new sample proves exactly how every creature will behave.</button></div>${count<6?'<p class="save-info">Visit all three habitats in both daylight and moonlight before submitting your finding.</p>':''}<div class="modal-actions"><button class="secondary-button" data-action="hint">${q.hints>=3?'Review guided explanation':'A nudge from Inferra'}</button><button class="secondary-button" data-action="close">Back to the field</button></div>${q.hints>0?`<div class="hint-box">${hintTexts[Math.min(q.hints,3)-1]}</div>`:''}`}`,{wide:true});
}

function battleModal() {
  const b=state.battle;
  if (!b) { modal='battle-result'; return modalShell('Encounter complete','FIELD JOURNAL','<p>The encounter has ended. Continue your adventure.</p><button class="primary-button" data-action="close">Continue</button>'); }
  const player=state.party[b.activeIndex]; const enemy=b.enemy;
  const moves=SPECIES[player.speciesId].moves;
  const history=b.enemyHistory || [];
  const moveCounts={}; history.forEach(m=>{ const name=typeof m==='string'?m:m.moveName||m.name||m.moveId||'an action'; moveCounts[name]=(moveCounts[name]||0)+1; });
  const summary=Object.entries(moveCounts).map(([name,count])=>`${name}: ${count}/${history.length} observed turns`).join(' · ');
  return modalShell(b.kind==='rival'?'Kai’s friendly challenge':'Wild Voltkit encounter',`TURN ${b.turn} · ${b.kind==='rival'?'LEARN TOGETHER':'A CHANCE TO BOND'}`,`<div class="battle-stage"><div class="ground"></div><div class="ground enemy"></div>${portrait(player.speciesId,180,'player-art')}${portrait(enemy.speciesId,150,'enemy')}<div class="battle-stat enemy"><h3>${esc(creatureName(enemy.speciesId))}<small>Lv. ${enemy.level}</small></h3><div class="hp-bar"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i></div><p><span>HP</span><span>${enemy.hp} / ${enemy.maxHp}</span></p></div><div class="battle-stat"><h3>${esc(creatureName(player.speciesId))}<small>Lv. ${player.level}</small></h3><div class="hp-bar"><i style="width:${Math.max(0,player.hp/player.maxHp*100)}%"></i></div><p><span>${player.hp} / ${player.maxHp} HP</span><span>Focus ${player.focus}</span></p></div></div><div class="battle-body"><div><h3>What will ${esc(creatureName(player.speciesId))} do?</h3><div class="move-grid">${moves.map(m=>`<button class="move-button" data-action="battle-move" data-id="${esc(m.id)}" ${m.cost>player.focus?'disabled':''}>${esc(m.name)}<small>${esc(m.description || (m.power?'Power '+m.power:'Support'))}${m.cost?' · '+m.cost+' Focus':''}</small></button>`).join('')}<button class="move-button" data-action="guard">Guard<small>Reduce damage · recover Focus</small></button></div><div class="battle-tools"><button data-action="scan" ${b.scanned?'disabled':''}>${b.scanned?'✓ Scanned':'▧ Scan · free'}</button><button data-action="potion" ${state.inventory.potions<1?'disabled':''}>♧ Potion · ${state.inventory.potions}</button>${b.kind==='wild'?`<button class="bond" data-action="bond" ${state.inventory.bondCrystals<1?'disabled':''}>◇ Bond · ${state.inventory.bondCrystals}</button><button data-action="flee">Leave</button>`:''}</div>${state.party.length>1?`<div class="switch-list">${state.party.map((c,i)=>`<button data-action="switch" data-index="${i}" ${i===b.activeIndex||c.hp<=0?'disabled':''}>Switch to ${esc(creatureName(c.speciesId))} · ${c.hp} HP</button>`).join('')}</div>`:''}</div><div><h3>Encounter notes</h3><div class="battle-log" aria-live="polite">${(b.log||[]).slice(-8).map(line=>`<p>${esc(typeof line==='string'?line:line.text||JSON.stringify(line))}</p>`).join('')}</div><div class="battle-note">${b.scanned?`DataDex scan: ${summary?esc(summary)+'. ':''}Observed frequencies describe these turns. They do not guarantee the next move.`:'Your first scan is free. Observe behavior before choosing a strategy.'}${b.kind==='wild'?'<br>Bonding improves after a scan and at low HP. Avoid defeating it before using a crystal.':''}</div></div></div>`,{wide:true,battle:true});
}

function dexModal() {
  const entries=speciesEntries();
  const tabs=`<div class="tabs"><button class="${dexTab==='creatures'?'active':''}" data-action="dex-tab" data-tab="creatures">Databeasts · ${Object.values(state.dex.species).filter(v=>v.seen).length}</button><button class="${dexTab==='knowledge'?'active':''}" data-action="dex-tab" data-tab="knowledge">Discoveries</button><button class="${dexTab==='research'?'active':''}" data-action="dex-tab" data-tab="research">Field notes · ${observations().length}</button></div>`;
  let body;
  if (dexTab==='creatures') body=`<div class="dex-grid">${entries.map(([id,s])=>{const d=dexEntry(id);return `<div class="dex-card ${!d.seen?'locked':''}">${d.seen?portrait(id):'<div style="height:100px;display:grid;place-items:center;font:48px Georgia;color:#718b60">?</div>'}<h3>${d.seen?esc(s.name):'Undiscovered'}</h3><span class="pill">${d.recruited?'Bonded companion':d.seen?'Observed':'Not yet seen'}</span><p>${d.seen?esc(s.description||s.role||'A creature of Aetheria.'):'Explore habitats at different times to discover this creature.'}</p>${d.seen?`<p>${d.scans||0} scans recorded</p>`:''}</div>`;}).join('')}</div>`;
  else if (dexTab==='knowledge') {
    const concepts=[{id:'concept_observation',name:'Learning from observations',text:'Records of rainfall, sightings, and battle actions help us evaluate claims. Evidence gives us a reason to update what we believe.'},{id:'concept_sampling_bias',name:'Sampling bias',text:'A population is the whole group we want to learn about. A sample is the part we observe. If our method systematically leaves out habitats or times, its conclusions may not represent the forest.'}];
    body=concepts.map(c=>{const status=conceptStatus(c.id), stages=['unknown','encountered','understood','mastered'],index=stages.indexOf(status);return `<div class="concept-card"><h3>${c.name}<span class="pill">${esc(status)}</span></h3><p>${status==='unknown'?'An undiscovered idea. Keep observing and investigating.':c.text}</p><div class="knowledge-stages">${stages.map((s,i)=>`<span class="${i<=index?'reached':''}">${s}</span>`).join('')}</div></div>`;}).join('')+`<div class="evidence-note">A broader sample is an improvement, not a promise of certainty. A large sample can still be biased if collected using a narrow method.</div>${quest().status==='complete'?'<button class="secondary-button" data-action="mastery">Try the sampling mastery challenge</button>':''}`;
  } else body=`<p>${observations().length?'Your observations persist across visits, day and night, and saved games.':'Your field notebook is waiting. Meet Professor Inferra in the forest to begin.'}</p>${observations().map(o=>`<div class="settings-row"><div><strong>${esc(habitatName(o.habitatId))}</strong><p>${o.time==='day'?'☀ Daylight':'☾ Moonlight'} · ${esc((o.sightings||o.observations||[]).map?.(s=>`${creatureName(s.speciesId)} ×${s.count}`).join(', ')||'Recorded in the field')}</p></div><span class="pill">✓ Observed</span></div>`).join('')}<div class="modal-actions"><button class="secondary-button" data-action="investigation">Review investigation</button></div>`;
  return modalShell('The DataDex','OBSERVATIONS TODAY. DISCOVERIES FOR TOMORROW.',tabs+body,{wide:true});
}

function saveModal() {
  return modalShell('Keep your journey close','SAVE & LOAD · VERSION 1',`<p>Progress saves automatically after every action, including battle turns and field observations. Saves belong to this browser and this site address.</p><div class="settings-grid"><div class="settings-row"><div><strong>Save in this browser</strong><p>${savingAvailable?'Automatic saving is available.':'Browser storage is unavailable. Use export below.'}</p></div><button class="primary-button small-button" data-action="save">Save now</button></div><div class="settings-row"><div><strong>Load browser save</strong><p>Restore your most recent saved state.</p></div><button class="secondary-button small-button" data-action="load">Load</button></div><div class="settings-row"><div><strong>Take a copy with you</strong><p>Export a JSON file to back up or move your journey.</p></div><button class="secondary-button small-button" data-action="export">Export</button></div><div class="settings-row"><div><strong>Continue from a file</strong><p>Import a previously exported version 1 save.</p></div><button class="secondary-button small-button" data-action="import">Import</button></div></div><p class="save-info">Save schema v1 · Stable creature, quest, and concept identifiers · DataDex and unfinished encounters included.</p><div class="modal-actions"><button class="secondary-button" data-action="close">Back to the adventure</button><button class="danger-button" data-action="reset">New journey</button></div>`);
}

function exportSave() {
  const data=serializeGame(state); const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='chronicles-of-data-save.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000); toast('A copy of your journey was exported.');
}

$('modal-root').addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]'); if (!button || button.disabled) return;
  const a=button.dataset.action;
  if (a==='close') closeModal();
  else if (a==='begin') { const name=$('observer-name').value.trim()||'Observer'; if (dispatch({type:'SET_NAME',name},{quiet:true})) openModal('starters'); }
  else if (a==='choose') { if(dispatch({type:'CHOOSE_STARTER',speciesId:button.dataset.id})){closeModal();chime('success');} }
  else if (a==='start-battle') { if(dispatch({type:'START_BATTLE',kind:button.dataset.kind},{quiet:true}))openModal('battle'); }
  else if (a==='battle-move') dispatch({type:'BATTLE_MOVE',moveId:button.dataset.id},{quiet:true});
  else if (a==='guard') dispatch({type:'BATTLE_GUARD'},{quiet:true});
  else if (a==='scan') dispatch({type:'BATTLE_SCAN'},{quiet:true});
  else if (a==='potion') dispatch({type:'BATTLE_POTION'},{quiet:true});
  else if (a==='bond') dispatch({type:'BATTLE_BOND'},{quiet:true});
  else if (a==='flee') dispatch({type:'BATTLE_FLEE'},{quiet:true});
  else if (a==='switch') dispatch({type:'BATTLE_SWITCH',index:Number(button.dataset.index)},{quiet:true});
  else if (a==='heal') dispatch({type:'HEAL_PARTY'});
  else if (a==='restock') dispatch({type:'RESTOCK'});
  else if (a==='start-investigation') { if(dispatch({type:'START_INVESTIGATION'}))openModal('investigation'); }
  else if (a==='observe') { dispatch({type:'OBSERVE',habitatId:button.dataset.id});chime('success'); }
  else if (a==='change-time') { if(dispatch({type:'SET_TIME',time:state.time==='day'?'night':'day'})){closeModal();chime();} }
  else if (a==='finding') { const complete=quest().status==='complete'; if(dispatch({type:'SUBMIT_FINDING',answer:button.dataset.answer})&&!complete&&quest().status==='complete'){openModal('complete');chime('success');} }
  else if (a==='hint') dispatch({type:'REQUEST_HINT'});
  else if (a==='master') { const before=conceptStatus('concept_sampling_bias'); if(dispatch({type:'MASTER_CONCEPT',answer:button.dataset.answer}) && conceptStatus('concept_sampling_bias')==='mastered'){openModal('dex');dexTab='knowledge';renderModal();if(before!=='mastered')chime('success');} }
  else if (a==='mastery') openModal('mastery');
  else if (a==='dex') openModal('dex');
  else if (a==='dex-tab') {dexTab=button.dataset.tab;renderModal();}
  else if (a==='investigation') openModal('investigation');
  else if (a==='places') openModal('places');
  else if (a==='walk-to') { const target=currentTargets().find(t=>t.id===button.dataset.id);closeModal();if(target)goTo(target); }
  else if (a==='save') {persist(true);renderModal();}
  else if (a==='load') {
    try { const loaded=storage&&loadGame(storage);if(!loaded){toast('No valid browser save was found. Import a backup or keep playing.');return;}state=checkedWorldState(loaded);path=[];updateUI();modal=state.battle?'battle':'save';renderModal();toast('Your saved journey has been restored.'); } catch(error){toast(error.message||'The save could not be loaded.');}
  } else if (a==='export') exportSave();
  else if (a==='import') $('import-file').click();
  else if (a==='reset') openModal('reset');
  else if (a==='save-menu') openModal('save');
  else if (a==='reset-confirm') {state=createGame();path=[];persist();updateUI();openModal('welcome');}
});

$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0]; event.target.value='';if(!file)return;
  try {if(file.size>1024*1024)throw new Error('This file is too large to be a prototype save.');const imported=checkedWorldState(parseGame(await file.text()));state=imported;path=[];persist();updateUI();openModal(state.battle?'battle':'save');toast('Your journey was imported successfully.');}
  catch(error){toast('Could not import: '+(error.message||'Invalid save file.'));}
});

$('world').addEventListener('click',event=>{
  if(modal||state.battle)return;
  const rect=$('world').getBoundingClientRect();const x=Math.floor((event.clientX-rect.left)/rect.width*32),y=Math.floor((event.clientY-rect.top)/rect.height*22);
  const target=currentTargets().find(t=>t.hitbox&&x>=t.hitbox.x&&y>=t.hitbox.y&&x<t.hitbox.x+t.hitbox.width&&y<t.hitbox.y+t.hitbox.height)
    || currentTargets().find(t=>Math.abs(t.x-x)+Math.abs(t.y-y)<=1);
  if(target){goTo(target);return;}
  const route=findPath(x,y);
  if(route){path=route;pathTarget=null;}else toast('Follow the open paths around the buildings and trees.');
  $('world').focus({preventScroll:true});
});

document.addEventListener('keydown',event=>{
  if(modal){
    if(!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!event.ctrlKey&&!event.metaKey&&['p','P','x','X'].includes(event.key)){
      event.preventDefault();openModal(event.key.toLowerCase()==='p'?'save':'dex');return;
    }
    if(event.key==='Escape'){event.preventDefault();closeModal();}
    if(event.key==='Tab'){
      const items=[...$('modal-root').querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')];
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    if(event.key==='Enter'&&event.target.id==='observer-name')$('modal-root').querySelector('[data-action="begin"]')?.click();
    return;
  }
  if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target.closest('button,a')&&['Enter',' '].includes(event.key))return;
  const direction=({ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'})[event.key];
  if(direction){event.preventDefault();path=[];pathTarget=null;if(performance.now()-lastStep>=85){step(direction);lastStep=performance.now();}}
  else if(event.key==='e'||event.key==='E'||event.key===' '){event.preventDefault();interact();}
  else if(event.key==='p'||event.key==='P'){event.preventDefault();openModal('save');}
  else if(event.key==='x'||event.key==='X'){event.preventDefault();openModal('dex');}
});

$('dex-button').addEventListener('click',()=>openModal('dex'));
$('save-button').addEventListener('click',()=>openModal('save'));
$('help-button').addEventListener('click',()=>openModal('help'));
$('brand').addEventListener('click',event=>{event.preventDefault();openModal(state.battle?'battle':'help');});
$('investigation-button').addEventListener('click',()=>openModal(state.battle?'battle':'investigation'));
$('interact-button').addEventListener('click',()=>interact());
$('mobile-interact').addEventListener('click',()=>interact());
$('time-button').addEventListener('click',()=>{
  if(modal||state.battle)return;
  if(state.map==='forest')goTo(currentTargets().find(t=>t.id==='camp'));
  else toast('Rest at the forest campfire to change between day and night.');
});
document.querySelectorAll('[data-walk]').forEach(button=>button.addEventListener('click',()=>{path=[];pathTarget=null;step(button.dataset.walk);}));
$('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').textContent=sound?'♪ Sound on':'♪ Sound off';$('sound-button').setAttribute('aria-pressed',String(sound));chime('success');});

function frame(now){
  if(!document.hidden&&now-lastDraw>(reducedMotion?250:70)){
    if(path.length&&!modal&&now-lastStep>110){const point=path.shift();const dx=point.x-state.player.x,dy=point.y-state.player.y;step(dx>0?'right':dx<0?'left':dy>0?'down':'up');lastStep=now;if(!path.length&&pathTarget){const target=pathTarget;pathTarget=null;interact(target);}}
    renderWorld($('world'),state,{selectedTarget:pathTarget?.id,reduceMotion:reducedMotion});lastDraw=now;
  }
  requestAnimationFrame(frame);
}

updateUI();
if(state.battle)openModal('battle');
else if(!state.starter&&!resumed)openModal('welcome');
else if(resumed)toast('Welcome back, '+state.player.name+'. Your journey has been restored.');
if(unreadableSave)toast('The browser save could not be read. You can import a backup in Save & load.');
if(!savingAvailable)$('save-status').textContent='Automatic saving unavailable · Export a save in Save & load';
requestAnimationFrame(frame);
