# Contributing to Prompsit CLI

Thank you for your interest in contributing! This guide covers the development workflow and conventions for this project.

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- npm (bundled with Node.js)

## Setup

```bash
git clone https://github.com/Prompsit/prompsit-cli.git
cd prompsit-cli
npm install
npm run dev -- --help   # Verify setup
```

## Development

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run CLI in development mode (tsx) |
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type-check without emitting |
| `npm run test` | Run unit tests (Vitest) |
| `npm run lint:all` | Full lint suite (tsc + ESLint + Prettier + knip + depcruise) |

## Code Style

- **TypeScript strict mode** — `strict: true` in tsconfig.json, zero `tsc --noEmit` errors
- **ESM-only** — `"type": "module"` in package.json
- **ESLint + Prettier** — run `npm run lint:fix` and `npm run format` before committing
- **No unused exports** — enforced by [knip](https://knip.dev/)
- **Layer boundaries** — enforced by [dependency-cruiser](https://github.com/sverweij/dependency-cruiser)

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes following the code style above
3. Ensure all checks pass: `npm run lint:all && npm run test`
4. Submit a pull request with a clear description of what and why

## Reporting Issues

Use [GitHub Issues](https://github.com/Prompsit/prompsit-cli/issues). Include:

- CLI version (`prompsit --version`)
- Node.js version (`node -v`)
- OS and shell
- Steps to reproduce

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
