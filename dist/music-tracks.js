// Uploaded MP3s provide each scene's soundtrack. Original instrumental
// miniatures remain as deterministic, locally rendered backup loops.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const MUSIC_TRACKS = freeze({
  village: {
    id: 'village', title: 'Lanterns of Harvest', src: './music/village.mp3', bpm: 84, bars: 8, percussion: 'brush', seed: 113,
    chords: [[50,54,57,61],[55,59,62,66],[52,55,59,62],[57,61,64,66],[54,57,61,64],[47,50,54,57],[55,59,62,66],[57,61,64,67]],
    melody: [
      [[0,74,1],[1.5,78,.7],[2.5,81,1]], [[.5,79,.8],[1.5,78,.8],[3,74,.8]],
      [[0,76,1],[1.5,79,.8],[3,78,.7]], [[0,76,1.5],[2,73,.7],[3,69,.7]],
      [[0,73,1],[1.5,76,.8],[2.5,78,1]], [[.5,74,1],[2,73,.8],[3,71,.7]],
      [[0,74,1],[1.5,79,.8],[3,78,.7]], [[0,76,1],[1.5,73,.8],[3,69,.8]],
    ],
  },
  forest: {
    id: 'forest', title: 'Paths Between Leaves', src: './music/forest.mp3', bpm: 88, bars: 8, percussion: 'brush', seed: 229,
    chords: [[55,59,62,66],[52,55,59,62],[48,52,55,59],[50,54,57,60],[47,50,54,57],[48,52,55,59],[57,60,64,67],[50,54,57,60]],
    melody: [
      [[.5,74,.8],[1.5,79,1],[3,78,.7]], [[0,76,1],[2,74,.8],[3,71,.7]],
      [[.5,72,.8],[1.5,76,.8],[3,79,.7]], [[0,78,1],[1.5,76,.8],[3,74,.8]],
      [[0,71,.8],[1,74,.8],[2.5,78,1]], [[.5,76,1],[2,72,1.1]],
      [[0,69,.8],[1.5,72,.8],[2.5,76,1]], [[0,74,1.3],[2,72,.8],[3,69,.8]],
    ],
  },
  night: {
    id: 'night', title: 'Moonlit Field Notes', src: './music/night.mp3', bpm: 76, bars: 8, percussion: 'none', seed: 337,
    chords: [[52,55,59,62],[48,52,55,59],[55,59,62,66],[50,54,57,62],[52,55,59,62],[57,60,64,67],[48,52,55,59],[47,54,57,62]],
    melody: [
      [[.5,71,1.5],[3,74,.8]], [[1,72,1.4]], [[.5,74,1.1],[2.5,78,1]], [[1,76,1],[3,74,.8]],
      [[0,71,1.6],[2.5,67,1]], [[1,69,1.1],[3,72,.8]], [[.5,71,1.2],[2.5,67,1]], [[1,66,1.3],[3,69,.8]],
    ],
  },
  battle: {
    id: 'battle', title: 'Partners in Motion', src: './music/battle.mp3', bpm: 120, bars: 8, percussion: 'drums', seed: 449,
    chords: [[50,53,57],[46,50,53],[48,52,55],[45,49,52],[50,53,57],[46,50,53],[48,52,55],[45,49,52,55]],
    melody: [
      [[0,74,.4],[.75,77,.4],[1.5,81,.7],[2.5,77,.4],[3.25,76,.5]],
      [[0,74,.6],[1,77,.4],[1.75,79,.5],[2.75,77,.6]],
      [[0,76,.4],[.75,79,.4],[1.5,84,.7],[2.5,79,.4],[3.25,77,.5]],
      [[0,76,.6],[1,73,.4],[1.75,69,.6],[3,73,.6]],
      [[0,74,.4],[.75,77,.4],[1.5,81,.7],[2.5,84,.4],[3.25,81,.5]],
      [[0,82,.6],[1,81,.4],[1.75,77,.5],[2.75,74,.6]],
      [[0,79,.4],[.75,76,.4],[1.5,72,.7],[2.5,76,.4],[3.25,79,.5]],
      [[0,81,.6],[1,79,.4],[1.75,76,.6],[3,73,.6]],
    ],
  },
  mystery: {
    id: 'mystery', title: 'The Missing Observation', src: './music/mystery.mp3', bpm: 80, bars: 8, percussion: 'none', seed: 557,
    chords: [[45,52,57,60],[53,57,60,64],[50,53,57,60],[52,56,59,62],[45,52,57,60],[48,52,55,59],[50,53,57,60],[52,56,59,62]],
    melody: [
      [[.5,69,1],[2.5,72,.8]], [[1.5,76,1.2]], [[.5,74,1.2],[3,72,.7]], [[1,71,1],[3,68,.7]],
      [[.5,69,1],[2.5,76,.8]], [[1.5,71,1.2]], [[.5,69,1.2],[3,65,.7]], [[1,68,1],[3,71,.7]],
    ],
  },
  celebration: {
    id: 'celebration', title: 'A Finding to Share', src: './music/celebration.mp3', bpm: 104, bars: 8, percussion: 'brush', seed: 661,
    chords: [[48,52,55,59],[53,57,60,64],[50,53,57,60],[55,59,62,65],[52,55,59,62],[53,57,60,64],[55,59,62,65],[48,52,55,60]],
    melody: [
      [[0,72,.6],[1,76,.6],[2,79,1.3]], [[0,81,1],[1.5,79,.7],[2.5,77,1]],
      [[0,77,.6],[1,74,.6],[2,76,.6],[3,77,.6]], [[0,79,1.2],[2,74,1.2]],
      [[0,76,.6],[1,79,.6],[2,83,1.3]], [[0,84,1],[1.5,81,.7],[2.5,79,1]],
      [[0,77,.6],[1,76,.6],[2,74,1.2]], [[0,76,1],[1.5,72,1.8]],
    ],
  },
  rest: {
    id: 'rest', title: 'Shelter and Embers', src: './music/rest.mp3', bpm: 78, bars: 8, percussion: 'none', seed: 773,
    chords: [[46,50,53,57],[43,46,50,53],[51,55,58,62],[53,57,60,65],[46,50,53,57],[48,51,55,58],[51,55,58,62],[53,57,60,63]],
    melody: [
      [[.5,65,1.2],[2.5,69,1]], [[1,67,1.5]], [[.5,67,1.2],[2.5,70,1]], [[1,69,1],[3,65,.8]],
      [[.5,62,1.3],[2.5,65,1]], [[1,63,1.4]], [[.5,67,1.1],[2.5,65,1]], [[1,63,1],[3,60,.8]],
    ],
  },
});

