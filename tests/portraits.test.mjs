import test from 'node:test';
import assert from 'node:assert/strict';
import { SPEAKERS, resolveSpeaker, portraitMarkup } from '../dist/portraits.js';

const expectedIds = ['lyra', 'kai', 'inferra', 'rowan', 'ranger', 'observer', 'narrator'];
// Compare the painted shapes, excluding accessibility labels that also change.
const paintedArt = svg => svg.match(/<g\b[^>]*>([\s\S]*)<\/g>/)?.[1];

test('every game speaker has a responsive, accessible portrait for each advertised expression', () => {
  assert.deepEqual(Object.keys(SPEAKERS), expectedIds);
  for (const [id, speaker] of Object.entries(SPEAKERS)) {
    assert.equal(speaker.id, id);
    assert.ok(speaker.name && speaker.role, `${id} must be identifiable`);
    assert.ok(speaker.expressions.includes('neutral'), `${id} needs a fallback expression`);
    assert.equal(new Set(speaker.expressions).size, speaker.expressions.length);
    for (const expression of speaker.expressions) {
      const svg = portraitMarkup(id, expression);
      const root = svg.match(/^<svg\b[^>]*>/)?.[0];
      assert.ok(root, `${id}/${expression} must render an SVG`);
      assert.match(root, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(root, /viewBox="0 0 128 128"/);
      assert.match(root, /role="img"/);
      assert.ok(root.includes(`aria-label="${speaker.name}, ${expression} expression"`));
      assert.doesNotMatch(root, /\s(?:width|height)=/, 'portraits must fit their dialogue container');
      assert.ok(svg.includes(`<title>${speaker.name}, ${expression} expression</title>`));
      assert.match(svg, /<rect\b/);
      assert.match(svg, /<polygon\b/);
      assert.match(svg, /<\/g><\/svg>$/);
      assert.doesNotMatch(svg, /(?:NaN|undefined|<script\b|<image\b|\son\w+=|\shref=)/i);
    }
  }
});

test('expressions change the painted face and every speaker has distinct artwork', () => {
  const neutralPortraits = [];
  for (const speaker of Object.values(SPEAKERS)) {
    const expressions = speaker.expressions.map(expression => paintedArt(portraitMarkup(speaker.id, expression)));
    assert.ok(expressions.every(Boolean));
    assert.equal(new Set(expressions).size, expressions.length, `${speaker.name}'s expressions must change the art, not only its label`);
    neutralPortraits.push(paintedArt(portraitMarkup(speaker.id)));
  }
  assert.equal(new Set(neutralPortraits).size, expectedIds.length, 'speakers must have recognizable, different portraits');
});

test('unavailable expressions render the exact neutral portrait', () => {
  for (const id of expectedIds) {
    for (const unsupported of ['missing', '<script>', '', null, undefined]) {
      assert.equal(portraitMarkup(id, unsupported), portraitMarkup(id, 'neutral'));
    }
  }
  assert.ok(SPEAKERS.kai.expressions.includes('determined'));
  assert.equal(portraitMarkup('lyra', 'determined'), portraitMarkup('lyra'));
});

test('unknown and inherited-property speaker names safely resolve to DataDex', () => {
  for (const id of ['missing', '__proto__', 'constructor', 'toString', '', null, undefined]) {
    assert.equal(resolveSpeaker(id), SPEAKERS.narrator);
    assert.equal(portraitMarkup(id), portraitMarkup('narrator'));
    assert.equal(portraitMarkup(id, 'happy'), portraitMarkup('narrator', 'happy'));
  }
});

test('Observer names are resolved without changing the shared speaker registry', () => {
  assert.equal(resolveSpeaker('observer', '  Maya  ').name, 'Maya');
  for (const name of ['', '   ', null, undefined, 42]) {
    assert.equal(resolveSpeaker('observer', name).name, 'Observer');
  }
  assert.equal(resolveSpeaker('lyra', 'Maya').name, SPEAKERS.lyra.name);
  const observer = resolveSpeaker('observer', 'Maya');
  observer.name = 'Changed';
  assert.equal(SPEAKERS.observer.name, 'Observer');
  assert.equal(resolveSpeaker('observer', 'Maya').name, 'Maya');
});

test('player names are XML escaped in both the portrait label and title', () => {
  const name = `A<&>"' <script>alert(1)</script>`;
  const escaped = 'A&lt;&amp;&gt;&quot;&apos; &lt;script&gt;alert(1)&lt;/script&gt;';
  const svg = portraitMarkup('observer', 'happy', name);
  assert.ok(svg.includes(`aria-label="${escaped}, happy expression"`));
  assert.ok(svg.includes(`<title>${escaped}, happy expression</title>`));
  assert.doesNotMatch(svg, /<script\b|<\/script>/i);
  assert.ok(!svg.includes(name));
  assert.equal(paintedArt(svg), paintedArt(portraitMarkup('observer', 'happy', 'Observer')), 'names must never become part of the artwork');
});

test('the speaker registry and advertised expressions cannot be mutated', () => {
  assert.ok(Object.isFrozen(SPEAKERS));
  assert.throws(() => { SPEAKERS.extra = {}; }, TypeError);
  for (const speaker of Object.values(SPEAKERS)) {
    assert.ok(Object.isFrozen(speaker));
    assert.ok(Object.isFrozen(speaker.expressions));
    assert.throws(() => { speaker.name = 'Changed'; }, TypeError);
    assert.throws(() => { speaker.expressions.push('missing'); }, TypeError);
  }
});
