# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Treat `docs/design/2026-08-18-windward-design.md` as the product contract,
  especially its dispatcher/replay, deliberate-omission, determinism, scope,
  and provenance sections.
- The package entry point is `src/index.ts`; `npm run check` is the authoritative
  local typecheck, build, and behavioral-test command.
- The static console enters through `index.html` and `src/console.ts`; shared
  engine-to-interface binding lives under `src/console/` and must not duplicate
  ranking or eligibility rules.
- Keep coverage descriptive and separate from ranking. The dispatcher's missing
  lookahead and reserve heuristic are intentional product behavior, and a job's
  explicit promised window is replay/outcome data rather than a scoring factor.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
