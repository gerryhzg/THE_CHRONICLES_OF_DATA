import { SPECIES, HABITATS, ACT1_RECORDS, getAct1TutorialStep, createGame, act, saveGame, loadGame, serializeGame, parseGame, SAVE_KEY } from './engine.js';
import { act1ConversationActions, act1SpecialModal, act1IntroMarkup, act1TutorialMarkup } from './act1-ui.js';
import { readPreferences, setPreference, preferencesMarkup } from './preferences.js';
import { MAPS, isWalkable, restoreMapPosition, renderWorld, drawCreature } from './world.js';
import { getConversation, createDialogue, currentSegment, advanceDialogue, previousDialogue, isDialogueComplete } from './dialogue.js';
import { resolveSpeaker, portraitMarkup } from './portraits.js';
import { createSpeechController } from './speech.js';
import { getQuestGuide, getJourneySteps, getMissingObservations } from './quests.js';
import { getBattleActions } from './battle-actions.js';
import { getExpProgress } from './progression.js';
import { createMusicController } from './music.js';
import { MUSIC_TRACKS } from './music-tracks.js';
import { getMusicScene } from './music-scenes.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state = createGame();
let storage = null;
let resumed = false;
let savingAvailable = true;
let unreadableSave = false;
const checkedWorldState = restoreMapPosition;
try {
  storage = window.localStorage;
  const loaded = loadGame(storage);
  if (loaded) {
    try { state = checkedWorldState(loaded); resumed = true; } catch { unreadableSave = true; }
  } else if (storage.getItem(SAVE_KEY) !== null) unreadableSave = true;
} catch { savingAvailable = false; }
let preferences=readPreferences(storage);
document.body.classList.toggle('large-text',preferences.textSize==='large');
let revealTimer=null, revealSegment=null, revealCount=0;
let revealing=false;
let modal = null;
let modalData = {};
let activeDialogue = null;
const heldDialogueKeys = new Set();
let returnFocus = null;
let path = [];
let pathTarget = null;
let lastStep = 0;
let lastDraw = 0;
let toastTimer;
let battleLogObserver = null;
let battleSelection = null;
let battleCategory = 'skills';
let battleFeedback = '';
const battleCommandButtons = new Set(['battle-move','guard','scan','potion','bond','flee','switch']);
const heldBattleKeys = new Set();
let dexTab = 'creatures';
let sound = false;
let audioContext;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let synthesis = null;
let Utterance = null;
let music = null;
try { synthesis = window.speechSynthesis; Utterance = window.SpeechSynthesisUtterance; } catch {}
const speech = createSpeechController({synthesis, Utterance, storage, onChange:updateSpeechControls});
music = createMusicController({storage,onChange:updateMusicControls});
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

function updateSpeechControls() {
  const {supported, enabled, status} = speech.getState();
  const footer = $('speech-toggle-button');
  footer.disabled = !supported;
  footer.textContent = supported ? (enabled ? 'Voices on' : 'Voices off') : 'Voices unavailable';
  footer.setAttribute('aria-pressed', String(enabled));
  footer.setAttribute('aria-label', supported ? (enabled ? 'Disable spoken dialogue' : 'Enable spoken dialogue') : 'Spoken dialogue unavailable in this browser');
  const toggle = $('modal-root').querySelector('[data-action="speech-toggle"]');
  if (toggle) {
    toggle.disabled = !supported;
    toggle.textContent = enabled ? 'Mute voice' : 'Enable voice';
    toggle.setAttribute('aria-pressed', String(enabled));
  }
  const replay = $('modal-root').querySelector('[data-action="speech-replay"]');
  const skip = $('modal-root').querySelector('[data-action="speech-skip"]');
  if (replay) replay.disabled = !supported || !enabled || !activeDialogue;
  if (skip) {
    skip.disabled = !supported || !enabled;
    skip.setAttribute('aria-disabled', String(!supported || !enabled || status !== 'speaking'));
  }
  const speakerName = activeDialogue ? resolveSpeaker(currentSegment(activeDialogue).speaker, state.player.name).name : '';
  const messages = {
    off:'Off · read at your own pace', idle:'Ready for the next line',
    speaking:'Speaking · '+speakerName, finished:'Line finished · advance when ready',
    skipped:'Voice skipped · advance when ready', unavailable:'Voice playback unavailable in this browser',
    error:'Voice could not play · try Replay',
  };
  if ($('speech-status')) {
    $('speech-status').setAttribute('aria-live', enabled && supported && status !== 'error' ? 'off' : 'polite');
    $('speech-status').textContent = messages[status] || messages.off;
  }
  // Screen readers keep their usual dialogue announcements when game voices are off.
  $('dialogue-announcer').setAttribute('aria-live', enabled && supported ? 'off' : 'polite');
  music?.setNarrating(status==='speaking');
}

function updateMusicControls(next=music?.getState()) {
  if (!next) return;
  const title=MUSIC_TRACKS[next.scene]?.title||'Background music';
  const messages={
    locked:'Music starts when you interact with the game.',
    playing:`${title}${next.ducked?' · softer under dialogue':''}`,
    paused:'Music paused while the game is away.', off:'Music is muted.',
    muted:'Volume is 0%. Raise the slider to hear music.',
    loading:`Loading ${title}…`,
    idle:'Music is ready.', retry:'Music paused. Press Retry music to resume.',
    unavailable:'Music is unavailable in this browser.', destroyed:'Music stopped.',
  };
  document.querySelectorAll('[data-music-action="toggle"]').forEach(button=>{
    button.disabled=!next.supported;
    button.textContent=next.supported?(next.enabled?'Music on':'Music off'):'Music unavailable';
    button.setAttribute('aria-pressed',String(next.enabled));
    button.setAttribute('aria-label',next.enabled?'Mute background music':'Enable background music');
  });
  const percentage=Math.round(next.volume*100);
  document.querySelectorAll('[data-music-action="volume"]').forEach(input=>{
    input.disabled=!next.supported;
    if (Number(input.value)!==percentage) input.value=String(percentage);
    input.setAttribute('aria-valuetext',`${percentage}% music volume`);
  });
  document.querySelectorAll('[data-music-volume-value]').forEach(output=>{output.textContent=`${percentage}%`;});
  document.querySelectorAll('[data-music-status]').forEach(status=>{
    status.textContent=next.status==='playing'&&next.source==='generated'&&next.error?`${title} · backup theme`:messages[next.status]||messages.idle;
    status.dataset.scene=next.scene;
    status.dataset.status=next.status;
    status.dataset.ducked=String(next.ducked);
    status.dataset.effectiveGain=String(next.effectiveGain);
    status.dataset.source=next.source||'';
  });
  document.querySelectorAll('[data-music-action="retry"]').forEach(button=>{button.hidden=next.status!=='retry';});
}

function syncMusic() {
  music.setDialogueActive(!!activeDialogue);
  music.setNarrating(speech.getState().status==='speaking');
  const sceneData=modal==='act1-intro'?{...modalData,introStorm:activeDialogue.index>=1}:modalData;
  music.setScene(getMusicScene(state,{modal,modalData:sceneData,dialogueActive:!!activeDialogue}));
  updateMusicControls();
}

function modalMusicMarkup() {
  return `<div class="modal-music-bar" data-music-control role="group" aria-label="Background music">
    <button data-music-action="toggle" aria-pressed="true">Music on</button>
    <label for="modal-music-volume">Music volume</label><input id="modal-music-volume" data-music-action="volume" type="range" min="0" max="100" step="1" value="30"><output for="modal-music-volume" data-music-volume-value>30%</output>
    <button data-music-action="retry" hidden>Retry music</button><span class="music-status" data-music-status></span>
  </div>`;
}

function speechControlsMarkup() {
  return `<div class="dialogue-speech" role="group" aria-label="Spoken dialogue"><div class="speech-summary"><span>Spoken dialogue</span><small id="speech-status" role="status"></small></div><div class="speech-buttons"><button class="secondary-button small-button" data-action="speech-toggle" aria-pressed="false">Enable voice</button><button class="secondary-button small-button" data-action="speech-replay" aria-label="Replay voice for the displayed dialogue">Replay</button><button class="secondary-button small-button" data-action="speech-skip" aria-label="Skip voice for this line without advancing dialogue">Skip voice</button></div></div>`;
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
    gain.gain.setValueAtTime(activeDialogue ? .012 : .035, audioContext.currentTime);
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
    if (action.type.startsWith('BATTLE_') && state.battle && !state.act1.migrated) {
      const next = getAct1TutorialStep(state);
      if (next) battleCategory=next==='attack'?'skills':next==='switch'?'party':'commands';
    }
    if (action.type==='START_BATTLE') {battleSelection=null;battleCategory='skills';battleFeedback='';}
    else if (action.type.startsWith('BATTLE_')) {battleSelection=null;battleFeedback=result.events?.[0]||'Action complete.';}
    persist();
    updateUI();
    if (!quiet && result.events?.length) toast(result.events[result.events.length - 1]);
    if (before.battle && !state.battle) {
      const won = before.battle.kind === 'rival' && (result.events || []).some(event => event.startsWith('Kai:'));
      const recruited = !before.flags.recruitedVoltkit && state.flags.recruitedVoltkit;
      modal = 'battle-result';
      modalData = {won, recruited, tutorial:before.battle.kind==='rival'&&!before.act1.migrated&&!before.flags.rivalDefeated, events:result.events || [],kind:before.battle.kind,battleEvents:result.battleEvents || [],progression:result.battleProgression};
      activeDialogue = prepareDialogue(modal,modalData);
      chime(won || recruited ? 'success' : 'action');
    }
    if (modal) renderModal();
    syncMusic();
    return true;
  } catch (error) { toast(error.message || 'That action is not available yet.'); return false; }
}

function objectiveContent() {
  return getQuestGuide(state);
}

function objectiveDestination() {
  const guide = objectiveContent();
  if (!guide.targetId) return null;
  const id = state.map === guide.map ? guide.targetId : state.map === 'village' ? 'gate' : 'exit';
  return currentTargets().find(target => target.id === id);
}

function followObjective() {
  if (state.battle) {openModal('battle');return;}
  const target = objectiveDestination();
  closeModal();
  if (target) goTo(target);
}

function portrait(id, size = 120, extra = '') { return `<canvas class="creature-art ${extra}" width="${size}" height="${size}" data-species="${esc(id)}" aria-label="${esc(creatureName(id))}"></canvas>`; }

