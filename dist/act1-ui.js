// Act I presentation. Progress is changed only by engine actions in app.js.
import { ACT1_RECORDS, ACT1_SHOP, SPECIES, getAct1TutorialStep } from './engine.js';

export function act1ConversationActions(state, modal, data, {esc, portrait}) {
  const a = state.act1;
  if (!a || !modal.startsWith('act1-')) return null;
  const button = (label, action, id='', disabled=false) => `<button class="primary-button" data-action="${action}" ${id?`data-id="${esc(id)}"`:''} ${disabled?'disabled':''}>${label}</button>`;
  const close = '<button class="secondary-button" data-action="close">Continue exploring</button>';
  const actions = content => `<div class="dialogue-followup">${content}</div>`;
  const row = content => `<div class="modal-actions">${content}</div>`;
  if (modal==='act1-intro') return actions(row(button('Visit Lyra’s laboratory →','act1-intro-finish')));
  if (modal==='act1-lyra') {
    if (!a.started) return actions(row(button('Help recover the records','act1-start')+close));
    return actions(`<p>${a.records.length} / 3 original records recovered. ${a.records.length===3?'Orin is ready at the Weather Tower.':'Look for the crate at Mara’s farm, the river reeds, and Nell’s stamped delivery.'}</p>`+row(button('Follow the investigation','journal')+close));
  }
  if (modal==='act1-farm' || modal==='act1-river') {
    const farm = modal==='act1-farm', id=farm?'farm':'river';
    if (!a.started) return actions(`<p>Professor Lyra is asking for help at the laboratory.</p>`+row(close));
    if (a.records.includes(id)) return actions(`<div class="record-found">✓ ${farm?'Farmer’s Ledger':'River Observation Sheet'} preserved in your notebook.</div>`+row(close));
    const ready=farm?a.fieldSteps.farmCrateMoved:a.fieldSteps.riverLocated;
    return actions(`<div class="field-object ${ready?'revealed':''}"><span aria-hidden="true">${ready?'▤':farm?'▣':'≋'}</span><div><h3>${ready?'An original weather record':farm?'A crate in the flooded barn':'Ripples lead toward the reeds'}</h3><p>${ready?'The paper carries the Weather Tower stamp. Lift it carefully.':farm?'A corner of paper is trapped beneath the damaged crate.':'A pale sheet is caught among reeds beside the safe riverbank.'}</p></div></div>`+row(ready?button('Preserve the record','act1-collect',id):button(farm?'Move the damaged crate':'Follow the ripples and part the reeds','act1-field',farm?'farm_crate':'river_reeds'))+row(close));
  }
  if (modal==='act1-shop') {
    const objects=[['shop_receipt','Shipping receipt','Market deliveries · no tower emblem'],['shop_box','Empty potion box','A damp box with a healing-leaf stamp'],['shop_tower','Stamped weather document','A brass tower emblem on the paper seal']];
    const inspection=a.started&&!a.records.includes('shop')?`<h3>Inspect Nell’s delivery</h3><div class="inspection-grid">${objects.map(([id,title,detail])=>`<button class="inspection-object" data-action="act1-field" data-id="${id}" ${a.fieldSteps.shopInspected.includes(id)?'disabled':''}><strong>${title}</strong><span>${detail}</span><small>${a.fieldSteps.shopInspected.includes(id)?'✓ Examined':'Inspect object →'}</small></button>`).join('')}</div>${a.fieldSteps.shopInspected.includes('shop_tower')?row(button('Preserve Village Weather Register','act1-collect','shop',a.fieldSteps.shopInspected.length<3)):''}`:a.records.includes('shop')?'<div class="record-found">✓ Village Weather Register recovered.</div>':'<p>Speak to Lyra about the scattered records first.</p>';
    return actions(inspection+`<h3 class="shop-heading">Nell’s supplies <small>${state.coins} Aether Coins</small></h3><div class="shop-stock">${ACT1_SHOP.map(item=>`<div class="settings-row"><div><strong>${esc(item.title)}</strong><p>${item.price} coins · ${state.inventory[item.inventoryKey]} carried</p></div>${button('Buy','act1-buy',item.id,state.coins<item.price)}</div>`).join('')}</div>`+row(close));
  }
  if (modal==='act1-tower') {
    const forecast='<div class="forecast-strip"><div><span>DAY 127 · FORECAST</span><strong>0 mm</strong></div><div><span>MEASURED TODAY</span><strong class="rain">46 mm</strong></div><div><span>ARCHIVE CLAIM</span><strong class="archive-perfect">Perfect.</strong></div></div>';
    if (!a.started || a.records.length<3) return actions(forecast+`<p>${a.started?`${a.records.length} / 3 originals recovered. Find the remaining records before restoring the comparison table.`:'Lyra needs your help recovering the original records. Visit her laboratory.'}</p>`+row(button('Open quest journal','journal')+close));
    if (a.dexReceived) return actions(forecast+`<div class="record-found">✓ Originals preserved · three Archive discrepancies recorded.</div>`+row(button('Review historical records','dex')+close));
    if (a.comparisonComplete) return actions(row(button('Discuss the evidence with Lyra','act1-discovery')+close));
    return actions(forecast+`<h3>Which records do not agree?</h3><p>Slide each original into its reading panel. Compare the rainfall on the paper with its Archive copy. These are historical observations from different cycles; today’s storm is shown separately above.</p><div class="comparison-table"><div class="comparison-head"><span>Original record</span><span>Paper</span><span>Archive</span><span>Inspect</span></div>${ACT1_RECORDS.map(r=>`<div class="comparison-row ${a.compared.includes(r.id)?'compared':''}"><div><strong>${esc(r.title)}</strong><small>Cycle ${r.cycle} · Day ${r.day} · ${r.temperature}°C</small></div><strong>${r.rainfall} mm</strong><strong>${r.archiveRainfall} mm</strong><button class="record-slider" data-action="act1-compare" data-id="${r.id}" ${a.compared.includes(r.id)?'disabled':''} aria-label="Inspect mismatch in ${esc(r.title)}">${a.compared.includes(r.id)?'✓ Mismatch':'Slide →'}</button></div>`).join('')}</div><div class="evidence-note">${a.compared.length} / 3 reading panels inspected. The originals show rain; the copies show zero.</div>`+row(button('Compare the restored records','act1-compare-finish','',a.compared.length<3)+close));
  }
  if (modal==='act1-discovery') return actions(`<div class="integrity-warning"><strong>DATA INTEGRITY WARNING</strong><span>Original records: rainfall detected</span><span>Archive copies: no rainfall recorded</span><span>Source history: incomplete</span></div>`+row(button('Accept and activate the DataDex','act1-receive-dex')+close));
  if (modal==='act1-bond') return actions(`<p>Spend time with each companion before making your choice. Every starter can complete the adventure.</p><div class="starter-grid">${['creature_statifox','creature_algobear','creature_terradeer'].map(id=>`<button class="starter-card" data-action="act1-demo-open" data-id="${id}">${portrait(id,120)}<h3>${esc(SPECIES[id].name)}</h3><p>${esc(SPECIES[id].role)}</p><span class="choose">${a.demos.includes(id)?'✓ Demonstration seen · revisit':'Watch demonstration →'}</span></button>`).join('')}</div>`+row(button('Choose your first partner','act1-starters','',a.demos.length<3)+close));
  if (modal==='act1-demo') {
    const id=data.id;
    const content={creature_statifox:['Weather sensors','16° · 17° · 83°','One sensor flickers while its neighbors remain steady. Statifox points toward its loose connection.','Inspect the flickering sensor'],creature_algobear:['The stalled waterwheel','Intake → loose gear → pump','Algobear has found a gear facing away from the drive shaft. Help it turn the gear until the teeth meet.','Align the loose gear'],creature_terradeer:['A wilting crop','Damp soil · standing water','Terradeer’s antlers illuminate the roots. The soil is soaked even though the Oracle called for drought.','Examine the wet roots']}[id];
    return actions(`<div class="demo-stage">${portrait(id,150)}<div><h3>${content[0]}</h3><div class="demo-readings">${content[1]}</div><p>${content[2]}</p></div></div>`+row(button(content[3],'act1-demo-finish',id)+close));
  }
  if (modal==='act1-council') return actions(row(a.councilComplete?button('Review Act I completion','act1-completion'):button('Commit to the expedition · open the northern road','act1-council-finish'))+row(close));
  if (modal==='act1-gate') return actions(row(button('Review the current objective','journal')+close));
  if (modal==='act1-home') return actions(`<div class="settings-grid"><div class="settings-row"><div><strong>Your bed</strong><p>Rest at home and restore your companions.</p></div>${button('Rest','heal')}</div><div class="settings-row"><div><strong>Travel chest</strong><p>Keep a copy of your journey before leaving the village.</p></div>${button('Save & load','save-menu')}</div></div>`+row(close));
  if (modal==='act1-sanctuary') return actions(`<div class="settings-grid"><div class="settings-row"><div><strong>Elin’s care station</strong><p>Restore all HP and Focus for free.</p></div>${button('Heal party','heal')}</div><div class="settings-row"><div><strong>Expedition supplies</strong><p>Replenish your potions and Bond Crystals for another attempt.</p></div>${button('Restock','restock')}</div></div>`+row(close));
  if (modal==='act1-side') {
    const id=data.id;
    const choices={scarf:['Lift the scarf from the hedge','scarf_find',a.side.scarfFound],child:['Return the lost scarf · 15 coins','scarf_return',!a.side.scarfFound||a.side.scarfReturned],observer:['Read the old Observer journal','old_journal',a.side.oldJournal],supply:['Open the supply chest','supply_chest',a.side.supplyChest],garden:['Clear the irrigation debris','garden_clear',a.side.gardenCleared]};
    const choice=choices[id];
    return actions((choice?row(button(choice[2]?'✓ '+(id==='child'&&!a.side.scarfFound?'Find the scarf near the old bridge first':'Discovery recorded'):choice[0],'act1-side-action',choice[1],choice[2])):'')+row(close));
  }
  return null;
}

