/* Original pixel portraits. Coordinates use a 64px art grid, displayed at 128px.
   Each speaker's expressions lists exactly the supported variants; an unsupported
   expression falls back to neutral so dialogue never loses its portrait. */
const commonExpressions = ['neutral', 'thoughtful', 'happy', 'concerned'];
const speaker = (id, name, role, accent, expressions = commonExpressions) => Object.freeze({
  id, name, role, accent, expressions: Object.freeze([...expressions]),
});

export const SPEAKERS = Object.freeze({
  lyra: speaker('lyra', 'Professor Lyra', 'Databeast researcher', '#9bbfbb'),
  kai: speaker('kai', 'Kai', 'Your fellow Observer', '#dfa974', [...commonExpressions, 'determined']),
  inferra: speaker('inferra', 'Professor Inferra', 'Field researcher', '#b3c99a'),
  rowan: speaker('rowan', 'Elder Rowan', 'Harvest Village elder', '#d9c08a'),
  ranger: speaker('ranger', 'Forest Ranger', 'Guardian of the forest', '#b4c08b'),
  observer: speaker('observer', 'Observer', 'Databeast adventurer', '#a5c3cf'),
  narrator: speaker('narrator', 'DataDex', 'Your field companion', '#d6ba7a'),
  mara: speaker('mara', 'Farmer Mara', 'Keeper of the flooded fields', '#d9aa75'),
  orin: speaker('orin', 'Tower Keeper Orin', 'Keeper of the weather records', '#9bb1c9'),
  nell: speaker('nell', 'Shopkeeper Nell', 'Harvest Village shopkeeper', '#d5a1a5'),
  bram: speaker('bram', 'Fisher Bram', 'Observer of the village river', '#91bbc4'),
  elin: speaker('elin', 'Sanctuary Keeper Elin', 'Databeast caretaker', '#a9c6a3'),
  tomas: speaker('tomas', 'Village Guard Tomas', 'Guardian of the northern road', '#b4a6cd'),
  child: speaker('child', 'Village Child', 'A neighbor looking for a scarf', '#deb485'),
});

export function resolveSpeaker(id, playerName = 'Observer') {
  const found = Object.hasOwn(SPEAKERS, id) ? SPEAKERS[id] : SPEAKERS.narrator;
  if (found.id !== 'observer') return found;
  const name = typeof playerName === 'string' && playerName.trim() ? playerName.trim() : 'Observer';
  return { ...found, name };
}

const escapeXML = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]));
const rect = (color, x, y, width, height, opacity = 1) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${color}" opacity="${opacity}"/>`;
const polygon = (color, points, opacity = 1) =>
  `<polygon points="${points.map(point => point.join(',')).join(' ')}" fill="${color}" opacity="${opacity}"/>`;

const palette = {
  outline: '#283b39', gold: '#d6ba7a', goldLight: '#f0dcaa', teal: '#719b91',
  cream: '#eae3cf', eye: '#263b3d', white: '#f4ead4',
};

function background(accent) {
  return rect('#192b26', 0, 0, 64, 64)
    + polygon('#253d33', [[0, 10], [10, 10], [10, 5], [54, 5], [54, 10], [64, 10], [64, 64], [0, 64]])
    + rect(accent, 8, 10, 48, 38, .09)
    + polygon(accent, [[32, 6], [55, 29], [32, 52], [9, 29]], .07)
    + rect(accent, 6, 13, 2, 7, .3) + rect(accent, 56, 40, 2, 7, .3)
    + rect('#0f201c', 0, 60, 64, 4);
}

