import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, serializeGame } from '../dist/engine.js';
import { getMusicScene } from '../dist/music-scenes.js';

function sceneState({ map = 'village', time = 'day', questStatus = 'locked', mastered = false, battle = null } = {}) {
  return { map, time, battle, quests: { nocturnal: { status: questStatus } }, dex: { concepts: { concept_sampling_bias: mastered ? 'mastered' : 'unknown' } } };
}

test('exploration follows place and time, and ordinary menus preserve that bed', () => {
  for (const [map, time, expected] of [['village', 'day', 'village'], ['forest', 'day', 'forest'], ['village', 'night', 'night'], ['forest', 'night', 'night']]) {
    const state = sceneState({ map, time });
    for (const modal of [null, 'dex', 'save', 'help', 'journal', 'habitat', 'lyra', 'lyra-report', 'starters', 'rival', 'wild', 'dialogue']) {
      assert.equal(getMusicScene(state, { modal }), expected, `${map}/${time}/${modal}`);
    }
  }
  assert.equal(getMusicScene(), 'village');
});

test('an unfinished battle keeps its theme through every overlay', () => {
  const state = sceneState({ map: 'forest', time: 'night', battle: { kind: 'wild' } });
  for (const modal of ['battle', 'dex', 'save', 'complete', 'camp', 'dialogue', 'battle-result', null]) {
    assert.equal(getMusicScene(state, { modal, modalData: { mastered: true, progression: { outcome: 'victory' } } }), 'battle');
  }
});

test('result themes distinguish victories, bonds, defeats and safe departures', () => {
  const state = sceneState({ map: 'forest', time: 'night' });
  for (const [outcome, expected] of [['victory', 'celebration'], ['bond', 'celebration'], ['defeat', 'rest'], ['escape', 'night']]) {
    assert.equal(getMusicScene(state, { modal: 'battle-result', modalData: { progression: { outcome }, won: true } }), expected);
    assert.equal(getMusicScene(state), 'night', 'closing a result returns to exploration');
  }
  for (const modalData of [{ won: true }, { recruited: true }]) assert.equal(getMusicScene(state, { modal: 'battle-result', modalData }), 'celebration');
  assert.equal(getMusicScene(state, { modal: 'battle-result' }), 'night');
});

test('research and completion themes reflect the current story moment', () => {
  for (const status of ['locked', 'active', 'ready', 'complete']) {
    const state = sceneState({ map: 'forest', questStatus: status });
    assert.equal(getMusicScene(state, { modal: 'inferra' }), ['locked', 'ready'].includes(status) ? 'mystery' : 'forest');
    assert.equal(getMusicScene(state, { modal: 'investigation' }), status === 'complete' ? 'forest' : 'mystery');
  }
  const state = sceneState();
  for (const modal of ['tower', 'mastery']) assert.equal(getMusicScene(state, { modal }), 'mystery');
  for (const conversationId of ['inferra-hint', 'inferra-finding-feedback', 'inferra-mastery-feedback']) {
    assert.equal(getMusicScene(state, { modal: 'dialogue', modalData: { conversationId, mastered: false } }), 'mystery');
  }
  for (const modal of ['complete', 'report-complete']) assert.equal(getMusicScene(state, { modal }), 'celebration');
  assert.equal(getMusicScene(state, { modal: 'dialogue', modalData: { conversationId: 'inferra-mastery-feedback', mastered: true } }), 'celebration');
  assert.equal(getMusicScene(sceneState({ mastered: true }), { modal: 'mastery' }), 'celebration');
  assert.equal(getMusicScene(sceneState({ mastered: true }), { modal: 'save' }), 'village', 'a past achievement does not turn unrelated screens into celebrations');
});

test('rest stops keep their theme through dialogue and return to current exploration', () => {
  const state = sceneState({ map: 'forest', time: 'night' });
  for (const modal of ['camp', 'sanctuary']) {
    for (const speaker of ['narrator', 'lyra', 'player']) {
      assert.equal(getMusicScene(state, { modal, segment: { speaker, expression: 'happy' }, dialogueActive: true }), 'rest');
    }
    assert.equal(getMusicScene(state, { modal: null }), 'night');
  }
});

test('changing a dialogue line cannot oscillate the scene or change saved gameplay', () => {
  const state = createGame();
  const before = serializeGame(state);
  for (const [speaker, expression] of [['inferra', 'happy'], ['ranger', 'surprised'], ['player', 'thoughtful']]) {
    assert.equal(getMusicScene(state, { modal: 'inferra', segment: { speaker, expression }, dialogueActive: true }), 'mystery');
  }
  assert.equal(serializeGame(state), before, 'the soundtrack never grants rewards, changes time, or advances quests');
  assert.equal(getMusicScene(state), 'village');
});
