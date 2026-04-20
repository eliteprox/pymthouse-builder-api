import { describe, expect, it } from "vitest";
import { buildDeviceCodeResource, normalizeUserCode } from "../src/client.js";

describe("device approval resource", () => {
  it("matches builder-api.md NaaP Option B shape", () => {
    const code = normalizeUserCode("wx12-yz");
    expect(buildDeviceCodeResource(code)).toBe("urn:pmth:device_code:WX12YZ");
  });
});