function face({ skin = '#e5ba8d', shadow = '#bd895f', light = '#f0c99c', eyebrow = '#66523f' }, expression) {
  let markup = rect(palette.outline, 19, 21, 26, 20)
    + rect(shadow, 18, 27, 5, 10) + rect(skin, 19, 28, 3, 7)
    + rect(shadow, 42, 27, 5, 10) + rect(skin, 43, 28, 3, 7)
    + polygon(shadow, [[22, 18], [42, 18], [44, 25], [43, 41], [38, 47], [26, 47], [21, 41], [20, 25]])
    + polygon(skin, [[23, 19], [41, 19], [42, 25], [41, 40], [37, 45], [27, 45], [23, 40], [22, 25]])
    + rect(light, 25, 22, 13, 5) + rect(light, 23, 27, 4, 10)
    + rect(shadow, 31, 33, 2, 5) + rect(light, 30, 33, 2, 4)
    + rect(shadow, 30, 38, 4, 1);
  if (expression === 'happy') {
    markup += polygon(eyebrow, [[24, 28], [27, 27], [29, 28], [29, 29], [27, 28], [24, 29]])
      + polygon(eyebrow, [[35, 28], [37, 27], [40, 28], [40, 29], [37, 28], [35, 29]])
      + rect(palette.eye, 24, 31, 2, 1) + rect(palette.eye, 26, 30, 2, 1) + rect(palette.eye, 28, 31, 2, 1)
      + rect(palette.eye, 34, 31, 2, 1) + rect(palette.eye, 36, 30, 2, 1) + rect(palette.eye, 38, 31, 2, 1)
      + polygon('#845849', [[28, 40], [36, 40], [35, 43], [30, 43]])
      + rect(palette.white, 29, 40, 6, 1)
      + rect(shadow, 23, 36, 4, 2, .6) + rect(shadow, 38, 36, 3, 2, .6);
  } else {
    const pupilShift = expression === 'thoughtful' ? 1 : 0;
    markup += rect(palette.white, 24, 30, 6, 3) + rect(palette.white, 34, 30, 6, 3)
      + rect(palette.eye, 26 + pupilShift, 30, 2, 4) + rect(palette.eye, 36 + pupilShift, 30, 2, 4)
      + rect('#688980', 26 + pupilShift, 32, 1, 1) + rect('#688980', 36 + pupilShift, 32, 1, 1);
    if (expression === 'concerned') {
      markup += polygon(eyebrow, [[24, 28], [24, 29], [30, 27], [30, 26]])
        + polygon(eyebrow, [[34, 26], [34, 27], [40, 29], [40, 28]])
        + rect('#845849', 29, 40, 6, 1) + rect('#845849', 28, 41, 2, 1) + rect('#845849', 34, 41, 2, 1);
    } else if (expression === 'thoughtful') {
      markup += rect(eyebrow, 24, 26, 6, 1) + rect(eyebrow, 35, 28, 5, 1)
        + rect('#845849', 29, 41, 4, 1) + rect('#845849', 33, 40, 3, 1);
    } else if (expression === 'determined') {
      markup += polygon(eyebrow, [[24, 27], [24, 28], [30, 30], [30, 28]])
        + polygon(eyebrow, [[34, 28], [34, 30], [40, 28], [40, 27]])
        + rect('#845849', 29, 41, 7, 1) + rect('#845849', 35, 40, 1, 1);
    } else {
      markup += rect(eyebrow, 24, 27, 6, 1) + rect(eyebrow, 34, 27, 6, 1)
        + rect('#845849', 29, 41, 6, 1) + rect('#bd895f', 30, 42, 4, 1);
    }
  }
  return markup;
}

function coat(main, light, trim, neck = '#e5ba8d') {
  return polygon(palette.outline, [[22, 44], [42, 44], [53, 51], [57, 64], [7, 64], [11, 51]])
    + polygon(main, [[23, 45], [41, 45], [51, 52], [54, 64], [10, 64], [13, 52]])
    + polygon(light, [[23, 45], [27, 49], [23, 64], [12, 64], [15, 52]])
    + rect(neck, 28, 43, 8, 8)
    + polygon(trim, [[25, 45], [31, 51], [26, 55], [23, 48]])
    + polygon(trim, [[39, 45], [33, 51], [38, 55], [41, 48]])
    + rect(palette.cream, 30, 51, 4, 13) + rect('#bac5ad', 33, 53, 1, 11);
}