export function act1SpecialModal(state,modal,data,{esc,portrait,shell}) {
  if (modal==='act1-starter-confirm') {
    const s=SPECIES[data.id];
    return shell(`Partner with ${s.name}?`,'THE FIRST BOND',`<div class="starter-preview">${portrait(data.id,180)}<div><h3>${s.name}</h3><p>${esc(s.description)}</p><div class="starter-stats"><span>Lv. 5</span><span>${s.baseHp+15} HP</span><span>Power ${s.power}</span><span>Guard ${s.guard}</span></div><p>Inspecting a companion does not make your choice. Confirm when you are ready.</p></div></div><div class="modal-actions"><button class="primary-button" data-action="act1-confirm-starter" data-id="${data.id}">Confirm ${s.name}</button><button class="secondary-button" data-action="act1-starters">Compare companions</button></div>`);
  }
  if (modal==='act1-completion') return shell('Act I complete','HARVEST VILLAGE · THE BROKEN FORECAST',`<div class="act-completion"><span class="completion-mark">✧</span><h3>A village begins observing again.</h3><p>Your records helped Harvest Village question a forecast and restore its own observations. The cause of the Archive discrepancies is still unknown. Lyra’s next lead waits in Twin Scholars’ Forest.</p><div class="completion-unlocks">${['First Databeast bonded','DataDex activated','Attack, guard, Scan and switching practiced','Bonding available','Northern road open'].map(t=>`<span>✓ ${t}</span>`).join('')}</div><p>Your progress is saved. You can return to the village after entering the forest.</p></div><div class="modal-actions"><button class="primary-button" data-action="act1-depart">Walk to the northern gate →</button><button class="secondary-button" data-action="close">Explore the village first</button></div>`);
  return null;
}

