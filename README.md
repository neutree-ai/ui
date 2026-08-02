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
NODE_IP=192.168.1.10:3000 yarn dev
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