function lyra(expression) {
  let markup = polygon('#738b91', [[20, 17], [24, 11], [38, 10], [44, 15], [47, 37], [45, 51], [19, 52], [17, 36]])
    + coat('#467c7a', '#6b9b93', '#b3c9bc')
    + face({ skin: '#e6b998', shadow: '#ba8872', light: '#f0cdb0', eyebrow: '#77858b' }, expression)
    + polygon('#b7c8c9', [[20, 24], [19, 18], [24, 13], [38, 12], [44, 17], [44, 27], [41, 27], [39, 19], [33, 22], [26, 21], [23, 27]])
    + polygon('#dce2d5', [[23, 17], [27, 14], [37, 14], [40, 17], [34, 19], [25, 19]])
    + rect('#93acb2', 20, 25, 3, 12) + rect('#d7dfd5', 21, 25, 1, 10)
    + rect('#93acb2', 41, 23, 3, 17) + rect('#d7dfd5', 41, 24, 1, 13);
  for (let y = 37; y <= 53; y += 4) {
    markup += polygon('#708d97', [[19, y], [24, y], [25, y + 3], [22, y + 5], [18, y + 2]])
      + rect('#c0d3d0', 19, y, 4, 2);
  }
  markup += rect('#cfb678', 20, 55, 4, 2) + rect('#d6ba7a', 43, 36, 2, 3)
    + rect('#bd9c59', 29, 47, 1, 8) + rect('#bd9c59', 34, 47, 1, 8)
    + polygon('#816b46', [[32, 51], [38, 57], [32, 63], [26, 57]])
    + polygon(palette.gold, [[32, 52], [37, 57], [32, 62], [27, 57]])
    + polygon(palette.goldLight, [[32, 54], [34, 57], [32, 60], [30, 57]])
    + rect('#436963', 31, 55, 2, 4);
  return markup;
}

function kai(expression) {
  return polygon('#6b4236', [[21, 14], [26, 10], [39, 11], [45, 19], [45, 35], [19, 34], [18, 20]])
    + coat('#995d50', '#bb7d64', '#5a5b49')
    + face({ skin: '#e7bb8f', shadow: '#bb875c', light: '#f4cda0', eyebrow: '#794839' }, expression)
    + polygon('#9f5d3e', [[18, 25], [17, 18], [22, 18], [21, 12], [28, 15], [31, 8], [35, 14], [42, 11], [41, 17], [47, 18], [43, 22], [44, 28], [40, 27], [37, 20], [32, 22], [29, 19], [24, 23], [22, 29]])
    + polygon('#cb8753', [[23, 17], [28, 17], [30, 14], [33, 18], [39, 15], [37, 20], [32, 19], [29, 20]])
    + rect('#693f33', 20, 28, 2, 6) + rect('#693f33', 42, 28, 2, 6)
    + polygon('#e1a057', [[25, 46], [31, 48], [38, 46], [41, 51], [33, 55], [26, 51]])
    + polygon('#ba7946', [[33, 52], [39, 52], [42, 61], [35, 59]])
    + polygon('#f1c27b', [[27, 47], [31, 49], [37, 47], [37, 49], [32, 52], [28, 50]])
    + rect('#d7c6a1', 17, 56, 6, 2) + rect('#6b4236', 16, 58, 8, 1);
}

function inferra(expression) {
  let markup = coat('#526e4b', '#7d9a61', '#d7d4b6', '#996547')
    + face({ skin: '#a67450', shadow: '#764832', light: '#be8c64', eyebrow: '#3d3029' }, expression);
  const curls = [[22, 17], [24, 12], [29, 10], [35, 10], [40, 12], [43, 17], [20, 23], [42, 23]];
  for (const [x, y] of curls) {
    markup += polygon('#34302b', [[x - 3, y], [x - 3, y - 3], [x, y - 5], [x + 4, y - 4], [x + 5, y], [x + 3, y + 3], [x - 1, y + 3]])
      + rect('#67503a', x - 1, y - 3, 3, 1) + rect('#514235', x - 3, y - 1, 2, 2);
  }
  markup += rect('#34302b', 21, 21, 2, 12) + rect('#34302b', 42, 21, 2, 12);
  // Stepped rims preserve the eyes and eyebrows beneath the round glasses.
  for (const x of [22, 33]) {
    markup += rect('#d6c694', x + 2, 28, 5, 1) + rect('#d6c694', x, 30, 1, 4)
      + rect('#d6c694', x + 8, 30, 1, 4) + rect('#d6c694', x + 2, 35, 5, 1)
      + rect('#d6c694', x + 1, 29, 1, 1) + rect('#d6c694', x + 7, 29, 1, 1)
      + rect('#d6c694', x + 1, 34, 1, 1) + rect('#d6c694', x + 7, 34, 1, 1);
  }
  return markup + rect('#d6c694', 31, 30, 2, 1) + rect('#d6c694', 20, 30, 2, 1) + rect('#d6c694', 42, 30, 2, 1)
    + rect('#304f43', 30, 51, 4, 13) + rect('#c7bf89', 31, 53, 2, 2)
    + polygon(palette.gold, [[43, 51], [46, 54], [43, 57], [40, 54]])
    + rect('#7a8d66', 15, 57, 10, 2) + rect('#304f43', 15, 59, 10, 1);
}