export function act1IntroMarkup(index) {
  const storm=index>=1;
  return `<div class="intro-panorama ${storm?'storm':'calm'}"><canvas id="intro-world" width="768" height="528" aria-label="Harvest Village ${storm?'in the storm':'before the storm'}"></canvas><div class="intro-caption"><span>GRAND ARCHIVE · DAY 127</span><strong>${storm?'Forecast: 0 mm · measured: 46 mm':'Expected rainfall: 0 mm'}</strong><small class="${storm?'archive-perfect':''}">${storm?'Predictions remain perfect.':'Drought conditions continue · confidence: absolute'}</small></div></div>`;
}

export function act1TutorialMarkup(state) {
  const next=getAct1TutorialStep(state);
  if (!next) return '';
  const copy={attack:'Choose a basic attack in Skills, then press Use. Read the damage beside your opponent.',guard:'Open Tactics & supplies and use Guard. Watch the reduced incoming damage.',scan:'Open Tactics & supplies and use DataDex Scan. Your first scan is free.',switch:'Open Switch partner and choose the borrowed Cloudfin. Switching spends a turn; Cloudfin returns to Lyra after practice.'};
  return `<aside class="tutorial-coach" role="status"><strong>Lyra’s training · ${['attack','guard','scan','switch'].indexOf(next)+1} / 4</strong><p>${copy[next]}</p><small>Practice all four commands, then finish the match. A loss costs no coins or supplies.</small></aside>`;
}
