import { describe, expect, it } from "vitest";
import { isNfsProtocol, isValidIPAddress, isValidPath } from "./validate";

describe("isValidIPAddress", () => {
  it.each(["0.0.0.0", "192.168.1.1", "255.255.255.255", "10.0.0.1"])(
    "accepts %s",
    (ip) => {
      expect(isValidIPAddress(ip)).toBe(true);
    },
  );

  it.each([
    "256.1.1.1",
    "1.2.3.999",
    "1.2.3",
    "1.2.3.4.5",
    "abc.def.ghi.jkl",
    "",
    "192.168.1.1/24",
    " 192.168.1.1",
  ])("rejects %s", (ip) => {
    expect(isValidIPAddress(ip)).toBe(false);
  });
});

describe("isValidPath", () => {
  it.each(["/", "/tmp", "/var/log/app.log", "/a/b-c/d_e/f.g"])(
    "accepts %s",
    (path) => {
      expect(isValidPath(path)).toBe(true);
    },
  );

  it.each(["", "relative/path", "/path with spaces", "/path@special"])(
    "rejects %s",
    (path) => {
      expect(isValidPath(path)).toBe(false);
    },
  );
});

describe("isNfsProtocol", () => {
  it("matches nfs:// prefix", () => {
    expect(isNfsProtocol("nfs://server/share")).toBe(true);
  });

  it("trims whitespace", () => {
    expect(isNfsProtocol("  nfs://server")).toBe(true);
  });

  it("rejects other protocols", () => {
    expect(isNfsProtocol("http://server")).toBe(false);
    expect(isNfsProtocol("")).toBe(false);
  });
});