function rowan(expression) {
  return coat('#718268', '#94a07a', '#bbaa79', '#d2a27b')
    + face({ skin: '#d7a880', shadow: '#aa7758', light: '#e9bd91', eyebrow: '#938d79' }, expression)
    + polygon('#969887', [[20, 23], [24, 20], [41, 21], [44, 26], [43, 34], [41, 34], [41, 27], [23, 27], [23, 35], [20, 34]])
    + polygon('#acaf97', [[22, 38], [25, 41], [27, 44], [37, 44], [40, 40], [43, 37], [42, 46], [38, 51], [26, 51], [22, 46]])
    + rect('#d4d3b7', 24, 42, 2, 4) + rect('#d4d3b7', 39, 42, 2, 3)
    + polygon('#d0cfb4', [[26, 38], [31, 38], [32, 40], [29, 40], [26, 41]])
    + polygon('#d0cfb4', [[33, 38], [38, 38], [38, 41], [35, 40], [32, 40]])
    + rect('#787f6d', 31, 46, 2, 3)
    + polygon('#8e734d', [[14, 23], [19, 20], [22, 11], [40, 11], [44, 20], [50, 23], [50, 26], [14, 26]])
    + polygon('#d0b780', [[17, 22], [22, 19], [24, 12], [38, 12], [42, 21], [47, 23], [47, 24], [17, 24]])
    + rect('#ead3a0', 25, 13, 12, 2) + rect('#b18b5a', 22, 18, 19, 3)
    + rect('#8e6847', 22, 19, 19, 1) + rect('#efdaaa', 17, 23, 13, 1)
    + rect('#b1ad85', 25, 53, 3, 11) + rect('#b1ad85', 36, 53, 3, 11)
    + rect('#394f46', 24, 57, 4, 4) + rect('#394f46', 36, 57, 4, 4)
    + rect(palette.gold, 25, 58, 2, 2) + rect(palette.gold, 37, 58, 2, 2);
}

function ranger(expression) {
  return polygon('#3d5140', [[17, 23], [21, 14], [32, 9], [42, 14], [47, 23], [47, 49], [17, 49]])
    + coat('#5c6f47', '#80925c', '#9dac72', '#c69670')
    + polygon('#8b9a61', [[20, 27], [21, 18], [32, 12], [41, 18], [44, 27], [43, 42], [39, 47], [25, 47], [20, 42]])
    + face({ skin: '#d1a17b', shadow: '#a87957', light: '#e1b58c', eyebrow: '#514839' }, expression)
    + polygon('#8a995e', [[18, 30], [18, 22], [22, 16], [31, 11], [40, 14], [45, 22], [46, 35], [42, 35], [41, 23], [35, 19], [29, 22], [24, 24], [23, 35], [20, 35]])
    + polygon('#b0b779', [[22, 21], [27, 16], [32, 14], [37, 17], [32, 17], [28, 20]])
    + polygon('#5a6f46', [[18, 31], [23, 31], [23, 42], [28, 47], [23, 50], [18, 43]])
    + polygon('#526240', [[41, 31], [46, 31], [46, 44], [39, 50], [36, 47], [41, 42]])
    + polygon('#baa175', [[18, 52], [21, 50], [44, 64], [38, 64]])
    + polygon('#75694b', [[18, 54], [20, 52], [42, 64], [39, 64]])
    + polygon(palette.gold, [[39, 53], [42, 52], [44, 55], [42, 58], [39, 57]])
    + rect('#445d45', 41, 54, 1, 2);
}

