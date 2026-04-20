import { describe, expect, it } from "vitest";
import { buildDeviceCodeResource, normalizeUserCode, PmtHouseClient } from "../src/client.js";

describe("normalizeUserCode", () => {
  it("uppercases and strips non-alphanumeric", () => {
    expect(normalizeUserCode("ab12-cd")).toBe("AB12CD");
  });
});

describe("buildDeviceCodeResource", () => {
  it("returns RFC 8707 urn with normalized code", () => {
    expect(buildDeviceCodeResource("ab-cd")).toBe("urn:pmth:device_code:ABCD");
  });
});

describe("PmtHouseClient.parseDeviceApprovalRedirect", () => {
  const client = new PmtHouseClient({
    issuerUrl: "https://issuer.example/api/v1/oidc",
    publicClientId: "app_x",
    m2mClientId: "m2m_x",
    m2mClientSecret: "secret",
  });

  it("parses valid initiate-login parameters", () => {
    const target = new URL("https://issuer.example/oidc/device");
    target.searchParams.set("user_code", "ABCD-EFGH");
    target.searchParams.set("client_id", "app_cli");
    const sp = new URLSearchParams();
    sp.set("iss", "https://issuer.example/api/v1/oidc");
    sp.set("target_link_uri", target.toString());

    const parsed = client.parseDeviceApprovalRedirect(sp);
    expect(parsed.userCode).toBe("ABCDEFGH");
    expect(parsed.clientId).toBe("app_cli");
  });
});