function paintPortraits(root = document) {
  root.querySelectorAll('canvas[data-species]').forEach(canvas => drawCreature(canvas, canvas.dataset.species, {x:0,y:0,size:Math.min(canvas.width,canvas.height),flip:canvas.classList.contains('player-art')}));
}

function updateUI() {
  const forest = state.map === 'forest';
  $('location-title').textContent = forest ? 'Twin Scholars’ Forest' : 'Harvest Village';
  $('dex-button').disabled = !state.act1.dexReceived;
  $('dex-button').title = state.act1.dexReceived?'Open DataDex':'Recover and compare the rainfall records to activate your DataDex';
  $('region-label').textContent = forest ? 'Route 01 · A question in the trees' : 'Your home in the Vale of Records';
  $('time-button').innerHTML = state.time === 'night' ? '☾ <span>Nighttime</span>' : '☀ <span>Daytime</span>';
  $('time-button').title = forest ? 'Walk to the campfire to change time' : 'Day and night change at the forest campfire';
  $('map-weather').textContent = state.time === 'night' ? 'UNDER THE MOON' : forest ? 'THROUGH THE CANOPY' : 'AFTER THE RAIN';
  $('map-coordinates').textContent = forest ? 'TWIN SCHOLARS · ROUTE 01' : 'VALE OF RECORDS · 01';
  $('world').setAttribute('aria-label', `${forest ? 'Twin Scholars’ Forest' : 'Harvest Village'}, ${state.time}. Use arrow keys or WASD to walk. E to interact. Click a destination.`);
  const objective = objectiveContent();
  $('objective').innerHTML = `<div class="eyebrow">CURRENT OBJECTIVE</div><h3>${esc(objective.title)}</h3><p class="quest-motivation">${esc(objective.why)}</p><p>${esc(objective.text)}</p>${preferences.learning==='explorer'?`<p class="evidence-note">${esc(objective.hint)}</p>`:''}<div class="objective-progress"><i style="width:${objective.progress}%"></i></div><div class="objective-count">${esc(objective.count)}</div>`;
  const steps = getJourneySteps(state);
  const activeStep=Math.max(0,steps.findIndex(s=>s.current));
  const firstVisible=state.act1.migrated?0:Math.max(0,Math.min(activeStep-2,steps.length-6));
  $('journey-list').innerHTML = steps.slice(firstVisible,firstVisible+6).map((s,index) => {
    const i=firstVisible+index;
    return `<li class="${s.done ? 'done' : s.current ? 'current' : ''}"><span class="step-circle">${s.done ? '✓' : i+1}</span>${esc(s.title)}</li>`;
  }).join('');
  $('party-count').textContent = `${state.party.length} / 4`;
  $('party-grid').innerHTML = state.party.map(c => `<div class="party-card" data-uid="${esc(c.uid)}">${portrait(c.speciesId,80)}<div class="party-card-copy"><h3>${esc(creatureName(c.speciesId))}</h3><p>Lv. ${c.level} · ${c.hp}/${c.maxHp} HP</p><div class="mini-hp"><i style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></i></div>${expProgressMarkup(c,true)}</div></div>`).join('') + Array.from({length:Math.max(0,4-state.party.length)}, () => '<div class="party-card empty"><span>+</span><small>A bond to discover</small></div>').join('');
  $('supplies').innerHTML = `<span title="Healing potions"><b>♧</b> ${state.inventory.potions} potions</span><span title="Bond Crystals"><b>◇</b> ${state.inventory.bondCrystals} crystals</span><span title="Aether Coins"><b>◉</b> ${state.coins || 0}</span>`;
  $('investigation-button').innerHTML = `Quest journal <span>↗</span>`;
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
  const legacyPresentation=state.act1.migrated&&['lab','kai','tower','sanctuary','home','gate'].includes(target.id);
  if (state.act1 && state.map==='village' && !legacyPresentation) {
    if (!state.act1.introComplete) {openModal('act1-intro');return;}
    const villageConversations={farm:'act1-farm',river:'act1-river',shop:'act1-shop',tower:'act1-tower',home:'act1-home',sanctuary:'act1-sanctuary'};
    if (villageConversations[target.id]) {openModal(villageConversations[target.id]);return;}
    if (['scarf','child','observer','supply','garden'].includes(target.id)) {openModal('act1-side',{id:target.id});return;}
    if (target.id==='lab' && !state.act1.dexReceived) {openModal('act1-lyra');return;}
    if (target.id==='lab' && !state.starter) {openModal('act1-bond');return;}
    if (target.id==='rowan') {
      if (state.flags.rivalDefeated && state.act1.dexReceived) openModal('act1-council');
      else openModal('act1-gate');
      return;
    }
    if (target.id==='gate' && !state.act1.migrated && !state.act1.councilComplete) {openModal('act1-gate');return;}
    if (target.id==='wild') {
      if (state.flags.rivalDefeated) openModal('wild');
      else openModal('act1-gate');
      return;
    }
  }
  if (target.id === 'lab') { openModal(!state.starter ? 'starters' : quest().status === 'complete' && !state.flags.reportedToLyra ? 'lyra-report' : 'lyra'); }
  else if (target.id === 'kai') {
    if (!state.starter) { openDialogue('Kai','A friendly challenge','', 'kai-before-starter'); }
    else if (state.flags.rivalDefeated) { openModal('rival'); }
    else openModal('rival');
  } else if (target.id === 'sanctuary') openModal('sanctuary');
  else if (target.id === 'gate') {
    if (!state.flags.rivalDefeated) openDialogue('Village gate','Before the forest','', 'gate-locked');
    else travel('forest');
  } else if (target.id === 'exit') travel('village');
  else if (target.id === 'home') openModal('save');
  else if (target.id === 'sign') openModal('places');
  else if (target.id === 'tower') openModal('tower');
  else if (target.id === 'inferra') {
    openModal('inferra');
  } else if (target.id === 'camp') openModal('camp');
  else if (['meadow','riverbank','canopy'].includes(target.id)) openModal('habitat',{habitatId:`habitat_${target.id}`});
  else if (target.id === 'voltkit') openModal('wild');
  chime();
}

function openDialogue(title, subtitle, text, conversationId, options = {}) {
  openModal('dialogue',{title,subtitle,text,conversationId,...options});
}
function openModal(type, data = {}) {
  if (type==='dex' && !state.act1.dexReceived) {toast('The DataDex activates after you recover and compare the three rainfall records.');return;}
  if (!modal) returnFocus=document.activeElement;
  battleSelection=null;
  if (type==='battle') battleFeedback='';
  path=[]; pathTarget=null; modal=type; modalData=data;
  activeDialogue=prepareDialogue(type,data);
  if (activeDialogue && data.resumeDialogue) activeDialogue={...activeDialogue,index:activeDialogue.conversation.segments.length-1};
  renderModal({resetFocus:true}); updatePrompt();
}
function closeModal() {
  if (state.battle) {
    if (modal !== 'battle') { openModal('battle'); return; }
    toast('Finish this encounter, or flee from a wild battle.'); return;
  }
  speech.sync(null);
  clearTimeout(revealTimer);revealSegment=null;revealing=false;
  battleLogObserver?.disconnect();
  battleLogObserver=null;
  modal=null; modalData={}; activeDialogue=null; $('modal-root').innerHTML=''; $('dialogue-announcer').textContent=''; updatePrompt();
  syncMusic();
  if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); else $('world').focus({preventScroll:true});
}

const conversationTypes = new Set(['starters','lyra','lyra-report','report-complete','rival','sanctuary','tower','inferra','camp','wild','complete','battle-result','mastery']);

function prepareDialogue(type, data = {}) {
  const context={
    playerName:state.player.name,starterName:creatureName(state.starter),hasStarter:!!state.starter,act1:state.act1,
    rivalDefeated:state.flags.rivalDefeated,questStatus:quest().status,
    observationCount:observations().length,mastered:conceptStatus('concept_sampling_bias')==='mastered',
    recruited:state.flags.recruitedVoltkit,reportedToLyra:state.flags.reportedToLyra,time:state.time,...data
  };
  if (conversationTypes.has(type) || type.startsWith('act1-') && !['act1-starter-confirm','act1-completion'].includes(type)) {
    const conversation=getConversation(type,context);
    if (type==='mastery' && conceptStatus('concept_sampling_bias')==='mastered') {
      conversation.title='A thoughtful field researcher';
      conversation.segments=[{speaker:'inferra',expression:'happy',text:'You earned that mastery mark. Keep asking who your notes leave out.'}];
    }
    return createDialogue(conversation);
  }
  if (type==='dialogue') {
    if (data.conversationId) return createDialogue(getConversation(data.conversationId,context));
    const lines=data.segments || [data.text];
    return createDialogue({
      id:'field-dialogue',title:data.title,subtitle:data.subtitle,
      segments:lines.map(text=>({speaker:data.speaker || 'narrator',expression:data.expression || 'thoughtful',text})),
      endLabel:'Continue exploring'
    });
  }
  return null;
}

function dialogueMarkup() {
  const segment=currentSegment(activeDialogue);
  const speaker=resolveSpeaker(segment.speaker,state.player.name);
  const expression=speaker.expressions.includes(segment.expression)?segment.expression:'neutral';
  const {index,conversation}=activeDialogue;
  const complete=isDialogueComplete(activeDialogue);
  return `<section class="dialogue-box" data-speaker-id="${esc(speaker.id)}" data-expression="${esc(expression)}" aria-labelledby="dialogue-speaker" style="--speaker-accent:${esc(speaker.accent)}">
    <div class="speaker-portrait">${portraitMarkup(speaker.id,expression,state.player.name)}</div>
    <div class="dialogue-copy"><div class="speaker-heading"><h3 id="dialogue-speaker">${esc(speaker.name)}</h3><span>${esc(speaker.role)}</span></div><p id="dialogue-line">${esc(segment.text)}</p></div>
    <div class="dialogue-controls"><div class="dialogue-position"><span>${index+1} <i>/</i> ${conversation.segments.length}</span><small>${complete?'Choose an option below':'Enter · Space · E to advance'}</small></div><div class="dialogue-buttons"><button class="secondary-button small-button" data-action="dialogue-back" aria-label="Previous dialogue segment" ${index===0?'disabled':''}>← Back</button><button class="primary-button small-button" data-action="dialogue-next" aria-label="Next dialogue segment" ${complete?'disabled':''}>${complete?'All read ✓':'Next →'}</button></div></div>
    ${speechControlsMarkup()}${preferences.dialogueSpeed!=='instant'?'<button class="secondary-button small-button" data-action="dialogue-reveal">Show the whole line</button>':''}
  </section>`;
}

