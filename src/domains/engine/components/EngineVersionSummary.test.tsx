import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EngineVersion } from "@/domains/engine/types";
import { EngineVersionSummary } from "./EngineVersionSummary";

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const versions = (...values: string[]): EngineVersion[] =>
  values.map((version) => ({ version, values_schema: {} }));

describe("EngineVersionSummary", () => {
  it("lists every version newest first and marks the latest", () => {
    render(
      <EngineVersionSummary
        versions={versions("v0.13.0", "v0.24.0", "v0.17.1")}
        onSelectVersion={() => {}}
      />,
    );

    const [trigger, ...rows] = screen.getAllByRole("button");
    expect(trigger.textContent).toBe("engines.versions.count:3");
    expect(rows.map((row) => row.textContent)).toEqual([
      "v0.24.0engines.versions.latest",
      "v0.17.1",
      "v0.13.0",
    ]);
  });

  it("reports the version the user picked", () => {
    const onSelectVersion = vi.fn();
    render(
      <EngineVersionSummary
        versions={versions("v0.17.1", "v0.24.0")}
        onSelectVersion={onSelectVersion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "v0.17.1" }));

    expect(onSelectVersion).toHaveBeenCalledWith("v0.17.1");
  });

  it.each([
    ["a single version", versions("v0.3.7")],
    ["no versions", versions()],
  ])("renders nothing for %s", (_case, list) => {
    const { container } = render(
      <EngineVersionSummary versions={list} onSelectVersion={() => {}} />,
    );

    expect(container.textContent).toBe("");
  });
});
