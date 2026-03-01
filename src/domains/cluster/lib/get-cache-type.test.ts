import { describe, expect, it } from "vitest";
import { getCacheType } from "./get-cache-type";

describe("getCacheType", () => {
  it("returns 'nfs' when nfs is present", () => {
    expect(getCacheType({ nfs: { server: "1.2.3.4", path: "/data" } })).toBe(
      "nfs",
    );
  });

  it("returns 'pvc' when pvc is present", () => {
    expect(getCacheType({ pvc: { storageClassName: "standard" } })).toBe("pvc");
  });

  it("returns 'host_path' by default", () => {
    expect(getCacheType({ host_path: { path: "/mnt" } })).toBe("host_path");
  });

  it("returns 'host_path' for empty object", () => {
    expect(getCacheType({})).toBe("host_path");
  });

  it("prefers nfs over pvc when both present", () => {
    expect(
      getCacheType({
        nfs: { server: "1.2.3.4", path: "/data" },
        pvc: { storageClassName: "standard" },
      }),
    ).toBe("nfs");
  });
});