function conversationActions() {
  if (!isDialogueComplete(activeDialogue)) return '';
  const act1Actions=act1ConversationActions(state,modal,modalData,{esc,portrait});
  if (act1Actions!==null) return act1Actions;
  const close='<button class="secondary-button" data-action="close">Continue exploring</button>';
  if (modal==='starters') {
    const descriptions={creature_statifox:'Recognizes patterns. Agile and observant.',creature_algobear:'Plans efficient attacks. Sturdy and precise.',creature_terradeer:'Understands the environment. Balanced and restorative.'};
    const roles={creature_statifox:'Mathematics & statistics',creature_algobear:'Computer science',creature_terradeer:'Domain knowledge'};
    return `<div class="dialogue-followup"><h3>Who will join your journey?</h3><div class="starter-grid">${Object.keys(descriptions).map(id=>`<button class="starter-card" data-action="choose" data-id="${id}">${portrait(id,140)}<h3>${esc(creatureName(id))}</h3><span class="type">${roles[id]}</span><p>${descriptions[id]}</p><div class="starter-stats"><span>Lv. 5</span><span>${esc(SPECIES[id].role)}</span></div><span class="choose">Choose ${esc(creatureName(id))} ↗</span></button>`).join('')}</div></div>`;
  }
  if (modal==='lyra') return `<div class="modal-actions"><button class="primary-button" data-action="dex">Open DataDex</button>${close}</div>`;
  if (modal==='lyra-report') return `<div class="dialogue-followup"><div class="evidence-note">Your report: six habitat/time records, a finding about missing coverage, and the Sampling Compass.</div><div class="modal-actions"><button class="primary-button" data-action="report-findings">Share the field report</button>${close}</div></div>`;
  if (modal==='report-complete') return `<div class="dialogue-followup completion"><div class="completion-mark">✧</div><h3>Your first expedition is complete.</h3><p>Lyra has your findings. Harvest Village will compare weather observations from more places and times. The cause of the Oracle’s failed forecast remains an open question.</p><div class="modal-actions"><button class="primary-button" data-action="journal">Review your journey</button>${close}</div></div>`;
  if (modal==='rival') return `<div class="dialogue-followup"><div class="evidence-note">${!state.act1.migrated&&!state.flags.rivalDefeated?'Lyra lends a training Cloudfin so you can practice switching. Try attack, guard, Scan, and switch, then finish the friendly match. Cloudfin returns after training.':'Potions restore HP. Switching between companions takes a turn.'}</div><div class="modal-actions"><button class="primary-button" data-action="start-battle" data-kind="rival">Challenge Kai ⚔</button>${close}</div></div>`;
  if (modal==='sanctuary') return `<div class="dialogue-followup"><div class="settings-grid"><div class="settings-row"><div><strong>Restore your party</strong><p>Recover all HP and Focus. Always free.</p></div><button class="primary-button small-button" data-action="heal">Heal party</button></div><div class="settings-row"><div><strong>Field supplies</strong><p>Replenish potions and Bond Crystals.</p></div><button class="secondary-button small-button" data-action="restock">Restock</button></div></div><div class="modal-actions">${close}</div></div>`;
  if (modal==='tower') return `<div class="dialogue-followup"><div class="forecast-strip"><div><span>ORACLE PREDICTION</span><strong>0 mm</strong></div><div><span>MEASURED RAINFALL</span><strong class="rain">46 mm</strong></div></div><div class="modal-actions"><button class="primary-button" data-action="dex">Review observations</button>${close}</div></div>`;
  if (modal==='inferra') {
    if (quest().status==='locked') return `<div class="dialogue-followup"><div class="evidence-note">Field assignment: record the meadow, riverbank, and canopy by day and night. Six categories, one investigation.</div><div class="modal-actions"><button class="primary-button" data-action="start-investigation">Take the field assignment →</button>${close}</div></div>`;
    return `<div class="dialogue-followup"><div class="evidence-note">${quest().status==='complete'?'Investigation complete · Sampling Compass earned':`${observations().length} / 6 habitat and time observations recorded`}</div><div class="modal-actions"><button class="primary-button" data-action="investigation">Review investigation</button>${quest().status==='complete'?'<button class="secondary-button" data-action="mastery">Sampling mastery</button><button class="secondary-button" data-action="dex">Review discoveries</button>':''}${close}</div></div>`;
  }
  if (modal==='camp') return `<div class="dialogue-followup"><div class="evidence-note">Current time: ${state.time==='day'?'daylight ☀':'nighttime ☾'}. Your existing observations stay recorded.</div><div class="modal-actions"><button class="primary-button" data-action="change-time">Rest until ${state.time==='day'?'night ☾':'day ☀'}</button>${close}</div></div>`;
  if (modal==='wild') return `<div class="dialogue-followup"><div class="welcome-art">${portrait('creature_voltkit')}</div><div class="evidence-note">Scanning and low HP improve bonding. Patient attempts build trust; a defeated Voltkit can be encountered again.</div><div class="modal-actions">${state.flags.recruitedVoltkit?'<button class="primary-button" data-action="dex">See Voltkit in the DataDex</button>':`<button class="primary-button" data-action="start-battle" data-kind="wild" ${!state.starter?'disabled':''}>Approach Voltkit ◇</button>`}${close}</div></div>`;
  if (modal==='complete') return `<div class="dialogue-followup completion"><div class="completion-mark">✧</div><h3>A fuller picture of the forest.</h3><div class="reward-row"><span>✥ Sampling Compass</span><span>Sampling bias · Understood</span><span>Discovery recorded</span></div><p>Bring your field report back to Lyra in Harvest Village. Your Compass and records are already saved.</p><div class="modal-actions"><button class="primary-button" data-action="journal">Plan the return to Lyra</button><button class="secondary-button" data-action="close">Keep exploring →</button><button class="secondary-button" data-action="mastery">Try the optional challenge</button></div></div>`;
  if (modal==='battle-result') {
    const {won,recruited,events=[]}=modalData;
    const rested=events.some(event=>event.includes('needs rest'));
    const headline=recruited?'Voltkit joined your team!':won?'Well played, Observer.':rested?'Your companions are rested.':'Encounter complete.';
    return `<div class="dialogue-followup completion"><div class="completion-mark">${recruited?'◇':won?'✧':'♧'}</div><h3>${headline}</h3><div class="modal-actions"><button class="primary-button" data-action="close">Continue the adventure →</button>${recruited?'<button class="secondary-button" data-action="dex">See DataDex entry</button>':''}</div></div>`;
  }
  if (modal==='mastery') {
    if (conceptStatus('concept_sampling_bias')==='mastered') return `<div class="modal-actions"><button class="primary-button" data-action="dex">Review discoveries</button>${close}</div>`;
    return `<div class="dialogue-followup"><h3>Which plan better represents the whole forest?</h3><div class="findings"><button class="finding-button" data-action="master" data-answer="representative">Observe several habitats at different times, using a consistent method in each.</button><button class="finding-button" data-action="master" data-answer="night">Collect many more observations from the same canopy at night.</button><button class="finding-button" data-action="master" data-answer="certain">Watch one creature until we are certain about the entire forest.</button></div><p class="save-info">More observations alone do not fix a method that leaves out important groups.</p></div>`;
  }
  if (modalData.returnTo) return `<div class="modal-actions"><button class="primary-button" data-action="dialogue-return">${esc(modalData.returnLabel || 'Back to investigation')}</button></div>`;
  return `<div class="modal-actions"><button class="primary-button" data-action="close">Continue exploring</button></div>`;
}

function conversationModal() {
  const titles={starters:'Choose your first companion',tower:'The rain that wasn’t supposed to fall',camp:state.time==='day'?'Wait for the stars':'Wait for the morning',inferra:quest().status==='locked'?'Is the whole forest nocturnal?':quest().status==='complete'?'A fuller picture of the forest':'The Nocturnal Mystery'};
  const conversation=activeDialogue.conversation;
  const title=modalData.title || titles[modal] || conversation.title;
  const subtitle=modalData.subtitle || conversation.subtitle;
  const battleRecap=modal==='battle-result'&&modalData.battleEvents?.length?battleTimeline(modalData.battleEvents,true):'';
  const progression=modal==='battle-result'&&modalData.progression?battleProgressionMarkup(modalData.progression):'';
  const intro=modal==='act1-intro'?act1IntroMarkup(activeDialogue.index):'';
  const skipIntro=modal==='act1-intro'&&state.act1.introComplete?'<div class="modal-actions"><button class="secondary-button" data-action="close">Skip opening</button></div>':'';
  return modalShell(title,subtitle,intro+progression+dialogueMarkup()+battleRecap+conversationActions()+skipIntro,{wide:['starters','battle-result','act1-bond','act1-tower','act1-intro'].includes(modal)});
}

function moveDialogue(direction) {
  if (!activeDialogue) return;
  if (direction!=='back' && revealing) {finishDialogueReveal();return;}
  activeDialogue=direction==='back'?previousDialogue(activeDialogue):advanceDialogue(activeDialogue);
  renderModal();
  chime();
}

function finishDialogueReveal() {
  clearTimeout(revealTimer);revealing=false;
  if (!activeDialogue) return;
  revealSegment=currentSegment(activeDialogue);revealCount=revealSegment.text.length;
  if ($('dialogue-line')) $('dialogue-line').textContent=revealSegment.text;
  const followup=$('modal-root').querySelector('.dialogue-followup');
  if (followup) followup.hidden=false;
  speech.sync(revealSegment);
}

function syncDialogueReveal() {
  clearTimeout(revealTimer);
  const segment=activeDialogue?currentSegment(activeDialogue):null;
  if (!segment) {revealing=false;revealSegment=null;speech.sync(null);return;}
  if (segment!==revealSegment) {revealSegment=segment;revealCount=0;}
  if (preferences.dialogueSpeed==='instant'||speech.getState().enabled||revealCount>=segment.text.length) {finishDialogueReveal();return;}
  revealing=true;speech.sync(null);
  const followup=$('modal-root').querySelector('.dialogue-followup');
  if (followup) followup.hidden=true;
  const tick=()=>{
    if (!activeDialogue||currentSegment(activeDialogue)!==segment||!$('dialogue-line')) return;
    revealCount=Math.min(segment.text.length,revealCount+2);
    $('dialogue-line').textContent=segment.text.slice(0,revealCount);
    if (revealCount>=segment.text.length) finishDialogueReveal();
    else revealTimer=setTimeout(tick,preferences.dialogueSpeed==='slow'?65:30);
  };
  tick();
}