const TAU = Math.PI * 2;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function renderMusicSamples(trackId, sampleRate = 22050) {
  const track = MUSIC_TRACKS[trackId];
  if (!track || !Object.hasOwn(MUSIC_TRACKS, trackId)) throw new RangeError(`Unknown music track: ${trackId}`);
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new RangeError('Music sample rate must be an integer between 8000 and 96000.');
  const frames = Math.round(track.bars * 4 * 60 / track.bpm * sampleRate);
  const samples = new Float32Array(frames);
  const framesPerBeat = frames / (track.bars * 4);
  const secondsPerBeat = framesPerBeat / sampleRate;

  function tone(beat, midi, beats, amplitude, voice) {
    const hold = beats * secondsPerBeat;
    const release = voice === 'pad' ? .6 : voice === 'bass' ? .12 : .15;
    const attack = voice === 'pad' ? .32 : voice === 'bass' ? .018 : .009;
    const length = Math.ceil((hold + release) * sampleRate);
    const step = TAU * frequency(midi) / sampleRate;
    const sinStep = Math.sin(step), cosStep = Math.cos(step);
    const detunedStep = step * 1.0013;
    const sinDetunedStep = Math.sin(detunedStep), cosDetunedStep = Math.cos(detunedStep);
    let sin = 0, cos = 1, detunedSin = 0, detunedCos = 1;
    let index = Math.round(beat * framesPerBeat) % frames;
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      const rise = Math.min(1, time / attack);
      const fall = Math.min(1, Math.max(0, (hold + release - time) / release));
      let envelope = rise * rise * (3 - 2 * rise) * fall * fall;
      const third = sin * (3 - 4 * sin * sin);
      let wave;
      if (voice === 'pad') {
        wave = (sin + detunedSin) * .48 + third * .035;
        const nextDetunedSin = detunedSin * cosDetunedStep + detunedCos * sinDetunedStep;
        detunedCos = detunedCos * cosDetunedStep - detunedSin * sinDetunedStep;
        detunedSin = nextDetunedSin;
      } else if (voice === 'bass') {
        wave = sin + third * .10;
        envelope *= Math.exp(-1.1 * time / Math.max(.1, hold));
      } else {
        wave = sin + .17 * (2 * sin * cos) + .055 * third;
        envelope *= Math.exp(-3 * time / Math.max(.1, hold));
      }
      samples[index] += wave * envelope * amplitude;
      const nextSin = sin * cosStep + cos * sinStep;
      cos = cos * cosStep - sin * sinStep;
      sin = nextSin;
      if (++index === frames) index = 0; // Let release tails continue across the loop.
    }
  }

  function percussion(beat, kind, amplitude, seed) {
    const duration = kind === 'kick' ? .34 : kind === 'snare' ? .17 : .085;
    const length = Math.ceil(duration * sampleRate);
    let index = Math.round(beat * framesPerBeat) % frames;
    let random = seed >>> 0, smoothNoise = 0;
    for (let i = 0; i < length; i++) {
      const time = i / sampleRate;
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const noise = random / 2147483648 - 1;
      smoothNoise += .28 * (noise - smoothNoise);
      const attack = Math.min(1, time / .004);
      const release = Math.min(1, (duration - time) / .025);
      let wave;
      if (kind === 'kick') {
        const phase = TAU * (46 * time + 86 * (1 - Math.exp(-32 * time)) / 32);
        wave = Math.sin(phase) * Math.exp(-13 * time);
      } else if (kind === 'snare') {
        wave = (smoothNoise * .8 + Math.sin(TAU * 174 * time) * .2) * Math.exp(-24 * time);
      } else {
        wave = smoothNoise * Math.exp(-48 * time);
      }
      samples[index] += wave * attack * release * amplitude;
      if (++index === frames) index = 0;
    }
  }

  for (let bar = 0; bar < track.bars; bar++) {
    const beat = bar * 4;
    const chord = track.chords[bar];
    chord.forEach((midi, voice) => tone(beat, midi, 4, .027 / (1 + voice * .12), 'pad'));
    const bass = chord[0] - 12;
    if (trackId === 'battle') {
      for (const [offset, interval] of [[0,0],[1.5,0],[2,7],[3.5,0]]) tone(beat + offset, bass + interval, .55, .105, 'bass');
    } else {
      tone(beat, bass, track.percussion === 'none' ? 3.5 : 1.6, .09, 'bass');
      if (track.percussion !== 'none') tone(beat + 2, bass + 7, 1.5, .067, 'bass');
    }
    for (const [offset, midi, length] of track.melody[bar]) tone(beat + offset, midi, length, trackId === 'battle' ? .135 : .12, 'pluck');
    if (track.percussion === 'drums') {
      for (const offset of [0,2]) percussion(beat + offset, 'kick', .15, track.seed + bar * 19);
      for (const offset of [1,3]) percussion(beat + offset, 'snare', .067, track.seed + bar * 31 + offset);
      for (let step = 0; step < 8; step++) percussion(beat + step / 2, 'hat', step % 2 ? .035 : .024, track.seed + bar * 41 + step);
    } else if (track.percussion === 'brush') {
      for (const offset of [1.5,3.5]) percussion(beat + offset, 'hat', .035, track.seed + bar * 53 + offset * 2);
      percussion(beat, 'kick', .032, track.seed + bar);
    }
  }

  // Remove the tiny accumulated DC offset, and normalize without hard clipping.
  let mean = 0;
  for (const value of samples) mean += value;
  mean /= frames;
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    samples[i] -= mean;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const targetPeak = trackId === 'battle' ? .77 : trackId === 'celebration' ? .73 : .66;
  const scale = peak > 0 ? targetPeak / peak : 1;
  for (let i = 0; i < frames; i++) samples[i] *= scale;
  return { samples, sampleRate, duration: frames / sampleRate };
}

export function renderMusicTrack(context, trackId, { sampleRate = 22050 } = {}) {
  const { samples } = renderMusicSamples(trackId, sampleRate);
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  return buffer;
}
