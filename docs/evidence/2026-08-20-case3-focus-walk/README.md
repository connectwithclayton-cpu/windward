# Case 3 focus walk and honest limits evidence

**Date:** 2026-08-20

**Surface:** local static build served from `http://127.0.0.1:4173/`

## Observations

- The deployed site at `https://connectwithclayton.github.io/windward/` was
  played through before implementation. All three cases reached their causal
  debrief and engineering trace.
- In standard motion, Case 3 automatically focused the four assignment rows in
  recorded order. Assignment 2 remained focused longer than the other rows and
  displayed `Current assignment` alongside the static Elena-to-Marcus handoff.
  Activating **Replay assignment focus** replayed the same sequence without
  moving keyboard focus or hiding any row.
- At a 320 by 812 emulated viewport, Case 3 reported `clientWidth: 320`,
  `scrollWidth: 320`, and two children under the persistent signals region.
- In a separately launched browser with
  `--force-prefers-reduced-motion`, the page reported
  `matchMedia('(prefers-reduced-motion: reduce)').matches === true`. All four
  walk rows reported `animation-name: none`; the replay-only control was not
  displayed; and all four static carry-forward statements remained present,
  including `winner changes Elena Park → Marcus Reed`. The same viewport
  reported zero horizontal overflow and exactly two persistent signals.
- Keyboard-only runs completed Horizon, Risk Appetite, and Breadth through
  their debriefs and engineering traces. Each phase change retained visible
  programmatic focus on its heading or decision receipt. Horizon and Risk
  Appetite also reported zero horizontal overflow at 390 CSS pixels; Breadth
  reported zero horizontal overflow at 320 CSS pixels.
- Fresh test-phase verification from the current build confirmed the required
  direct TypeScript build and type-test commands, then independently launched
  Chromium with `--force-prefers-reduced-motion`. At 320 CSS pixels,
  `matchMedia('(prefers-reduced-motion: reduce)').matches` was `true`, the
  four assignment rows remained visible with zero animations, the Elena Park
  to Marcus Reed turn remained legible, the replay control was hidden, the
  persistent signal region had exactly two children, and `clientWidth` and
  `scrollWidth` were both 320. Standard motion reported four rows with
  assignment-two timing of `1.35s` delay and `2.4s` duration; replay retained
  focus on **Replay assignment focus**. The fresh debrief showed the scope
  boundary panel and retained focus on its heading.
- Direct local validation passed with 38 behavioral tests:
  `node ./node_modules/typescript/bin/tsc -p tsconfig.json`,
  `node ./node_modules/typescript/bin/tsc -p tsconfig.type-tests.json`, and
  `node --test test/*.test.mjs`.

## Captures

- `assignment-2-focus.png` — standard-motion desktop capture during the longer
  assignment-two focus.
- `focus-walk-320.png` — standard-motion focus walk at 320 CSS pixels.
- `reduced-motion-320.png` — fully static reduced-motion presentation at 320
  CSS pixels.
- `honest-limits-320.png` — post-run scope-boundary panel at 320 CSS pixels.
- `fresh-focus-walk-320.png`, `fresh-reduced-motion-320.png`, and
  `fresh-honest-limits-320.png` — screenshots captured from the fresh test-phase
  build and copied from `/tmp` after existence checks.