function modalShell(title, subtitle, body, {wide=false,battle=false}={}) {
  return `<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div class="modal-top"><div><p class="eyebrow">${esc(subtitle)}</p><h2 id="modal-heading">${esc(title)}</h2></div>${battle?'<div class="battle-menu"><button data-action="dex" aria-label="Open DataDex">▧ DataDex</button><button data-action="save-menu" aria-label="Open save and load">↓ Save & load</button></div>': '<button class="close-modal" data-action="close" aria-label="Close dialog">×</button>'}</div>${modalMusicMarkup()}${battle ? body : `<div class="modal-content">${body}</div>`}</section></div>`;
}

function renderModal({resetFocus=false} = {}) {
  if (!modal) return;
  const openingRewards=modal==='battle-result'&&!!$('modal-root').querySelector('.battle-action-menu');
  const previousControl=document.activeElement?.closest('#modal-root button[data-action]');
  const previousAction=resetFocus?undefined:previousControl?.dataset.action;
  const previousId=previousControl?.dataset.id;
  const previousIndex=previousControl?.dataset.index;
  const previousLog=$('modal-root').querySelector('.battle-log');
  const logFocused=!resetFocus&&document.activeElement===previousLog;
  const logPosition=!resetFocus&&previousLog&&previousLog.scrollHeight-previousLog.scrollTop-previousLog.clientHeight>8?previousLog.scrollTop:null;
  let html='';
  const act1Special=act1SpecialModal(state,modal,modalData,{esc,portrait,shell:modalShell});
  if (act1Special) html=act1Special;
  else if (modal === 'welcome') {
    html=modalShell('Every adventure begins with a question.','ACT I · THE BROKEN FORECAST',`<div class="welcome-art"><span class="diamond">✧</span>${portrait('creature_statifox')}${portrait('creature_algobear')}${portrait('creature_terradeer')}</div><p>Harvest Village trusts the Oracle’s promise of dry skies. Your first adventure begins on the morning that promise breaks.</p><label class="name-label" for="observer-name">What should we call you?</label><input id="observer-name" class="text-input" autocomplete="nickname" maxlength="24" value="Observer" placeholder="Your name"><div class="modal-actions"><button class="primary-button" data-action="begin">Begin your journey <span>→</span></button><button class="secondary-button" data-action="close">Explore the village</button></div><p class="save-info">Recover scattered records, choose a Databeast, train with Kai, and help the council decide what comes next. Your progress saves after every action.</p>`);
  } else if (activeDialogue) {
    html=conversationModal();
  } else if (modal === 'habitat') {
    const id=modalData.habitatId; const h=habitats().find(h=>h.id===id); const data=h?.observations?.[state.time] || h?.[state.time] || [];
    const recorded=hasObserved(id,state.time); const active=['active','ready','complete'].includes(quest().status);
    html=modalShell(h?.title || 'Forest habitat',`${state.time === 'day'?'☀ DAYLIGHT':'☾ MOONLIGHT'} · FIELD OBSERVATION`, `<p>${esc(h?.description || 'You take a quiet moment to watch the creatures in this habitat. These sightings belong to this place and this time.')}</p><div class="sighting-list">${data.map(o=>`<div class="sighting">${portrait(o.speciesId,100)}<h3>${esc(creatureName(o.speciesId))}</h3><small>${o.count} sightings</small></div>`).join('')}</div><div class="evidence-note">${recorded?'✓ This habitat and time are already in your field notes.':active?'Record this snapshot to compare it with other habitats and times.':'Meet Professor Inferra at the field station to begin the investigation.'} A sighting count describes what you saw; it does not count every creature living in the forest.</div><div class="modal-actions"><button class="primary-button" data-action="observe" data-id="${esc(id)}" ${recorded||!active?'disabled':''}>${recorded?'Observation recorded ✓':'Record in DataDex'}</button><button class="secondary-button" data-action="close">Continue exploring</button></div>`);
  } else if (modal === 'journal') html=questJournalModal();
  else if (modal === 'investigation') html=investigationModal();
  else if (modal === 'battle') html=battleModal();
  else if (modal === 'dex') html=dexModal();
  else if (modal === 'save') html=saveModal();
  else if (modal === 'reset') {
    html=modalShell('Begin a new journey?','SAVE & LOAD',`<p>This replaces the progress saved in this browser. You can export your current journey first to keep it.</p><div class="modal-actions"><button class="secondary-button" data-action="export">Export current save</button><button class="danger-button" data-action="reset-confirm">Start a new journey</button><button class="secondary-button" data-action="save-menu">Keep playing</button></div>`);
  } else if (modal === 'places') {
    html=modalShell('Follow the village paths',state.map==='forest'?'TWIN SCHOLARS’ FOREST · PLACES TO VISIT':'HARVEST VILLAGE · PLACES TO VISIT',`<p>Click a place below to walk there. You can also click directly on the map or use WASD and the arrow keys.</p><div class="destination-list">${currentTargets().filter(t=>t.id!=='sign').map(t=>`<button data-action="walk-to" data-id="${esc(t.id)}">${esc(t.name)} <span style="float:right">↗</span></button>`).join('')}</div>`);
  } else if (modal === 'help') {
    html=helpModal();
  }
  battleLogObserver?.disconnect();
  battleLogObserver=null;
  $('modal-root').innerHTML=html;
  syncMusic();
  syncDialogueReveal();
  updateSpeechControls();
  paintPortraits($('modal-root'));
  if ($('intro-world')) renderWorld($('intro-world'),{...state,map:'village',act1Scene:activeDialogue.index===0?'calm':activeDialogue.index<3?'storm':'aftermath'},{reduceMotion:reducedMotion});
  const root=$('modal-root');
  let focusable;
  if (activeDialogue) {
    focusable=[...root.querySelectorAll('button[data-action]:not(:disabled)')].find(button=>button.dataset.action===previousAction&&(!previousId||button.dataset.id===previousId));
    focusable ||= isDialogueComplete(activeDialogue) ? root.querySelector('.dialogue-followup button:not(:disabled), .modal-actions button:not(:disabled)') : root.querySelector('[data-action="dialogue-next"]');
    const segment=currentSegment(activeDialogue);
    const announcement=resolveSpeaker(segment.speaker,state.player.name).name+': '+segment.text;
    if ($('dialogue-announcer').textContent!==announcement) $('dialogue-announcer').textContent=announcement;
  } else {
    if (!resetFocus) focusable=logFocused?root.querySelector('.battle-log'):[...root.querySelectorAll('button[data-action]:not(:disabled)')].find(button=>button.dataset.action===previousAction&&(!previousId||button.dataset.id===previousId)&&(!previousIndex||button.dataset.index===previousIndex));
    if (modal==='battle'&&previousAction==='battle-confirm') focusable ||= root.querySelector('[data-battle-group]:not([hidden]) .battle-action-card:not(:disabled)');
    focusable ||= root.querySelector('input, button:not(:disabled), [tabindex="0"]');
    $('dialogue-announcer').textContent='';
  }
  if (openingRewards) focusable=root.querySelector('.battle-progression')||focusable;
  focusable?.focus({preventScroll:true});
  const log=root.querySelector('.battle-log');
  if (log) {
    log.scrollTop=logPosition??log.scrollHeight;
    let followLatest=logPosition===null;
    let width=log.clientWidth, height=log.clientHeight;
    log.addEventListener('scroll',()=>{
      // A resize may move the scroll position before its observer runs.
      if (width===log.clientWidth&&height===log.clientHeight) followLatest=log.scrollHeight-log.scrollTop-log.clientHeight<8;
    },{passive:true});
    if (typeof ResizeObserver!=='undefined') {
      battleLogObserver=new ResizeObserver(()=>{
        width=log.clientWidth; height=log.clientHeight;
        if (followLatest) log.scrollTop=log.scrollHeight;
      });
      battleLogObserver.observe(log);
    }
  }
}

function questJournalModal() {
  const guide = objectiveContent();
  const target = objectiveDestination();
  const missing = getMissingObservations(state);
  const stages = getJourneySteps(state);
  const side=state.act1.side;
  return modalShell('Your quest journal','THE FIRST EXPEDITION',`<div class="quest-brief"><p class="eyebrow">${esc(guide.count)}</p><h3>${esc(guide.title)}</h3><p>${esc(guide.why)}</p><h4>What to do</h4><p>${esc(guide.text)}</p><h4>Complete when</h4><p>${esc(guide.completeWhen)}</p><div class="evidence-note"><strong>If you’re stuck</strong><br>${esc(guide.hint)}</div></div><ol class="quest-route">${stages.map(step=>`<li class="${step.done?'done':step.current?'current':''}" ${step.current?'aria-current="step"':''}>${step.done?'✓ ':''}${esc(step.title)}</li>`).join('')}</ol>${quest().status==='active'?`<h3>Still to record</h3><ul class="quest-missing">${missing.map(row=>`<li>${esc(row.label)}</li>`).join('')}</ul>`:''}<div class="modal-actions">${target?`<button class="primary-button" data-action="next-objective">Walk to ${esc(target.name)}</button>`:''}${quest().status!=='locked'?'<button class="secondary-button" data-action="investigation">Review field evidence</button>':''}<button class="secondary-button" data-action="close">Back to the field</button></div><div class="quest-optional"><h3>Optional village discoveries</h3><p>These do not block the main story.</p><p>${side.scarfReturned?'✓ Lost scarf returned':side.scarfFound?'◇ Return the scarf to the child in the residential lane.':'◇ Look near the old bridge for a lost scarf.'}</p><p>${side.oldJournal?'✓ Observer journal read · Archive Fragment preserved':'◇ Read the old Observer journal west of the square.'}</p><p>${side.supplyChest?'✓ Hidden supply chest opened':'◇ Find a supply chest behind Nell’s shop.'}</p><p>${side.gardenCleared?'✓ Flooded garden drained':'◇ Clear debris from the flooded garden.'}</p><p>${state.flags.recruitedVoltkit?'✓ Voltkit bonded':'◇ Befriend Voltkit in the village grass after Kai’s battle. Scan, weaken, then offer a Bond Crystal.'}</p><p>${conceptStatus('concept_sampling_bias')==='mastered'?'✓ Sampling mastery recorded':'✧ Plan a stronger sample with Inferra after the forest investigation.'}</p></div>`);
}

