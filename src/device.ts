import {
  allowInsecureRequests,
  customFetch,
  deviceAuthorizationRequest,
  deviceCodeGrantRequest,
  None,
  processDeviceAuthorizationResponse,
  processDeviceCodeResponse,
  ResponseBodyError,
  type Client,
} from "oauth4webapi";
import { loadAuthorizationServer } from "./discovery.js";
import { PmtHouseError } from "./errors.js";
import { mapOAuthError } from "./oauth-map.js";
import type { FetchLike } from "./types.js";

export interface PollDeviceTokenOptions {
  issuerUrl: string;
  /** Public OAuth `client_id` (RFC 8628). */
  clientId: string;
  /** Space-separated scopes for the device authorization request. */
  scope?: string;
  fetch?: FetchLike;
  allowInsecureHttp?: boolean;
  signal?: AbortSignal;
  onUserCode?: (info: {
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresIn: number;
    intervalSeconds?: number;
  }) => void;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error(typeof signal.reason === "string" ? signal.reason : "Aborted"),
        );
      },
      { once: true },
    );
  });
}

/**
 * RFC 8628 device authorization grant: request a device code, then poll the token endpoint until
 * tokens are issued (handles `authorization_pending` and `slow_down`).
 */
export async function pollDeviceToken(
  options: PollDeviceTokenOptions,
): Promise<import("oauth4webapi").TokenEndpointResponse> {
  const fetchImpl = options.fetch ?? fetch;
  const as = await loadAuthorizationServer(options.issuerUrl, fetchImpl, {
    allowInsecureHttp: options.allowInsecureHttp,
  });

  if (!as.device_authorization_endpoint) {
    throw new PmtHouseError(
      "Authorization server metadata has no device_authorization_endpoint",
      { status: 400, code: "unsupported_grant" },
    );
  }

  const client: Client = { client_id: options.clientId };
  const params = new URLSearchParams();
  if (options.scope) {
    params.set("scope", options.scope);
  }

  const httpOpts: Record<symbol, unknown> = {
    [customFetch]: fetchImpl,
  };
  if (options.allowInsecureHttp) {
    httpOpts[allowInsecureRequests] = true;
  }

  let deviceResponse: Response;
  try {
    deviceResponse = await deviceAuthorizationRequest(
      as,
      client,
      None(),
      params,
      httpOpts as import("oauth4webapi").DeviceAuthorizationRequestOptions,
    );
  } catch (e) {
    throw mapOAuthError(e);
  }

  let dar: import("oauth4webapi").DeviceAuthorizationResponse;
  try {
    dar = await processDeviceAuthorizationResponse(as, client, deviceResponse);
  } catch (e) {
    throw mapOAuthError(e);
  }

  options.onUserCode?.({
    userCode: dar.user_code,
    verificationUri: dar.verification_uri,
    verificationUriComplete: dar.verification_uri_complete,
    expiresIn: dar.expires_in,
    intervalSeconds: dar.interval,
  });

  let pollIntervalMs = (dar.interval ?? 5) * 1000;
  const deadline = Date.now() + dar.expires_in * 1000;
  let firstPoll = true;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new Error("Aborted");
    }

    if (!firstPoll) {
      await sleep(pollIntervalMs, options.signal);
    }
    firstPoll = false;

    let tokenResponse: Response;
    try {
      tokenResponse = await deviceCodeGrantRequest(
        as,
        client,
        None(),
        dar.device_code,
        httpOpts as import("oauth4webapi").TokenEndpointRequestOptions,
      );
    } catch (e) {
      throw mapOAuthError(e);
    }

    try {
      return await processDeviceCodeResponse(as, client, tokenResponse);
    } catch (e) {
      if (e instanceof ResponseBodyError) {
        if (e.error === "authorization_pending") {
          continue;
        }
        if (e.error === "slow_down") {
          pollIntervalMs += 5000;
          continue;
        }
      }
      throw mapOAuthError(e);
    }
  }

  throw new PmtHouseError("Device authorization expired before completion", {
    status: 408,
    code: "device_flow_expired",
  });
}
