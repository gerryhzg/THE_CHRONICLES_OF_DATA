import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, isWalkable } from '../dist/world.js';
import { HABITATS, createGame } from '../dist/engine.js';

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
