// Presentation preferences are browser-local and never grant quest progress.
export const PREFERENCES_KEY='chronicles-of-data.accessibility.v1';
const defaults={textSize:'standard',dialogueSpeed:'instant',learning:'adventure',movement:'wasd'};
const allowed={textSize:['standard','large'],dialogueSpeed:['instant','steady','slow'],learning:['adventure','explorer','scholar'],movement:['wasd','ijkl']};
export function readPreferences(storage) {
  let value;
  try {value=JSON.parse(storage?.getItem(PREFERENCES_KEY));} catch {}
  return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,allowed[key].includes(value?.[key])?value[key]:fallback]));
}
export function setPreference(preferences,key,value,storage) {
  if (!Object.hasOwn(allowed,key)||!allowed[key].includes(value)) return preferences;
  const next={...preferences,[key]:value};
  try {storage?.setItem(PREFERENCES_KEY,JSON.stringify(next));} catch {}
  return next;
}
export function preferencesMarkup(preferences,difficulty='standard') {
  const select=(key,label,options)=>`<label>${label}<select data-preference="${key}" aria-label="${label}">${options.map(([value,text])=>`<option value="${value}" ${(key==='combatDifficulty'?difficulty:preferences[key])===value?'selected':''}>${text}</option>`).join('')}</select></label>`;
  return `<div class="accessibility-controls">${select('textSize','Text size',[['standard','Standard'],['large','Large']])}${select('dialogueSpeed','Dialogue reveal',[['instant','Instant'],['steady','Steady'],['slow','Slow']])}${select('movement','Movement keys',[['wasd','WASD + arrows'],['ijkl','IJKL + arrows']])}${select('learning','Learning preference',[['adventure','Adventure · story first'],['explorer','Explorer · show directions'],['scholar','Scholar · extra context']])}${select('combatDifficulty','Combat difficulty',[['standard','Standard'],['relaxed','Relaxed']])}</div><p>Learning preferences adjust guidance and optional context. All preferences share the same story. Combat difficulty changes incoming damage separately and can be changed between battles. Arrow keys always work. A connected gamepad uses its stick or D-pad to move, A to interact or activate the focused button, B to close, and Start for the journal.</p>`;
}
