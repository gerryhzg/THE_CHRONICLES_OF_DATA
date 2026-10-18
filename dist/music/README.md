# Music files

All seven MP3s in this folder are connected to their matching scenes. Each track loops through the existing volume, mute, crossfade, and narration controls.

Connected tracks:

- `village.mp3` — Lanterns of Harvest
- `forest.mp3` — Paths Between Leaves: forest exploration
- `night.mp3` — Moonlit Field Notes: night exploration
- `battle.mp3` — Partners in Motion: battles
- `mystery.mp3` — The Missing Observation: investigation and story scenes
- `celebration.mp3` — A Finding to Share: victories and discoveries
- `rest.mp3` — Shelter and Embers: sanctuary and camp

To replace a track, keep its filename above. Files are loaded and decoded on first use, then cached for return visits during the session. If an MP3 cannot be loaded or decoded, that scene's generated theme is used as a backup. Scene titles and file paths are defined in `dist/music-tracks.js`.