function helpModal() {
  return modalShell('Your first field guide','ACT I · THE BROKEN FORECAST',`<p>Recover three original weather records, compare them at the tower, and activate your DataDex. Meet all three starters at Lyra’s lab, confirm one partner, practice with Kai, then join Rowan’s council to open the northern road.</p><table class="control-table"><tr><td>Walk</td><td>${preferences.movement==='ijkl'?'IJKL':'WASD'} / arrow keys / click map</td></tr><tr><td>Talk or advance dialogue</td><td>E / Space / Enter in dialogue</td></tr><tr><td>Quest journal</td><td>Q / J (WASD preset)</td></tr><tr><td>DataDex / Save & load</td><td>X / P</td></tr><tr><td>Close a dialog</td><td>Escape</td></tr></table><p>All three starters can complete the story. Elin’s Sanctuary offers free healing and supplies. After the council, the forest investigation remains available and the village stays open.</p><h3>Comfort & controls</h3>${preferencesMarkup(preferences,state.act1.combatDifficulty)}<p>Dialogue waits for you. With a gradual reveal, press Next once to reveal the current line, then again to advance. Enabling voice reveals the entire line before it is spoken. Your device’s reduced-motion setting disables camera panning and weather animation.</p><div class="modal-actions"><button class="primary-button" data-action="close">Back to the adventure</button><button class="secondary-button" data-action="places">Places to visit</button>${state.act1.introComplete?'<button class="secondary-button" data-action="act1-replay-intro">Replay the opening</button>':''}</div>`);
}

function investigationModal() {
  const q=quest();
  if (q.status === 'locked') return modalShell('A mystery awaits','FIELD JOURNAL',`<p>Finish Kai’s battle in Harvest Village, then follow the eastern road into the forest. Professor Inferra will explain her field investigation.</p><div class="modal-actions"><button class="primary-button" data-action="close">Back to exploring</button></div>`);
  const count=observations().length;
  const complete=q.status==='complete';
  const totals={day:0,night:0};
  observations().forEach(o=>{const h=habitats().find(h=>h.id===o.habitatId); const data=o.sightings||o.observations||h?.observations?.[o.time]||h?.[o.time]||[]; totals[o.time]+=(Array.isArray(data)?data.reduce((n,s)=>n+s.count,0):0);});
  const max=Math.max(totals.day,totals.night,1);
  return modalShell('The Nocturnal Mystery',`C1-03 · ${complete?'INVESTIGATION COMPLETE':`${count} / 6 FIELD OBSERVATIONS`}`,`<p>The ranger claims nearly every forest Databeast is nocturnal. His original sample came only from the canopy at night. Test whether those records represent the entire forest.</p><div class="sampling-grid"><div class="sample-heading">HABITAT</div><div class="sample-heading">☀ DAYLIGHT</div><div class="sample-heading">☾ MOONLIGHT</div>${habitats().map(h=>`<div class="sample-title">${esc(h.title)}</div>${['day','night'].map(t=>`<div class="${hasObserved(h.id,t)?'recorded':''}">${hasObserved(h.id,t)?'✓ Recorded':state.flags.compass?'✥ Unobserved':'○ Not observed'}</div>`).join('')}`).join('')}</div><h3>What your sample shows</h3><div class="chart-legend"><span><i></i>Day sightings</span><span><i class="night"></i>Night sightings</span></div><div class="research-chart">${['day','night'].map(t=>`<div class="chart-row ${t}"><span>${t==='day'?'Daylight':'Moonlight'}</span><div class="bar"><i style="width:${totals[t]/max*100}%"></i></div><span>${totals[t]}</span></div>`).join('')}</div><div class="evidence-note">These are recorded sightings, not a census of unique creatures or an estimate of an individual creature’s probability of activity. Compare habitat and time coverage before drawing a conclusion.</div>${complete?'<p><strong>Conclusion:</strong> The initial sample was biased. Activity varies across habitats and times; the ranger’s records cannot justify a claim about the entire forest.</p><div class="modal-actions"><button class="primary-button" data-action="mastery">Optional mastery challenge</button><button class="secondary-button" data-action="dex">View learning entry</button></div>':`<h3>What can we conclude?</h3><div class="findings"><button class="finding-button" data-action="finding" data-answer="nocturnal" ${count<6?'disabled':''}>Nearly every forest Databeast must be nocturnal.</button><button class="finding-button" data-action="finding" data-answer="biased" ${count<6?'disabled':''}>The ranger’s sample leaves out habitats and times. We need broader evidence.</button><button class="finding-button" data-action="finding" data-answer="certain" ${count<6?'disabled':''}>Our new sample proves exactly how every creature will behave.</button></div>${count<6?'<p class="save-info">Visit all three habitats in both daylight and moonlight before submitting your finding.</p>':''}<div class="modal-actions"><button class="secondary-button" data-action="hint">${q.hints>=3?'Review guided explanation':'A nudge from Inferra'}</button><button class="secondary-button" data-action="close">Back to the field</button></div>`}`,{wide:true});
}

function expProgressMarkup(member,compact=false) {
  const progress=getExpProgress(member);
  const name=creatureName(member.speciesId);
  if (progress.isMaxLevel) return `<div class="exp-summary ${compact?'compact':''}" data-max-level="true"><span class="exp-progress-text">Maximum level · Lv. ${progress.level}</span>${compact?'':`<span class="exp-next-level">${progress.xp} EXP stored · no next level</span>`}</div>`;
  const nextLevel=progress.level+1;
  return `<div class="exp-summary ${compact?'compact':''}">
    <div class="exp-progress" role="progressbar" aria-label="${esc(name)} EXP toward level ${nextLevel}" aria-valuemin="0" aria-valuemax="${progress.required}" aria-valuenow="${Math.min(progress.xp,progress.required)}" aria-valuetext="${progress.xp} of ${progress.required} EXP; ${progress.remaining} EXP to level ${nextLevel}"><i style="width:${progress.percent}%"></i></div>
    <div class="exp-progress-text"><span>${progress.xp} / ${progress.required} EXP</span><span class="exp-next-level">${progress.remaining} EXP to Lv. ${nextLevel}</span></div>
    ${!compact&&progress.xp>=progress.required?'<span class="exp-ready-note">Stored EXP will be applied after your next victory.</span>':''}
  </div>`;
}

function levelUpMarkup(levelUp,recipient) {
  const before=levelUp.before, after=levelUp.after;
  const stats=[['Max HP',before.maxHp,after.maxHp],['Attack strength',before.attack,after.attack]].filter(([,from,to])=>from!==to);
  const unlocked=(levelUp.unlockedSkills||[]).map(skill=>{
    const id=typeof skill==='string'?skill:skill.id;
    const move=SPECIES[recipient.speciesId].moves.find(move=>move.id===id);
    return move?.name||(typeof skill==='string'?skill:skill.name||id);
  });
  return `<section class="level-up-notice" data-level="${levelUp.level}" aria-label="${esc(recipient.name)} reached level ${levelUp.level}">
    <div class="level-up-heading"><span aria-hidden="true">✦</span><div><p>Level up!</p><h4>${esc(recipient.name)} reached Lv. ${levelUp.level}</h4></div></div>
    <dl class="level-up-stats">${stats.map(([label,from,to])=>`<div class="level-up-stat"><dt>${label}</dt><dd>${from} <span aria-hidden="true">→</span><span class="sr-only"> to </span> ${to} <strong>(+${to-from})</strong></dd></div>`).join('')}</dl>
    ${unlocked.length?`<div class="level-up-skills"><h5>New skills</h5><p>${unlocked.map(esc).join(' · ')}</p></div>`:''}
  </section>`;
}

function battleProgressionMarkup(progression) {
  const {recipient,before,after,levelUps=[],xpGained,outcome}=progression;
  const won=outcome==='victory'||outcome==='bond';
  const title=outcome==='bond'?'A bond worth growing':won?(levelUps.length?'Your partner grows stronger':'Experience earned'):'Experience this encounter';
  return `<section class="battle-progression" data-outcome="${esc(outcome)}" tabindex="-1" aria-labelledby="battle-progression-title">
    <div class="battle-reward-heading"><div><p class="battle-reward-eyebrow">Encounter rewards</p><h3 id="battle-progression-title">${title}</h3></div><strong class="battle-exp-earned" data-exp="${xpGained}">${xpGained?'+':''}${xpGained} EXP</strong></div>
    ${recipient?`<div class="battle-exp-recipient"><div class="battle-reward-portrait">${portrait(recipient.speciesId,90)}</div><div class="battle-exp-copy"><p class="battle-progression-name">${esc(recipient.name)}</p><p class="battle-progression-level">${before.level!==after.level?`Lv. ${before.level} → Lv. ${after.level}`:`Lv. ${after.level}`}</p>${expProgressMarkup(after)}</div></div><p class="battle-exp-context">${modalData.tutorial?'Awarded to your first partner. The training Cloudfin has returned to Lyra.':'Awarded to your active Databeast.'}</p>`:`<p class="battle-no-exp">${outcome==='escape'?'Leaving an encounter awards no EXP.':'A defeat awards no EXP. Your team is rested for another try.'}</p>`}
    ${levelUps.length?`<div class="battle-level-ups" role="status" aria-live="polite">${levelUps.map(level=>levelUpMarkup(level,recipient)).join('')}</div>`:''}
  </section>`;
}

function battleParticipant(participant) {
  if (!participant) return '';
  if (!participant.speciesId) return `You · ${participant.name}`;
  return `${participant.side==='enemy'?'Enemy':'Your'} ${participant.name}`;
}

function battleEventMarkup(entry) {
  if (typeof entry==='string') return `<article class="battle-event" data-side="system" data-type="legacy"><div class="battle-event-heading"><span class="battle-event-side">Earlier event</span></div><p class="battle-event-effect">${esc(entry)}</p></article>`;
  const side=entry.side;
  const actor=battleParticipant(entry.actor), target=battleParticipant(entry.target);
  const labels={player:'Your side',enemy:'Enemy',system:'Battle'};
  let badge='', effect=entry.text;
  if (entry.type==='damage') {
    badge=`−${entry.amount} HP`;
    effect=`${target} took ${entry.amount} damage.${entry.guarded?' Guard reduced the damage.':''}`;
  } else if (entry.type==='heal') {
    badge=`+${entry.amount} HP`;
    effect=`${target} recovered ${entry.amount} HP.`;
  } else if (typeof entry.focus==='number') {
    badge=`+${entry.focus} Focus`;
    effect=`${target} recovered ${entry.focus} Focus.${entry.guarded?' Guarding against the next attack.':''}`;
  } else if (entry.type==='scan') {
    badge='Free action';
    effect=`${target} scanned. No turn consumed. Observations are recorded in the DataDex.`;
  }
  return `<article class="battle-event" data-side="${esc(side)}" data-type="${esc(entry.type)}">
    <div class="battle-event-heading"><span class="battle-event-side">${labels[side]||'Battle'}</span><strong class="battle-event-action">${esc(entry.action)}</strong></div>
    ${actor||target?`<div class="battle-event-route">${actor?`<span class="battle-event-actor">${esc(actor)}</span>`:''}${actor&&target?'<span class="battle-event-arrow" aria-hidden="true">→</span><span class="sr-only"> to </span>':''}${target?`<span class="battle-event-target">${esc(target)}</span>`:''}</div>`:''}
    <p class="battle-event-effect">${badge?`<strong class="battle-event-value">${esc(badge)}</strong>`:''}<span>${esc(effect)}</span></p>
  </article>`;
}