function observer(expression) {
  return coat('#456d75', '#719897', '#a6bdb5')
    + face({ skin: '#e5ba8d', shadow: '#bd895f', light: '#f0c99c', eyebrow: '#654f3d' }, expression)
    + rect('#654f3d', 20, 23, 4, 11) + rect('#654f3d', 40, 23, 4, 11)
    + polygon('#b68956', [[14, 23], [20, 19], [23, 10], [40, 10], [44, 20], [50, 24], [50, 27], [14, 27]])
    + polygon('#ddbd7b', [[17, 23], [23, 20], [25, 11], [38, 11], [42, 22], [47, 24], [47, 25], [17, 25]])
    + rect('#ecd297', 26, 12, 10, 2) + rect('#94734e', 23, 19, 19, 3)
    + rect('#f0d89e', 17, 24, 15, 1)
    + polygon('#ab8158', [[17, 49], [21, 48], [31, 64], [26, 64]])
    + rect('#d6b877', 28, 48, 9, 3) + rect('#a28857', 29, 51, 7, 1)
    + rect('#dceac6', 42, 54, 7, 9) + rect('#779fa1', 43, 55, 5, 6)
    + rect('#b8d1c2', 44, 56, 2, 2);
}

function narrator(expression) {
  let markup = polygon('#719b91', [[32, 8], [54, 31], [32, 55], [10, 31]], .12)
    + polygon('#8d784d', [[20, 17], [43, 17], [50, 24], [50, 49], [43, 56], [20, 56], [14, 49], [14, 24]])
    + polygon('#ddc084', [[21, 18], [42, 18], [48, 25], [48, 48], [42, 54], [21, 54], [16, 48], [16, 25]])
    + polygon('#f0dba4', [[21, 19], [42, 19], [45, 23], [19, 23], [17, 26], [17, 45], [16, 45], [16, 25]])
    + polygon('#a38753', [[42, 24], [48, 25], [48, 48], [42, 54], [36, 54], [42, 48]])
    + rect('#3b5b55', 20, 24, 24, 22) + rect('#182e2d', 22, 26, 20, 18)
    + rect('#497970', 23, 27, 18, 16) + rect('#68978c', 23, 27, 18, 1)
    + rect('#365f58', 23, 42, 18, 1);
  const glow = '#daedbd';
  if (expression === 'happy') {
    markup += polygon(glow, [[25, 33], [27, 31], [29, 33], [29, 34], [27, 33], [25, 34]])
      + polygon(glow, [[35, 33], [37, 31], [39, 33], [39, 34], [37, 33], [35, 34]])
      + rect(glow, 28, 37, 1, 2) + rect(glow, 29, 39, 6, 1) + rect(glow, 35, 37, 1, 2);
  } else if (expression === 'thoughtful') {
    markup += rect(glow, 25, 29, 4, 1) + rect(glow, 36, 30, 3, 1)
      + rect(glow, 28, 32, 2, 3) + rect(glow, 38, 32, 2, 3)
      + rect(glow, 29, 39, 4, 1) + rect(glow, 33, 38, 3, 1);
  } else if (expression === 'concerned') {
    markup += polygon(glow, [[25, 31], [29, 29], [29, 30], [25, 32]])
      + polygon(glow, [[35, 29], [39, 31], [39, 32], [35, 30]])
      + rect(glow, 27, 33, 2, 3) + rect(glow, 36, 33, 2, 3)
      + rect(glow, 29, 38, 6, 1) + rect(glow, 28, 39, 1, 1) + rect(glow, 35, 39, 1, 1);
  } else {
    markup += rect(glow, 25, 30, 4, 1) + rect(glow, 35, 30, 4, 1)
      + rect(glow, 27, 32, 2, 3) + rect(glow, 36, 32, 2, 3) + rect(glow, 29, 38, 6, 1);
  }
  return markup + rect('#e9dda5', 27, 48, 10, 2) + rect('#9bb8a0', 19, 49, 3, 2)
    + rect('#54796e', 42, 49, 3, 2) + rect('#d6bd78', 28, 55, 8, 3)
    + rect('#4b6659', 24, 60, 16, 2)
    + polygon('#d6ba7a', [[32, 7], [35, 10], [32, 13], [29, 10]])
    + rect('#f4e7b3', 31, 9, 2, 2)
    + rect('#a2c8af', 10, 20, 2, 2) + rect('#a2c8af', 52, 40, 2, 2);
}

