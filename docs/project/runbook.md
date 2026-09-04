# Runbook

`package.json#scripts`, `prompsit --help`, configuration schemas, and CI files are authoritative for machine-verifiable details.

## Install and run

Use a Node.js version allowed by `package.json#engines`.

```bash
npm install -g prompsit-cli
prompsit --version
prompsit login
prompsit health
```

For development:

```bash
npm install
npm run dev -- --help
npm run dev
```

On Linux, use a Node version manager or a user-owned npm prefix for global installs. Do not use `sudo npm install -g`.

## Configuration

The data directory defaults to `~/.prompsit`; `PROMPSIT_DATA_DIR` overrides it for isolated automation. Effective settings use environment variables over `config.toml` over schema defaults.

```bash
prompsit config show
prompsit config path
prompsit config api-url test
prompsit config api-url local
prompsit config language es
prompsit config reset
```

Generic keys can be read or written with `prompsit config <key> [value]`. Discover the current key set, defaults, and effective sources with `prompsit config show`. Environment variables use `PROMPSIT_` and `__`, for example `PROMPSIT_API__BASE_URL`.

Remote API URLs require HTTPS. Loopback addresses may use HTTP. Changing the API URL clears credentials because tokens belong to a specific stand.

## Authentication

```bash
prompsit login
prompsit login -a "EMAIL" -s "SECRET"
prompsit logout
prompsit secret set
```

Credentials are stored in `~/.prompsit/credentials.json`. Login and secret-setting commands are excluded from REPL history and redacted from diagnostics.

## Quality gates

```bash
npm run lint:all
npm run test:unit
npm run build
npm pack --dry-run --json
npm audit
```

The `lint:all` script is the static source of truth; inspect `package.json` for its current checks.

### End-to-end tests

E2E tests call a real API and isolate local state under a temporary data directory.

```bash
npm run test:e2e:critical
npm run test:e2e
```

Set `TEST_ACCOUNT` and `TEST_SECRET`; optionally override the stand with `PROMPSIT_API__BASE_URL`. Never print credential values. An authentication error during global setup means the stand rejected the supplied account.

## Troubleshooting

| Symptom | Action |
|---|---|
| `prompsit: command not found` | Verify the npm global bin directory is on `PATH` |
| Global install returns `EACCES` | Use a Node version manager or a user-owned npm prefix |
| API connection fails | Inspect `prompsit config show`, then run `prompsit health` |
| Login browser does not open | Open the printed URL manually and enter the one-time code |
| Configuration is rejected | Correct the reported value; network commands fail closed |
| REPL clipboard is unavailable on Linux | Install a clipboard utility for the active display server |
| Telemetry is missing | Follow the [observability runbook](observability-operations.md) |

## Release flow

GitLab `origin/master` is primary. Its pipeline leak-scans the repository and creates a filtered squash commit on public GitHub `main`. GitHub Actions validates relevant code, tests, policies, workflow, and documentation. The `package-changes` job publishes only when package inputs changed: `src/`, `examples/`, `assets/`, the package manifests, `tsconfig.json`, or `scripts/clean-build.mjs`. Docs-, test-, skill-, and workflow-only pushes run CI without creating a package version. The private-repository files `.gitlab-ci.yml` and `.github-mirror-exclude`, together with the public [GitHub Actions workflow](../../.github/workflows/ci.yml), are authoritative for these mechanics.

npm publication uses GitHub Actions OIDC Trusted Publishing. The trust configuration and runtime are owned by the npm package settings and CI workflow. Do not configure `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or another long-lived npm credential.

Before pushing a publishable change, update the exact `## Unreleased` section in `CHANGELOG.md` and run:

```bash
npm run lint:all
npm run test:unit
npm run build
npm pack --dry-run --json
```

The pack manifest may contain only built output and intentional assets allowed by `package.json#files`. Stop if it contains raw source, tests, repository documentation, automation files, credentials, `.env`, or `.npmrc`. Commit only intended files and push to `origin/master`.

Match the GitLab SHA embedded in the GitHub mirror message to its Actions run, then wait for completion:

```bash
gh api repos/Prompsit/prompsit-cli/commits/main \
  --jq '{sha: .sha, message: (.commit.message | split("\n")[0])}'
gh run list --repo Prompsit/prompsit-cli --workflow ci.yml \
  --json databaseId,status,conclusion,headSha,url
gh run watch RUN_ID --repo Prompsit/prompsit-cli --exit-status
```

After success, verify the registry version, OIDC provenance, GitHub Release, and published tarball manifest:

```bash
npm view prompsit-cli version
npm view prompsit-cli@VERSION dist.attestations _npmUser --json
npm pack prompsit-cli@VERSION --dry-run --json
gh release view vVERSION --repo Prompsit/prompsit-cli
```

Registry metadata must identify `GitHub Actions` and include a provenance attestation. The workflow derives CalVer from the mirror commit timestamp and owns npm versions, release tags, and GitHub Releases; never publish from a developer machine or create release tags manually.

`workflow_dispatch` is reserved for release recovery and always attempts publication. If a publishable push did not start CI, or a corrected workflow must retry a failed release, first check whether the derived version exists on npm, then dispatch `ci.yml` on `main` once. Diagnose failures with `gh run view RUN_ID --log-failed`; never repeatedly dispatch after an uncertain result.
