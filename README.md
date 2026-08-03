# Neutree UI

### Installation

To install all dependencies, run:

```bash
yarn
```

### Development

Start the development server:

```bash
yarn dev
```

The dev server proxies `/api/v1` to `http://localhost`. Point it at another
backend with `NODE_IP`, which may include a port:

```bash
NODE_IP=my-backend.example.com:3000 yarn dev
```

When the dev server is reached through a hostname other than `localhost` — a
tunnel, a cloud sandbox, or a LAN hostname — Vite's DNS-rebinding protection
answers `403 Forbidden`. List those hostnames in `VITE_ALLOWED_HOSTS` (comma
separated) to allow them:

```bash
VITE_ALLOWED_HOSTS=my-preview.example.dev yarn dev --host 0.0.0.0
```

Leave `VITE_ALLOWED_HOSTS` unset for local development; the protection stays on
by default.

### Building

Build the project for production:

```bash
yarn build
```

### Testing

Run tests:

```bash
yarn test
```

### Linting

Lint your code:

```bash
yarn lint
```

### Before you commit

The `pre-commit` hook and the `Test` CI workflow run the same checks: lint, typecheck, layer
boundaries, unused exports, unit tests, and two i18n gates.

One of the i18n gates fires on changes that have nothing to do with copy, so it is worth knowing
about up front. `tools/i18n-tracker.cjs` hashes **every `.ts` and `.tsx` file in the repository —
build configs such as `vite.config.ts` included** — and fails whenever a file's content differs
from `.i18n-tracker.lock`. After editing any TypeScript file, record its new hash and commit the
lock with it:

```bash
node tools/i18n-tracker.cjs update vite.config.ts
git add vite.config.ts .i18n-tracker.lock
```

Full rules, exclusions, and failure recipes: [contributing/i18n-guide.md](contributing/i18n-guide.md).
