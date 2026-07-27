import { describe, expect, it } from "vitest";
import {
  parseStatusCode,
  statusBadgeVariant,
  statusDescription,
  statusShortLabel,
} from "./status";

const t = (key: string) => key;

describe("parseStatusCode", () => {
  it("accepts three-digit codes in the 1xx–5xx range", () => {
    expect(parseStatusCode("200")).toBe(200);
    expect(parseStatusCode("499")).toBe(499);
    expect(parseStatusCode("100")).toBe(100);
    expect(parseStatusCode("599")).toBe(599);
  });

  it("trims surrounding whitespace", () => {
    expect(parseStatusCode("  418 ")).toBe(418);
  });

  it("rejects codes outside the plausible range", () => {
    expect(parseStatusCode("099")).toBeNull();
    expect(parseStatusCode("600")).toBeNull();
    expect(parseStatusCode("999")).toBeNull();
  });

  it("rejects anything that is not exactly three digits", () => {
    expect(parseStatusCode("")).toBeNull();
    expect(parseStatusCode("4")).toBeNull();
    expect(parseStatusCode("40")).toBeNull();
    expect(parseStatusCode("4000")).toBeNull();
    expect(parseStatusCode("4xx")).toBeNull();
    expect(parseStatusCode("+404")).toBeNull();
    expect(parseStatusCode("40.4")).toBeNull();
  });
});

describe("statusBadgeVariant", () => {
  it("maps 2xx to default, 4xx to outline and everything else to destructive", () => {
    expect(statusBadgeVariant(200)).toBe("default");
    expect(statusBadgeVariant(204)).toBe("default");
    expect(statusBadgeVariant(404)).toBe("outline");
    // 499 is a 4xx code — a client disconnect, not a server failure.
    expect(statusBadgeVariant(499)).toBe("outline");
    expect(statusBadgeVariant(302)).toBe("destructive");
    expect(statusBadgeVariant(503)).toBe("destructive");
  });
});

describe("statusDescription", () => {
  it("uses the per-code description for known codes", () => {
    expect(statusDescription(429, t)).toBe("ai_traces.status.description.429");
    expect(statusDescription(499, t)).toBe("ai_traces.status.description.499");
    expect(statusDescription(200, t)).toBe("ai_traces.status.description.200");
  });

  it("falls back to a status-class hint for unlisted codes", () => {
    expect(statusDescription(204, t)).toBe("ai_traces.status.classSuccess");
    expect(statusDescription(302, t)).toBe("ai_traces.status.classRedirect");
    expect(statusDescription(418, t)).toBe("ai_traces.status.classClient");
    expect(statusDescription(507, t)).toBe("ai_traces.status.classServer");
    expect(statusDescription(0, t)).toBe("ai_traces.status.unknown");
  });
});

describe("statusShortLabel", () => {
  it("uses the per-code short label for known codes", () => {
    expect(statusShortLabel(499, t)).toBe("ai_traces.status.short.499");
  });

  it("falls back to a class label for unlisted codes", () => {
    expect(statusShortLabel(204, t)).toBe("ai_traces.status.shortSuccess");
    expect(statusShortLabel(302, t)).toBe("ai_traces.status.shortRedirect");
    expect(statusShortLabel(418, t)).toBe("ai_traces.status.shortClient");
    expect(statusShortLabel(507, t)).toBe("ai_traces.status.shortServer");
    expect(statusShortLabel(0, t)).toBe("ai_traces.status.unknown");
  });
});