function battleTimeline(entries,complete=false) {
  const groups=[];
  // Keep engine order, including free actions and automatic replacements within a turn.
  for (const entry of entries) {
    const turn=typeof entry==='string'?0:entry.turn;
    if (groups.at(-1)?.turn!==turn) groups.push({turn,entries:[]});
    groups.at(-1).entries.push(entry);
  }
  return `<section class="battle-timeline" aria-labelledby="battle-log-title">
    <div class="battle-timeline-heading"><h3 id="battle-log-title">${complete?'Battle recap':'Battle log'}</h3><span>In order · newest at the bottom</span></div>
    <div class="battle-log" role="log" aria-label="Battle events, oldest first" aria-live="polite" aria-relevant="additions" tabindex="0">${groups.map(group=>`<div class="battle-turn" data-turn="${group.turn}"><h4>${group.turn?`Turn ${group.turn}`:'Battle so far'}</h4>${group.entries.map(battleEventMarkup).join('')}</div>`).join('')}</div>
  </section>`;
}

function battleCombatant(member,side) {
  const enemy=side==='enemy';
  return `<section class="battle-combatant" data-side="${side}" aria-label="${enemy?'Enemy':'Your'} ${esc(creatureName(member.speciesId))}">
    <div class="battle-stat"><p class="battle-side-label">${enemy?'Enemy':'Your Databeast'}</p><h3>${esc(creatureName(member.speciesId))}<small>Lv. ${member.level}</small></h3><div class="hp-bar"><i style="width:${Math.max(0,member.hp/member.maxHp*100)}%"></i></div><p><span>${member.hp} / ${member.maxHp} HP</span><span>Focus ${member.focus}</span></p>${enemy?'':expProgressMarkup(member,true)}</div>
    <div class="battle-creature"><div class="ground"></div>${portrait(member.speciesId,enemy?150:180,enemy?'enemy':'player-art')}</div>
  </section>`;
}

function battleActionCard(command) {
  const selected=command.key===battleSelection;
  const actionName=command.action.type==='BATTLE_MOVE'?'battle-move':command.action.type.slice(7).toLowerCase();
  return `<button class="battle-action-card" data-action="${actionName}" data-key="${esc(command.key)}" ${command.action.moveId?`data-id="${esc(command.action.moveId)}"`:''} ${command.action.index!==undefined?`data-index="${command.action.index}"`:''} data-selected="${selected}" aria-pressed="${selected}" aria-controls="battle-action-preview" ${command.available?'':'disabled'}>
    <span class="battle-action-card-top"><span class="battle-action-category">${esc(command.category)}</span><span class="battle-action-availability">${selected?'✓ Selected':command.available?'Ready':'Unavailable'}</span></span>
    <strong class="battle-action-label">${esc(command.label)}</strong>
    <span class="battle-action-description">${esc(command.description)}</span>
    <span class="battle-action-effect">${esc(command.effect)}</span>
    <span class="battle-action-cost">${esc(command.cost)}</span>
    <span class="battle-action-turn">${esc(command.turn)}</span>
    ${command.limitation?`<span class="battle-action-limitation">${esc(command.limitation)}</span>`:''}
    ${command.unavailableReason?`<span class="battle-action-reason">${esc(command.unavailableReason)}</span>`:''}
  </button>`;
}

function battleActionPreview(command) {
  if (!command) return `<span class="battle-preview-step">2 · Review & use</span><h4>Choose an action</h4><p>Select a card to review its effect. The action runs only when you press Use.</p><button class="primary-button" data-action="battle-confirm" disabled>Choose an action first</button>`;
  const confirmLabel=command.key==='flee'?'Leave encounter':command.group==='party'?command.label:`Use ${command.label}`;
  return `<span class="battle-preview-step">2 · Review & use</span><h4>${esc(command.label)}</h4><p>${esc(command.description)}</p>
    <dl><div><dt>Effect</dt><dd>${esc(command.effect)}</dd></div><div><dt>Cost</dt><dd>${esc(command.cost)}</dd></div><div><dt>Timing</dt><dd>${esc(command.turn)}</dd></div>${command.limitation?`<div><dt>Keep in mind</dt><dd>${esc(command.limitation)}</dd></div>`:''}</dl>
    ${command.unavailableReason?`<p class="battle-action-reason">${esc(command.unavailableReason)}</p>`:''}
    <div class="battle-confirm-controls"><button class="primary-button" data-action="battle-confirm" ${command.available?'':'disabled'}>${esc(confirmLabel)}</button><button class="secondary-button" data-action="battle-clear">Cancel selection</button></div>`;
}

function updateBattleSelection() {
  const command=getBattleActions(state).find(action=>action.key===battleSelection);
  const root=$('modal-root');
  root.querySelectorAll('.battle-action-card').forEach(card=>{
    const selected=card.dataset.key===battleSelection;
    card.dataset.selected=String(selected);
    card.setAttribute('aria-pressed',String(selected));
    card.querySelector('.battle-action-availability').textContent=selected?'✓ Selected':card.disabled?'Unavailable':'Ready';
  });
  const preview=root.querySelector('.battle-action-preview');
  if (preview) preview.innerHTML=battleActionPreview(command);
}

function selectBattleAction(button, pointer=false) {
  const command=getBattleActions(state).find(action=>action.key===button.dataset.key);
  if (!command?.available) return;
  battleSelection=command.key;
  updateBattleSelection();
  if (pointer&&window.matchMedia('(max-width:760px)').matches) $('modal-root').querySelector('.battle-action-preview')?.scrollIntoView({block:'nearest',behavior:'instant'});
}

function confirmBattleAction() {
  // Rebuild from current battle state before spending resources or resolving a turn.
  const command=getBattleActions(state).find(action=>action.key===battleSelection);
  if (!command?.available) {battleSelection=null;updateBattleSelection();return;}
  dispatch(command.action,{quiet:true});
}

function battleActionMenu(player) {
  const commands=getBattleActions(state);
  const categories=[['skills','Skills'],['commands','Tactics & supplies'],['party','Switch partner']];
  const selected=commands.find(command=>command.key===battleSelection);
  return `<section class="battle-action-menu" aria-labelledby="battle-actions-title">
    <div class="battle-action-intro"><div><p class="battle-preview-step">1 · Choose a command</p><h3 id="battle-actions-title">What will ${esc(creatureName(player.speciesId))} do?</h3><p>The enemy waits while you choose. Review a card, then press Use.</p></div><span class="battle-focus">${player.focus} / 8 Focus</span></div>
    <p class="battle-action-feedback" role="status" ${battleFeedback?'':'hidden'}>${esc(battleFeedback)}</p>
    <div class="battle-action-categories" role="group" aria-label="Battle command categories">${categories.map(([key,label])=>`<button data-action="battle-category" data-id="${key}" aria-pressed="${battleCategory===key}" aria-controls="battle-group-${key}">${label}<span>${commands.filter(command=>command.group===key&&command.available).length} ready</span></button>`).join('')}</div>
    ${categories.map(([key,label])=>`<section id="battle-group-${key}" data-battle-group="${key}" aria-label="${label}" ${battleCategory===key?'':'hidden'}><div class="battle-action-grid">${commands.filter(command=>command.group===key).map(battleActionCard).join('')}</div></section>`).join('')}
  </section><aside class="battle-decision"><div class="battle-action-preview" id="battle-action-preview" aria-live="polite" aria-atomic="true">${battleActionPreview(selected)}</div></aside>`;
}

function battleModal() {
  const b=state.battle;
  if (!b) { modal='battle-result'; return modalShell('Encounter complete','FIELD JOURNAL','<p>The encounter has ended. Continue your adventure.</p><button class="primary-button" data-action="close">Continue</button>'); }
  const player=state.party[b.activeIndex]; const enemy=b.enemy;
  const history=b.enemyHistory || [];
  const moveCounts={}; history.forEach(m=>{ const name=typeof m==='string'?m:m.moveName||m.name||m.moveId||'an action'; moveCounts[name]=(moveCounts[name]||0)+1; });
  const summary=Object.entries(moveCounts).map(([name,count])=>`${name}: ${count}/${history.length} observed turns`).join(' · ');
  return modalShell(b.kind==='rival'?'Kai’s friendly challenge':'Wild Voltkit encounter',`TURN ${b.turn} · ${b.kind==='rival'?'LEARN TOGETHER':'A CHANCE TO BOND'}`,`
    ${act1TutorialMarkup(state)}<div class="battle-stage">${battleCombatant(player,'player')}${battleCombatant(enemy,'enemy')}</div>
    ${battleTimeline(b.log||[])}
    <div class="battle-body">${battleActionMenu(player)}<details class="battle-help"><summary>Observation & bonding tips</summary><p class="battle-note">${b.scanned?`DataDex scan: ${summary?esc(summary)+'. ':''}Observed frequencies describe these turns. They do not guarantee the next move.`:'Your first scan is free. Observe behavior before choosing a strategy.'}${b.kind==='wild'?'<br>Bonding improves after a scan and at low HP. Avoid defeating it before using a crystal.':''}</p></details></div>`,{wide:true,battle:true});
}

