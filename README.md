# @pymthouse/builder-api

TypeScript client for the **PymtHouse Builder API**, **Usage API**, and **OIDC issuer** surfaces.

OAuth/OIDC protocol calls use **[oauth4webapi](https://github.com/panva/oauth4webapi)** (OpenID-certified relying-party implementation). PymtHouse-specific REST paths and helpers live in `PmtHouseClient`.

## Install

```bash
pnpm add @pymthouse/builder-api
```

## Quick start

```ts
import { PmtHouseClient } from "@pymthouse/builder-api";
import {
  createPmtHouseClientFromEnv,
  getPymthouseBaseUrl,
} from "@pymthouse/builder-api/env";

const client = createPmtHouseClientFromEnv();
const base = getPymthouseBaseUrl();
const discovery = await client.getDiscovery();
```

Or construct explicitly:

```ts
import { PmtHouseClient } from "@pymthouse/builder-api";

const client = new PmtHouseClient({
  issuerUrl: process.env.PYMTHOUSE_ISSUER_URL!,
  publicClientId: process.env.PYMTHOUSE_PUBLIC_CLIENT_ID!,
  m2mClientId: process.env.PYMTHOUSE_M2M_CLIENT_ID!,
  m2mClientSecret: process.env.PYMTHOUSE_M2M_CLIENT_SECRET!,
  allowInsecureHttp: process.env.PYMTHOUSE_ISSUER_URL?.startsWith("http:"),
});
```

## Subpath exports

| Import | Purpose |
|--------|---------|
| `@pymthouse/builder-api` | `PmtHouseClient`, discovery cache, errors |
| `@pymthouse/builder-api/format` | Wei formatting for Usage API |
| `@pymthouse/builder-api/env` | `createPmtHouseClientFromEnv`, `getPymthouseBaseUrl` |
| `@pymthouse/builder-api/device` | RFC 8628 `pollDeviceToken` |
| `@pymthouse/builder-api/verify` | RFC 9068 `verifyJwt` |

## Documentation

Authoritative API behavior: [PymtHouse `docs/builder-api.md`](https://github.com/pymthouse/pymthouse/blob/main/docs/builder-api.md).

## Next.js (monorepo) consumption

When the SDK lives as a sibling folder (e.g. `../node-pymt-sdk`), enable `experimental.externalDir` in `next.config` and re-export from a small `lib` shim that points at `../../node-pymt-sdk` (see the `website` app in this org). Published installs from npm use the package name directly without shims.

## License

MIT
