# Contributing to CityZen

Thank you for your interest in improving CityZen. This document describes the
project team, the branching and commit conventions used in this repository,
and the checklist a change should satisfy before it is submitted for review.

## Project Team

CityZen was designed and built by the following team:

| Name | Roll Number |
|---|---|
| Keshav S | CB.SC.U4CSE23222 |
| Vimal HariHar S K | CB.SC.U4CSE23254 |
| Arun N | CB.SC.U4CSE23406 |
| Kokul M | CB.SC.U4CSE23462 |
| Ravula Akshith | CB.SC.U4CSE23648 |

## Ways to Contribute

- **Bug reports** — open a GitHub issue with reproduction steps, the expected
  versus actual behavior, and relevant logs or screenshots.
- **Feature requests** — open an issue describing the problem being solved,
  not just the proposed solution, so alternatives can be discussed.
- **Code contributions** — bug fixes, performance improvements, new features,
  or test coverage, submitted as a pull request against `main`.
- **Documentation** — corrections or additions to the README, `docs/`, or
  inline code comments.

## Development Workflow

1. Fork the repository and clone your fork locally.
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/short-description
   ```
3. Make your changes, following the code style guidelines below.
4. Run the relevant test suite(s) before committing (see
   [README — Testing](README.md#testing)).
5. Commit using a clear, imperative message:
   ```bash
   git commit -m "fix: correct AHP weight normalization in priority engine"
   ```
6. Push your branch and open a pull request against `main`, describing:
   - What the change does and why.
   - How it was tested.
   - Any follow-up work that is intentionally out of scope.

## Code Style

### Backend (Node.js / Express)
- Use `async/await` over raw promise chains.
- Keep route handlers thin; put business logic in `services/`.
- Centralize any new tunable weight, threshold, or multiplier in
  `services/priorityConfig.js` rather than hardcoding it at the call site —
  see the file's own header comment for the reasoning.
- Never commit real API keys, tokens, or database credentials. Use
  `backend/.env` (already git-ignored) for local secrets, and reference
  `docs/ENVIRONMENT.md` for the full variable list.

### Frontend (React / Vite and React Native / Expo)
- Use functional components with hooks.
- Keep page-level components in `pages/` (web) or `screens/` (mobile) thin;
  move reusable UI into `components/`.
- Route all backend calls through the centralized API client
  (`src/services/api.js` on web) rather than calling `fetch`/`axios` directly
  from components.
- Add new UI strings to every locale under `src/i18n/locales/` (`en`, `hi`,
  `ta`, `te`, `kn`, `ml`), not just English.

### General
- Prefer small, focused pull requests over large, multi-purpose ones.
- Match existing naming conventions and file placement within a module
  before introducing a new pattern.
- Add or update tests for any behavior change.

## Pull Request Checklist

Before requesting review, confirm that:

- [ ] The backend starts cleanly (`npm run dev:backend`) with no new console
      errors.
- [ ] The affected frontend app (`npm run dev:web` or `npm run start:mobile`)
      renders the changed screen without regressions.
- [ ] Existing automated tests pass, and new tests were added for new
      behavior.
- [ ] No secrets, API keys, or `.env` files are included in the diff.
- [ ] Documentation (`README.md`, `docs/`) is updated if the change affects
      setup, environment variables, or the API surface.

## Reporting Security Issues

Do not open a public issue for a suspected security vulnerability (for
example, exposed credentials or an authentication bypass). Instead, contact a
maintainer directly so the issue can be addressed before it is publicly
disclosed.
