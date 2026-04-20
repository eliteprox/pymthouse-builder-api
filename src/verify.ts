import {
  allowInsecureRequests,
  customFetch,
  validateJwtAccessToken,
  type JWTAccessTokenClaims,
} from "oauth4webapi";
import { loadAuthorizationServer } from "./discovery.js";
import { PmtHouseError } from "./errors.js";
import { mapOAuthError } from "./oauth-map.js";
import type { FetchLike } from "./types.js";

export interface VerifyJwtOptions {
  issuerUrl: string;
  /** Expected JWT `aud` (resource identifier). */
  audience: string;
  fetch?: FetchLike;
  allowInsecureHttp?: boolean;
  /** If set, every scope here must appear in the token's `scope` claim (space-separated). */
  requiredScopes?: string[];
}

/**
 * RFC 9068 / RFC 6750: validate a JWT access token using issuer JWKS via oauth4webapi.
 */
export async function verifyJwt(
  token: string,
  options: VerifyJwtOptions,
): Promise<JWTAccessTokenClaims> {
  const fetchImpl = options.fetch ?? fetch;
  const as = await loadAuthorizationServer(options.issuerUrl, fetchImpl, {
    allowInsecureHttp: options.allowInsecureHttp,
  });

  const request = new Request("https://resource.invalid/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const httpOpts: Record<symbol, unknown> = {
    [customFetch]: fetchImpl,
  };
  if (options.allowInsecureHttp) {
    httpOpts[allowInsecureRequests] = true;
  }

  try {
    const claims = await validateJwtAccessToken(
      as,
      request,
      options.audience,
      httpOpts as import("oauth4webapi").ValidateJWTAccessTokenOptions,
    );

    if (options.requiredScopes?.length) {
      const scopeStr = typeof claims.scope === "string" ? claims.scope : "";
      const have = new Set(scopeStr.split(/\s+/).filter(Boolean));
      for (const s of options.requiredScopes) {
        if (!have.has(s)) {
          throw new PmtHouseError(`Missing required scope: ${s}`, {
            status: 403,
            code: "insufficient_scope",
          });
        }
      }
    }

    return claims;
  } catch (e) {
    throw mapOAuthError(e);
  }
}