function dexModal() {
  const entries=speciesEntries();
  const tabs=`<div class="tabs"><button class="${dexTab==='creatures'?'active':''}" data-action="dex-tab" data-tab="creatures">Databeasts · ${Object.values(state.dex.species).filter(v=>v.seen).length}</button><button class="${dexTab==='knowledge'?'active':''}" data-action="dex-tab" data-tab="knowledge">Discoveries</button><button class="${dexTab==='research'?'active':''}" data-action="dex-tab" data-tab="research">Field notes · ${observations().length}</button></div>`;
  let body;
  if (dexTab==='creatures') body=`<div class="dex-grid">${entries.map(([id,s])=>{const d=dexEntry(id);return `<div class="dex-card ${!d.seen?'locked':''}">${d.seen?portrait(id):'<div style="height:100px;display:grid;place-items:center;font:48px Georgia;color:#718b60">?</div>'}<h3>${d.seen?esc(s.name):'Undiscovered'}</h3><span class="pill">${d.recruited?'Bonded companion':d.seen?'Observed':'Not yet seen'}</span><p>${d.seen?esc(s.description||s.role||'A creature of Aetheria.'):'Explore habitats at different times to discover this creature.'}</p>${d.seen?`<p>${d.scans||0} scans recorded</p>`:''}</div>`;}).join('')}</div>`;
  else if (dexTab==='knowledge') {
    const concepts=[{id:'concept_historical_observation',name:'Why do we keep records?',text:'Observations help us learn from past events. Records let people compare evidence, prepare for storms, and make better decisions. The original rainfall records disagree with the Archive copies. We still need to find out why.'},{id:'concept_observation',name:'Learning from observations',text:'Records of rainfall, sightings, and battle actions help us evaluate claims. Evidence gives us a reason to update what we believe.'},{id:'concept_sampling_bias',name:'Sampling bias',text:'A population is the whole group we want to learn about. A sample is the part we observe. If our method systematically leaves out habitats or times, its conclusions may not represent the forest.'}];
    body=concepts.map(c=>{const status=conceptStatus(c.id), stages=['unknown','encountered','understood','mastered'],index=stages.indexOf(status);return `<div class="concept-card"><h3>${c.name}<span class="pill">${esc(status)}</span></h3><p>${status==='unknown'?'An undiscovered idea. Keep observing and investigating.':c.text}</p><div class="knowledge-stages">${stages.map((s,i)=>`<span class="${i<=index?'reached':''}">${s}</span>`).join('')}</div></div>`;}).join('')+`<div class="evidence-note">A broader sample is an improvement, not a promise of certainty. A large sample can still be biased if collected using a narrow method.</div>${quest().status==='complete'?'<button class="secondary-button" data-action="mastery">Try the sampling mastery challenge</button>':''}`;
  } else body=`<p>${observations().length?'Your observations persist across visits, day and night, and saved games.':'Your field notebook is waiting. Meet Professor Inferra in the forest to begin.'}</p>${observations().map(o=>`<div class="settings-row"><div><strong>${esc(habitatName(o.habitatId))}</strong><p>${o.time==='day'?'☀ Daylight':'☾ Moonlight'} · ${esc((o.sightings||o.observations||[]).map?.(s=>`${creatureName(s.speciesId)} ×${s.count}`).join(', ')||'Recorded in the field')}</p></div><span class="pill">✓ Observed</span></div>`).join('')}<div class="modal-actions"><button class="secondary-button" data-action="investigation">Review investigation</button></div>`;
  if (dexTab==='research' && !state.act1.migrated && state.act1.records.length) body=`<h3>Historical rainfall records</h3>${ACT1_RECORDS.filter(r=>state.act1.records.includes(r.id)).map(r=>`<div class="settings-row"><div><strong>${esc(r.title)}</strong><p>Cycle ${r.cycle} · Day ${r.day} · ${r.temperature}°C</p><p>Original: ${r.rainfall} mm · Archive copy: ${r.archiveRainfall} mm</p></div><span class="pill">${state.act1.compared.includes(r.id)?'✓ Compared':'Preserved'}</span></div>`).join('')}<details class="historical-context" ${preferences.learning==='scholar'?'open':''}><summary>Why earlier observers kept records</summary><p>Mara uses records to decide when to plant and protect crops. Bram compares river levels to prepare for floods. A shared village register lets the next generation learn from earlier storms. A disagreement calls for investigation; it does not establish who changed a record or why.</p></details><h3>Forest field notes</h3>`+body;
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
  if (revealing && !['dialogue-next','dialogue-back','dialogue-reveal','close','speech-toggle','speech-replay','speech-skip'].includes(a)) {finishDialogueReveal();return;}
  if (activeDialogue && !isDialogueComplete(activeDialogue) && !['dialogue-next','dialogue-back','dialogue-reveal','close','speech-toggle','speech-replay','speech-skip'].includes(a)) return;
  if (a==='speech-toggle') {finishDialogueReveal();speech.setEnabled(!speech.getState().enabled);}
  else if (a==='speech-replay') speech.replay();
  else if (a==='speech-skip') {if (speech.getState().status === 'speaking') speech.skip();}
  else if (a==='dialogue-next') moveDialogue('next');
  else if (a==='dialogue-back') moveDialogue('back');
  else if (a==='dialogue-reveal') finishDialogueReveal();
  else if (a==='dialogue-return') openModal(modalData.returnTo,{resumeDialogue:modalData.returnTo==='mastery'});
  else if (a==='close') closeModal();
  else if (a==='begin') { const name=$('observer-name').value.trim()||'Observer'; if (dispatch({type:'SET_NAME',name},{quiet:true})) openModal(state.act1.migrated?'starters':'act1-intro'); }
  else if (a==='choose') {
    if (state.act1.migrated) {if(dispatch({type:'CHOOSE_STARTER',speciesId:button.dataset.id})){closeModal();chime('success');}}
    else openModal('act1-starter-confirm',{id:button.dataset.id});
  }
  else if (a==='act1-confirm-starter') { if(dispatch({type:'CHOOSE_STARTER',speciesId:button.dataset.id})){closeModal();chime('success');} }
  else if (a==='act1-intro-finish') {if(dispatch({type:'ACT1_INTRO_COMPLETE'},{quiet:true})){closeModal();goTo(currentTargets().find(t=>t.id==='lab'));}}
  else if (a==='act1-start') {if(dispatch({type:'ACT1_START'}))closeModal();}
  else if (a==='act1-field') {if(dispatch({type:'ACT1_FIELD_ACTION',id:button.dataset.id}))renderModal();}
  else if (a==='act1-collect') {if(dispatch({type:'ACT1_COLLECT_RECORD',id:button.dataset.id})){chime('success');renderModal();}}
  else if (a==='act1-compare') {if(dispatch({type:'ACT1_COMPARE_RECORD',id:button.dataset.id}))renderModal();}
  else if (a==='act1-compare-finish') {if(dispatch({type:'ACT1_COMPLETE_COMPARISON'}))openModal('act1-discovery');}
  else if (a==='act1-discovery') openModal('act1-discovery');
  else if (a==='act1-receive-dex') {if(dispatch({type:'ACT1_RECEIVE_DEX'})){dexTab='knowledge';openModal('dex');chime('success');}}
  else if (a==='act1-demo-open') openModal('act1-demo',{id:button.dataset.id});
  else if (a==='act1-demo-finish') {if(dispatch({type:'ACT1_DEMO',id:button.dataset.id})){openModal('act1-bond',{resumeDialogue:true});chime('success');}}
  else if (a==='act1-starters') openModal('starters');
  else if (a==='act1-buy') dispatch({type:'BUY_ITEM',id:button.dataset.id});
  else if (a==='act1-side-action') {if(dispatch({type:'ACT1_SIDE_ACTION',id:button.dataset.id})){renderModal();chime('success');}}
  else if (a==='act1-council-finish') {if(dispatch({type:'ACT1_COUNCIL_COMPLETE'})){openModal('act1-completion');chime('success');}}
  else if (a==='act1-completion') openModal('act1-completion');
  else if (a==='act1-replay-intro') openModal('act1-intro');
  else if (a==='act1-depart') {closeModal();goTo(currentTargets().find(t=>t.id==='gate'));}
  else if (a==='start-battle') { if(dispatch({type:'START_BATTLE',kind:button.dataset.kind},{quiet:true}))openModal('battle'); }
  else if (battleCommandButtons.has(a)) selectBattleAction(button,event.detail>0);
  else if (a==='battle-confirm') confirmBattleAction();
  else if (a==='battle-clear') {
    const selected=$('modal-root').querySelector('.battle-action-card[data-selected="true"]');
    battleSelection=null;updateBattleSelection();selected?.focus({preventScroll:true});
  }
  else if (a==='battle-category') {
    battleCategory=button.dataset.id;battleSelection=null;
    $('modal-root').querySelectorAll('[data-battle-group]').forEach(group=>{group.hidden=group.dataset.battleGroup!==battleCategory;});
    $('modal-root').querySelectorAll('[data-action="battle-category"]').forEach(category=>category.setAttribute('aria-pressed',String(category.dataset.id===battleCategory)));
    updateBattleSelection();
  }
  else if (a==='heal') dispatch({type:'HEAL_PARTY'});
  else if (a==='restock') dispatch({type:'RESTOCK'});
  else if (a==='start-investigation') { if(dispatch({type:'START_INVESTIGATION'},{quiet:true}))openModal('investigation'); }
  else if (a==='observe') { dispatch({type:'OBSERVE',habitatId:button.dataset.id});chime('success'); }
  else if (a==='change-time') { if(dispatch({type:'SET_TIME',time:state.time==='day'?'night':'day'})){closeModal();chime();} }
  else if (a==='finding') {
    const wasComplete=quest().status==='complete';
    if (dispatch({type:'SUBMIT_FINDING',answer:button.dataset.answer},{quiet:true})) {
      if (!wasComplete && quest().status==='complete') {openModal('complete');chime('success');}
      else openDialogue('Look again at the evidence','PROFESSOR INFERRA', '', 'inferra-finding-feedback',{
        returnTo:'investigation',answer:button.dataset.answer
      });
    }
  }
  else if (a==='hint') {
    if (dispatch({type:'REQUEST_HINT'},{quiet:true})) openDialogue('A nudge from Inferra','FIELD GUIDANCE','','inferra-hint',{
      returnTo:'investigation',hintLevel:quest().hints,
      missingObservations:getMissingObservations(state).map(row=>row.label),hintTarget:objectiveContent().targetId
    });
  }
  else if (a==='master') {
    const before=conceptStatus('concept_sampling_bias');
    if (dispatch({type:'MASTER_CONCEPT',answer:button.dataset.answer},{quiet:true})) {
      const mastered=conceptStatus('concept_sampling_bias')==='mastered';
      if (mastered) {dexTab='knowledge';if(before!=='mastered')chime('success');}
      openDialogue(mastered?'A thoughtful field researcher':'Reconsider the sampling plan','PROFESSOR INFERRA','','inferra-mastery-feedback',{
        mastered,returnTo:mastered?'dex':'mastery',returnLabel:mastered?'Review discoveries':'Try the plan again'
      });
    }
  }
  else if (a==='mastery') openModal('mastery');
  else if (a==='dex') openModal('dex');
  else if (a==='dex-tab') {dexTab=button.dataset.tab;renderModal();}
  else if (a==='investigation') openModal('investigation');
  else if (a==='places') openModal('places');
  else if (a==='journal') openModal('journal');
  else if (a==='next-objective') followObjective();
  else if (a==='report-findings') {if(dispatch({type:'REPORT_FINDINGS'},{quiet:true})){openModal('report-complete');chime('success');}}
  else if (a==='walk-to') { const target=currentTargets().find(t=>t.id===button.dataset.id);closeModal();if(target)goTo(target); }
  else if (a==='save') {persist(true);renderModal();}
  else if (a==='load') {
    try { const loaded=storage&&loadGame(storage);if(!loaded){toast('No valid browser save was found. Import a backup or keep playing.');return;}state=checkedWorldState(loaded);path=[];updateUI();openModal(state.battle?'battle':'save');toast('Your saved journey has been restored.'); } catch(error){toast(error.message||'The save could not be loaded.');}
  } else if (a==='export') exportSave();
  else if (a==='import') $('import-file').click();
  else if (a==='reset') openModal('reset');
  else if (a==='save-menu') openModal('save');
  else if (a==='reset-confirm') {state=createGame();path=[];persist();updateUI();openModal('welcome');}
});

