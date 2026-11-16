[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/taigedi123/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/taigedi123/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Ember Drift

An original arena-survival game built for the [make.fun best-game-01 bounty](https://make.fun/bounty/best-game-01). Pilot a lone ember-sprite through a dark void: gather falling embers to build your combo, dodge the void wisps that hunt you, and survive 10 waves to face **The Hollow Star** — a boss with radial bullet patterns and a health bar. Beat it and the void is lit again.

Play it: serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) — no build step, no network, no libraries.

## How to play

- **Goal:** survive all 10 waves and defeat the boss on wave 10. Score by collecting embers; a life lost resets your combo.
- **Embers:** falling amber sparks, worth 10 points each. Chain pickups within 3 seconds to raise the combo multiplier, up to x8.
- **Wisps:** the void's hunters. Drifters wander toward you, chasers home in, splitters break into two fast minis when shattered, and orbiters circle in to close the distance. New kinds appear as the waves climb.
- **Pulse blast (Space / right-click):** shatters nearby wisps and boss bullets, and hurts the boss — but it has a 2.5 s cooldown, shown on the HUD.
- **Dash (Shift):** a quick burst with brief invulnerability.
- **Lives:** 3. A hit costs one life, resets the combo, and grants 2 s of invulnerability.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Space / Right-click | Pulse blast |
| Shift | Dash |
| Enter / Click | Start / restart |
| P / Esc | Pause |
| M | Mute |

## Waves & enemies

Each wave lasts 18 seconds with a short calm between waves; clearing a wave pays 100 points × the wave number. The void escalates:

- **Waves 1–2:** drifters wander in; chasers start homing from wave 2.
- **Waves 4–5:** splitters arrive — shatter one with a pulse and it breaks into two fast minis.
- **Waves 6–9:** orbiters circle in while everything gets faster and more numerous.
- **Wave 10 — The Hollow Star:** a boss with 120 HP that keeps its distance and cycles three attacks: a 14-bullet radial burst, a rotating spiral stream, and summoning drifters. Only pulse blasts hurt it (12 damage each), so you have to close in, blast, and get out before the next burst.

A hit costs a life and resets the combo, so the scoring game is about chaining ember pickups (up to a x8 multiplier) without ever getting touched.

## Run it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

No build step, no dependencies, no network. Open `game/index.html` from any static server and it plays.

Repository: https://github.com/taigedi123/best-game-01

## Tech notes

- Plain Canvas 2D, vanilla ES modules, zero dependencies, zero network requests — every asset is code.
- Fixed 1/60 s simulation step with a requestAnimationFrame loop; the 1280×720 logical field scales to any window.
- Sound is 100% synthesised WebAudio (pickup blips that climb with your combo, pulse boom, hit thud, boss roar, ambient pad). No audio files.
- Deterministic screenshot scenes via URL query: `?shot=start|play|boss|win&seed=1` — each stages the real simulation with a seeded autopilot, so the same seed always gives the same frame.
- Source is split by job: `config.js` (tuning), `input.js`, `audio.js`, `entities.js` (the world and its rules), `waves.js` (wave design), `render.js` (drawing), `ui.js` (HUD and menus), `shots.js` (screenshot scenes), `main.js` (bootstrap, loop, screens).
- `main.ts` (Node 22 stdlib only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via the vendored `vendor/makefun-game.ts`.

## Screenshots

1. Title screen · 2. Mid-wave play with HUD · 3. Boss fight with HP bar · 4. Victory screen.

---

Built for make.fun — [make.fun/?ref=sd5yrph4&utm_source=github&utm_medium=readme&utm_campaign=best-game-01](https://make.fun/?ref=sd5yrph4&utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
