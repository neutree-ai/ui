import { describe, expect, it } from "vitest";
import {
  isIpDuplicated,
  validateNodeIps,
  validateSingleIp,
} from "./validate-node-ips";

describe("isIpDuplicated", () => {
  it("returns true when IP is in worker list", () => {
    expect(
      isIpDuplicated("10.0.0.1", ["10.0.0.1", "10.0.0.2"], "10.0.0.3"),
    ).toBe(true);
  });

  it("returns true when IP matches head IP", () => {
    expect(isIpDuplicated("10.0.0.1", ["10.0.0.2"], "10.0.0.1")).toBe(true);
  });

  it("returns false when IP is unique", () => {
    expect(
      isIpDuplicated("10.0.0.3", ["10.0.0.1", "10.0.0.2"], "10.0.0.4"),
    ).toBe(false);
  });

  it("returns false with empty worker list and different head", () => {
    expect(isIpDuplicated("10.0.0.1", [], "10.0.0.2")).toBe(false);
  });
});

describe("validateNodeIps", () => {
  it("returns null for valid value", () => {
    expect(
      validateNodeIps({ head_ip: "10.0.0.1", worker_ips: ["10.0.0.2"] }),
    ).toBeNull();
  });

  it("returns 'required' when head_ip is empty", () => {
    expect(validateNodeIps({ head_ip: "", worker_ips: [] })).toBe("required");
  });

  it("returns 'required' when value is undefined", () => {
    expect(validateNodeIps(undefined)).toBe("required");
  });

  it("returns 'invalidIP' for malformed head_ip", () => {
    expect(
      validateNodeIps({ head_ip: "999.999.999.999", worker_ips: [] }),
    ).toBe("invalidIP");
  });

  it("returns 'duplicated' when head_ip is in worker_ips", () => {
    expect(
      validateNodeIps({ head_ip: "10.0.0.1", worker_ips: ["10.0.0.1"] }),
    ).toBe("duplicated");
  });

  it("accepts head_ip with empty worker list", () => {
    expect(
      validateNodeIps({ head_ip: "192.168.1.1", worker_ips: [] }),
    ).toBeNull();
  });
});

describe("validateSingleIp", () => {
  it("returns null for valid unique IP", () => {
    expect(validateSingleIp("10.0.0.3", ["10.0.0.1"], "10.0.0.2")).toBeNull();
  });

  it("returns null for empty IP when not required", () => {
    expect(validateSingleIp("", [], "10.0.0.1")).toBeNull();
  });

  it("returns 'required' for empty IP when required", () => {
    expect(validateSingleIp("", [], "10.0.0.1", true)).toBe("required");
  });

  it("returns 'invalidIP' for malformed IP", () => {
    expect(validateSingleIp("abc", [], "10.0.0.1")).toBe("invalidIP");
  });

  it("returns 'duplicated' when IP matches worker", () => {
    expect(validateSingleIp("10.0.0.1", ["10.0.0.1"], "10.0.0.2")).toBe(
      "duplicated",
    );
  });

  it("returns 'duplicated' when IP matches head", () => {
    expect(validateSingleIp("10.0.0.1", [], "10.0.0.1")).toBe("duplicated");
  });
});