document.addEventListener('click',event=>{
  const control=event.target.closest('[data-music-action]');
  if (!control||control.disabled) return;
  if (control.dataset.musicAction==='toggle') {
    music.setEnabled(!music.getState().enabled);
    if (music.getState().enabled) void music.unlock();
  } else if (control.dataset.musicAction==='retry') void music.unlock();
});
document.addEventListener('input',event=>{
  if (!event.target.matches('[data-music-action="volume"]')) return;
  music.setVolume(Number(event.target.value)/100);
  if (music.getState().enabled&&music.getState().volume>0) void music.unlock();
});
document.addEventListener('change',event=>{
  const key=event.target.dataset.preference;
  if (!key) return;
  if (key==='combatDifficulty') dispatch({type:'SET_COMBAT_DIFFICULTY',difficulty:event.target.value});
  else {
    preferences=setPreference(preferences,key,event.target.value,storage);
    document.body.classList.toggle('large-text',preferences.textSize==='large');
    if (preferences.dialogueSpeed==='instant') finishDialogueReveal();
    updateUI();
  }
});
function unlockMusicFromGesture(event) {
  if (!event.isTrusted||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target?.closest?.('[data-music-control]')) return;
  if (!music.getState().enabled||music.getState().volume===0) return;
  void music.unlock();
}
window.addEventListener('pointerdown',unlockMusicFromGesture,{capture:true,passive:true});
window.addEventListener('keydown',unlockMusicFromGesture,{capture:true});

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
    if (modal==='battle'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['Enter',' '].includes(event.key)) {
      const action=event.target.closest('button')?.dataset.action;
      if (battleCommandButtons.has(action)||action==='battle-confirm') {
        if (event.repeat||heldBattleKeys.has(event.key)) {event.preventDefault();return;}
        heldBattleKeys.add(event.key);
      }
    }
    if (activeDialogue && !event.ctrlKey && !event.metaKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) && !event.target.closest('[data-music-control]')) {
      const key=event.key.toLowerCase();
      if (['enter',' ','e'].includes(key)) {
        if (event.repeat || heldDialogueKeys.has(key)) {event.preventDefault();return;}
        const focusedAction=event.target.closest('button')?.dataset.action;
        if (key==='e' || (!isDialogueComplete(activeDialogue) && (!focusedAction || focusedAction==='dialogue-next'))) {
          event.preventDefault();heldDialogueKeys.add(key);
          if (!isDialogueComplete(activeDialogue)) moveDialogue('next');
          return;
        }
      }
    }
    if(!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)&&!event.ctrlKey&&!event.metaKey&&['p','P','x','X'].includes(event.key)){
      event.preventDefault();openModal(event.key.toLowerCase()==='p'?'save':'dex');return;
    }
    if(event.key==='Escape'){event.preventDefault();closeModal();}
    if(event.key==='Tab'){
      const items=[...$('modal-root').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(element=>element.getClientRects().length>0);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    if(event.key==='Enter'&&event.target.id==='observer-name') {event.preventDefault();$('modal-root').querySelector('[data-action="begin"]')?.click();}
    return;
  }
  if(/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.target.closest('button,a')&&['Enter',' '].includes(event.key))return;
  const letters=preferences.movement==='ijkl'?{i:'up',k:'down',j:'left',l:'right'}:{w:'up',s:'down',a:'left',d:'right'};
  const direction=({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'})[event.key]||letters[event.key.toLowerCase()];
  if(direction){event.preventDefault();path=[];pathTarget=null;if(performance.now()-lastStep>=85){step(direction);lastStep=performance.now();}}
  else if(event.key==='e'||event.key==='E'||event.key===' '){event.preventDefault();interact();}
  else if(event.key==='p'||event.key==='P'){event.preventDefault();openModal('save');}
  else if(event.key==='x'||event.key==='X'){event.preventDefault();openModal('dex');}
  else if(event.key.toLowerCase()==='q'||event.key.toLowerCase()==='j'&&preferences.movement!=='ijkl'){event.preventDefault();openModal('journal');}
});
document.addEventListener('keyup',event=>{heldDialogueKeys.delete(event.key.toLowerCase());heldBattleKeys.delete(event.key);});
window.addEventListener('blur',()=>{heldDialogueKeys.clear();heldBattleKeys.clear();});

$('dex-button').addEventListener('click',()=>openModal('dex'));
$('save-button').addEventListener('click',()=>openModal('save'));
$('help-button').addEventListener('click',()=>openModal('help'));
$('brand').addEventListener('click',event=>{event.preventDefault();openModal(state.battle?'battle':'help');});
$('investigation-button').addEventListener('click',()=>openModal(state.battle?'battle':'journal'));
$('interact-button').addEventListener('click',()=>interact());
$('mobile-interact').addEventListener('click',()=>interact());
$('time-button').addEventListener('click',()=>{
  if(modal||state.battle)return;
  if(state.map==='forest')goTo(currentTargets().find(t=>t.id==='camp'));
  else toast('Rest at the forest campfire to change between day and night.');
});
document.querySelectorAll('[data-walk]').forEach(button=>button.addEventListener('click',()=>{path=[];pathTarget=null;step(button.dataset.walk);}));
$('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').textContent=sound?'Effects on':'Effects off';$('sound-button').setAttribute('aria-pressed',String(sound));chime('success');});
$('speech-toggle-button').addEventListener('click',()=>{finishDialogueReveal();speech.setEnabled(!speech.getState().enabled);});
document.addEventListener('visibilitychange',()=>{if(document.hidden) speech.skip();music.setHidden(document.hidden);});
window.addEventListener('pagehide',()=>{speech.skip();music.setHidden(true);});
window.addEventListener('pageshow',()=>music.setHidden(document.hidden));

let padHeld=new Set(),padStep=0;
function pollGamepad(now) {
  let gamepad;
  try {gamepad=Array.from(navigator.getGamepads?.()||[]).find(pad=>pad?.mapping==='standard');} catch {return;}
  if (!gamepad) {padHeld.clear();return;}
  const pressed=new Set(gamepad.buttons.flatMap((button,index)=>button.pressed?[index]:[]));
  const fresh=index=>pressed.has(index)&&!padHeld.has(index);
  if (fresh(1)&&modal) closeModal();
  else if (fresh(9)&&!state.battle) openModal('journal');
  else if (fresh(0)) {
    if (!modal) interact();
    else if (activeDialogue&&!isDialogueComplete(activeDialogue)) moveDialogue('next');
    else document.activeElement?.closest('#modal-root button:not(:disabled)')?.click();
  }
  if (!modal&&now-padStep>140) {
    const [horizontal=0,vertical=0]=gamepad.axes;
    const direction=pressed.has(12)||vertical<-.5?'up':pressed.has(13)||vertical>.5?'down':pressed.has(14)||horizontal<-.5?'left':pressed.has(15)||horizontal>.5?'right':null;
    if (direction) {path=[];pathTarget=null;step(direction);padStep=now;}
  }
  // With a dialog open, D-pad presses move keyboard focus through its controls.
  if (modal&&[12,13,14,15].some(fresh)) {
    const controls=[...$('modal-root').querySelectorAll('button:not(:disabled),input,select,summary')].filter(element=>element.getClientRects().length);
    const previous=fresh(12)||fresh(14),index=controls.indexOf(document.activeElement);
    controls[(index+(previous?-1:1)+controls.length)%controls.length]?.focus({preventScroll:true});
  }
  padHeld=pressed;
}

function frame(now){
  if (!document.hidden) pollGamepad(now);
  if(!document.hidden&&now-lastDraw>(reducedMotion?250:70)){
    if(path.length&&!modal&&now-lastStep>110){const point=path.shift();const dx=point.x-state.player.x,dy=point.y-state.player.y;step(dx>0?'right':dx<0?'left':dy>0?'down':'up');lastStep=now;if(!path.length&&pathTarget){const target=pathTarget;pathTarget=null;interact(target);}}
    const scene=modal==='act1-intro'?(activeDialogue.index===0?'calm':activeDialogue.index<3?'storm':'aftermath'):'aftermath';
    renderWorld($('world'),{...state,act1Scene:scene},{selectedTarget:pathTarget?.id,reduceMotion:reducedMotion});
    if ($('intro-world')) renderWorld($('intro-world'),{...state,map:'village',act1Scene:scene},{reduceMotion:reducedMotion});
    lastDraw=now;
  }
  requestAnimationFrame(frame);
}

updateSpeechControls();
updateUI();
if(state.battle)openModal('battle');
else if(!state.starter&&(!resumed||state.act1.migrated&&!state.flags.introSeen))openModal('welcome');
else if(resumed)toast('Welcome back, '+state.player.name+'. Your journey has been restored.');
if(unreadableSave)toast('The browser save could not be read. You can import a backup in Save & load.');
if(!savingAvailable)$('save-status').textContent='Automatic saving unavailable · Export a save in Save & load';
music.setHidden(document.hidden);
syncMusic();
requestAnimationFrame(frame);
