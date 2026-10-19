import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, isWalkable, drawCreature, restoreMapPosition } from '../dist/world.js';
import { HABITATS, SPECIES, createGame, act, serializeGame } from '../dist/engine.js';
import { createLegacyGame } from './fixtures.mjs';

function reachable(mapId, start) {
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = `${next.x},${next.y}`;
      if (!visited.has(key) && isWalkable(mapId, next.x, next.y)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return queue;
}

for (const [mapId, map] of Object.entries(MAPS)) {
  test(`${map.name}: spawn and every interaction can be reached`, () => {
    assert.ok(isWalkable(mapId, map.spawn.x, map.spawn.y), 'spawn must be walkable');
    const tiles = reachable(mapId, map.spawn);
    for (const target of map.interactables) {
      assert.ok(tiles.some(tile => Math.abs(tile.x - target.x) + Math.abs(tile.y - target.y) <= 1), `${target.name} must have a reachable interaction tile`);
    }
    assert.equal(isWalkable(mapId, -1, 1), false);
    assert.equal(isWalkable(mapId, map.width, 1), false);
    assert.equal(isWalkable(mapId, 1, map.height), false);
    assert.equal(isWalkable(mapId, 1.5, 1), false);
  });
}

test('new game starts on the village spawn, and every research habitat has a map target', () => {
  const state = createGame();
  assert.equal(state.map, 'village');
  assert.deepEqual({ x: state.player.x, y: state.player.y }, MAPS.village.spawn);
  assert.ok(isWalkable(state.map, state.player.x, state.player.y));
  const mapHabitatIds = MAPS.forest.interactables.filter(target => target.type === 'habitat').map(target => target.habitat);
  assert.deepEqual(new Set(mapHabitatIds), new Set(HABITATS.map(habitat => habitat.id)));
});

test('every roster species has distinct artwork, including the borrowed Cloudfin', () => {
  const drawings=Object.keys(SPECIES).map(id=>{
    const operations=[];
    const context=new Proxy({}, {get:(_,key)=>key==='getContext'?undefined:(...args)=>operations.push([key,...args])});
    drawCreature(context,id);
    return JSON.stringify(operations);
  });
  assert.equal(new Set(drawings).size,Object.keys(SPECIES).length,'a new species must not fall back to another creature’s silhouette');
});

test('old village saves displaced by the new river keep their party and unfinished battle', () => {
  let state=act(createLegacyGame(),{type:'CHOOSE_STARTER',speciesId:'creature_algobear'}).state;
  state=act(state,{type:'START_BATTLE',kind:'rival'}).state;
  state.player.x=2;state.player.y=18;
  assert.equal(isWalkable('village',2,18),false);
  const before=serializeGame(state);
  const restored=restoreMapPosition(state);
  assert.deepEqual(restored.player,{...state.player,...MAPS.village.spawn});
  assert.deepEqual(restored.party,state.party);
  assert.deepEqual(restored.battle,state.battle);
  assert.deepEqual(restored.quests,state.quests);
  assert.equal(serializeGame(state),before,'migration must not mutate the imported object');
  assert.equal(restoreMapPosition(restored),restored);
  const invalid=createGame();invalid.player.x=2;invalid.player.y=18;
  assert.throws(()=>restoreMapPosition(invalid),/outside the walkable map/,'new invalid saves must still be rejected');
});
