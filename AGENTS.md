# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React + TypeScript source. Entry point is `src/main.tsx`; the main UI and game logic live in `src/App.tsx` with styles in `src/App.css` and `src/index.css`.
- `src/assets/` is for bundled assets imported in code.
- `public/` contains static files served as-is.
- `dist/` is the production build output (generated).
- `index.html`, `vite.config.ts`, and `tsconfig*.json` define the Vite app shell and TypeScript configuration.

## Build, Test, and Development Commands
- `npm run dev` — start the Vite dev server with HMR.
- `npm run build` — type-check (`tsc -b`) and produce a production bundle in `dist/`.
- `npm run preview` — serve the built app from `dist/` for a local smoke test.
- `npm run lint` — run ESLint across the codebase.

## Coding Style & Naming Conventions
- Indentation is 2 spaces; prefer single quotes in TypeScript/TSX to match existing files.
- React components use PascalCase (e.g., `App`), hooks use the `use*` prefix, and TypeScript types use `PascalCase`.
- Keep CSS co-located (`App.css`, `index.css`) and name classes descriptively.
- Linting is enforced via `eslint.config.js` (TypeScript + React Hooks). Run `npm run lint` before PRs.

## Testing Guidelines
- No automated test framework is configured yet, and there are no coverage requirements.
- For changes, do a manual smoke test with `npm run dev` or `npm run preview` and document what you verified.
- If you add tests, keep names consistent (e.g., `*.test.tsx`) and update this guide.

## Commit & Pull Request Guidelines
- Current history uses Conventional Commits (e.g., `feat: init`). Follow the `type: summary` format (`feat`, `fix`, `chore`, etc.).
- PRs should include: a short summary, testing steps, and screenshots or a screen recording for UI changes.

## Configuration & Security Notes
- No environment variables are required today. If you introduce `.env` files, avoid committing secrets and document new keys here.