// Village portraits share the same hand-drawn pixel grid, with their own clothes,
// hair, skin palettes, and tools so each neighbor remains recognizable.
function villager(expression, {skin, shadow, light, hair, clothing, trim, hat, detail}) {
  let markup = coat(clothing, trim, '#ded4aa', skin)
    + face({skin, shadow, light, eyebrow:hair}, expression)
    + polygon(hair, [[19, 27], [19, 19], [24, 12], [39, 12], [44, 19], [45, 30], [41, 29], [39, 21], [30, 23], [24, 21], [22, 30]])
    + rect(hair, 20, 29, 2, 8) + rect(hair, 42, 29, 2, 6);
  if (hat === 'straw') markup += polygon('#dec18b', [[12, 22], [21, 19], [24, 10], [39, 10], [43, 19], [52, 22], [52, 25], [12, 25]]) + rect('#a5794b', 23, 17, 19, 3);
  if (hat === 'cap') markup += polygon(clothing, [[19, 21], [21, 14], [28, 10], [39, 13], [43, 21]]) + rect(trim, 18, 20, 29, 4);
  if (hat === 'guard') markup += polygon('#8d9b9c', [[19, 24], [21, 14], [31, 9], [42, 15], [45, 24], [41, 25], [38, 20], [25, 20], [22, 25]]) + rect('#d8c9a1', 30, 11, 3, 10);
  if (detail === 'apron') markup += polygon('#e2d2a5', [[25, 49], [38, 49], [42, 64], [21, 64]]) + rect('#9d7d60', 28, 56, 8, 4);
  if (detail === 'journal') markup += rect('#4e657c', 41, 50, 11, 14) + rect('#eee0b9', 43, 52, 7, 10) + rect('#a2afba', 43, 54, 5, 1) + rect('#a2afba', 43, 57, 5, 1);
  if (detail === 'fishing') markup += polygon('#9a774f', [[11, 30], [13, 29], [23, 64], [20, 64]]) + rect('#d3d5c0', 11, 31, 1, 28);
  if (detail === 'crystal') markup += polygon('#bce2d6', [[43, 51], [48, 56], [43, 63], [38, 56]]) + rect('#eff1ca', 42, 53, 2, 6);
  if (detail === 'badge') markup += polygon('#d9bf7d', [[43, 50], [47, 53], [46, 58], [42, 60], [39, 55]]) + rect('#f1dfaa', 42, 53, 2, 3);
  if (detail === 'scarf') markup += polygon('#bf6456', [[23, 45], [32, 49], [41, 45], [40, 50], [33, 54], [25, 51]]) + rect('#e4a16f', 33, 52, 6, 12);
  return markup;
}

const artists = { lyra, kai, inferra, rowan, ranger, observer, narrator,
  mara: expression => villager(expression, {skin:'#b77e55', shadow:'#85563d', light:'#d49b6e', hair:'#443a2d', clothing:'#80784c', trim:'#a9a06c', hat:'straw', detail:'apron'}),
  orin: expression => villager(expression, {skin:'#e0b48f', shadow:'#b0866b', light:'#f1cfaa', hair:'#a8a9a1', clothing:'#576c86', trim:'#8299b0', detail:'journal'}),
  nell: expression => villager(expression, {skin:'#cf956d', shadow:'#a66b50', light:'#e7af84', hair:'#6d403b', clothing:'#97616d', trim:'#be8e94', detail:'apron'}),
  bram: expression => villager(expression, {skin:'#e0ad81', shadow:'#ae7b55', light:'#f1c79c', hair:'#63564b', clothing:'#4e7a83', trim:'#83a8ab', hat:'cap', detail:'fishing'}),
  elin: expression => villager(expression, {skin:'#9e704f', shadow:'#754b37', light:'#bc9069', hair:'#3e342e', clothing:'#648766', trim:'#94b48a', detail:'crystal'}),
  tomas: expression => villager(expression, {skin:'#d4a782', shadow:'#a87a5c', light:'#eec7a0', hair:'#574236', clothing:'#6b6484', trim:'#9893af', hat:'guard', detail:'badge'}),
  child: expression => villager(expression, {skin:'#e6b994', shadow:'#bc8a68', light:'#f4cfae', hair:'#a86c40', clothing:'#678e8c', trim:'#9dc0ae', detail:'scarf'}),
};

export function portraitMarkup(speakerId, expression = 'neutral', playerName = 'Observer') {
  const activeSpeaker = resolveSpeaker(speakerId, playerName);
  const activeExpression = activeSpeaker.expressions.includes(expression) ? expression : 'neutral';
  const label = escapeXML(`${activeSpeaker.name}, ${activeExpression} expression`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${label}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><title>${label}</title><g transform="scale(2)">${background(activeSpeaker.accent)}${artists[activeSpeaker.id](activeExpression)}</g></svg>`;
}
