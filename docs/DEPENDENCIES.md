# Dependency update — 2026-11-02

Both Docker build and runtime stages now use `node:24-alpine`. Build with
`--pull` to fetch the newest Node 24.x image for your platform. The package engine
and `.nvmrc` select Node 24, and the server bundle targets Node 24.

All direct npm packages were checked against the stable `latest` registry tag
and upgraded, including React 19.3.1, React Router 7.18.5, TanStack Query 5.105.1,
Vite 8.3.5, React Vite plugin 6.1.2, PWA plugin 2.0.0, ESLint 10.14.0 and
Vitest 5.0.5. The lockfile was regenerated through a clean npm install, without
`--force` or `--legacy-peer-deps`.

Two intentional compatibility constraints remain:

- `@types/node` uses the newest 24.x (24.19.2), matching the Node runtime,
  rather than the registry's Node 26 declarations.
- TypeScript uses 6.0.3. The latest stable typescript-eslint 8.72.1 declares
  TypeScript `>=4.8.4 <6.1.0`; registry-latest TypeScript 7.0.2 fails npm's peer
  dependency resolution. Upgrade to 7 once the lint tooling supports it.

`npm outdated` therefore lists only these two intentional major-version gaps.
Transitive packages follow the compatible ranges declared by their parents;
we do not force unrelated major versions through unsafe overrides.

Verification: clean npm install; ESLint; all 72 tests; frontend and server builds;
server smoke test covering watch mutations, same-origin protection, persistence
across restart, and last-good snapshot fallback during an upstream outage.
Local verification runtime: Node 24.19.0.
