import {
  allowInsecureRequests,
  customFetch,
  discoveryRequest,
  processDiscoveryResponse,
  type AuthorizationServer,
} from "oauth4webapi";
import { PmtHouseError } from "./errors.js";
import { stripTrailingSlashes } from "./string-utils.js";
import type { FetchLike, OidcDiscoveryDocument } from "./types.js";

export function authorizationServerToOidcDocument(as: AuthorizationServer): OidcDiscoveryDocument {
  const tokenEndpoint = as.token_endpoint;
  const jwksUri = as.jwks_uri;
  if (!tokenEndpoint || !jwksUri) {
    throw new PmtHouseError("OIDC discovery document is missing token_endpoint or jwks_uri", {
      status: 500,
      code: "oidc_discovery_invalid",
    });
  }
  return {
    issuer: as.issuer,
    authorization_endpoint: as.authorization_endpoint ?? "",
    token_endpoint: tokenEndpoint,
    jwks_uri: jwksUri,
    userinfo_endpoint: as.userinfo_endpoint,
    device_authorization_endpoint: as.device_authorization_endpoint,
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  as: AuthorizationServer;
  fetchedAt: number;
};

const discoveryCache = new Map<string, CacheEntry>();

function normalizedIssuerKey(issuerUrl: string): string {
  return stripTrailingSlashes(issuerUrl);
}

export interface LoadAuthorizationServerOptions {
  force?: boolean;
  allowInsecureHttp?: boolean;
}

/**
 * Loads OIDC discovery metadata via oauth4webapi (RFC 8414 / OIDC Discovery), with a 5-minute cache.
 */
export async function loadAuthorizationServer(
  issuerUrl: string,
  fetchImpl: FetchLike,
  options: LoadAuthorizationServerOptions = {},
): Promise<AuthorizationServer> {
  const key = normalizedIssuerKey(issuerUrl);
  const now = Date.now();
  const cached = discoveryCache.get(key);

  if (!options.force && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.as;
  }

  const issuerIdentifier = new URL(key);
  const discoveryOpts: Parameters<typeof discoveryRequest>[1] = {
    algorithm: "oidc",
    [customFetch]: fetchImpl,
  };
  if (options.allowInsecureHttp) {
    discoveryOpts[allowInsecureRequests] = true;
  }

  let response: Response;
  try {
    response = await discoveryRequest(issuerIdentifier, discoveryOpts);
  } catch (e) {
    throw mapDiscoveryNetworkError(e);
  }

  let as: AuthorizationServer;
  try {
    as = await processDiscoveryResponse(issuerIdentifier, response);
  } catch (e) {
    throw mapOAuthDiscoveryError(e);
  }

  discoveryCache.set(key, { as, fetchedAt: now });
  return as;
}

export async function fetchDiscoveryDocument(
  issuerUrl: string,
  fetchImpl: FetchLike,
  options: LoadAuthorizationServerOptions = {},
): Promise<OidcDiscoveryDocument> {
  const as = await loadAuthorizationServer(issuerUrl, fetchImpl, options);
  return authorizationServerToOidcDocument(as);
}

export function clearDiscoveryCache(issuerUrl?: string): void {
  if (!issuerUrl) {
    discoveryCache.clear();
    return;
  }
  discoveryCache.delete(normalizedIssuerKey(issuerUrl));
}

function mapOAuthDiscoveryError(error: unknown): PmtHouseError {
  if (error instanceof PmtHouseError) {
    return error;
  }
  if (error instanceof Error) {
    return new PmtHouseError(error.message, {
      status: 500,
      code: "oidc_discovery_invalid",
      details: { cause: error.cause },
    });
  }
  return new PmtHouseError("OIDC discovery failed", {
    status: 500,
    code: "oidc_discovery_invalid",
  });
}

function mapDiscoveryNetworkError(error: unknown): PmtHouseError {
  if (error instanceof PmtHouseError) {
    return error;
  }
  if (error instanceof Error) {
    return new PmtHouseError(`Failed to load OIDC discovery: ${error.message}`, {
      status: 502,
      code: "oidc_discovery_failed",
    });
  }
  return new PmtHouseError("Failed to load OIDC discovery", {
    status: 502,
    code: "oidc_discovery_failed",
  });
}
