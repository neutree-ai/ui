import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EngineVersion } from "@/domains/engine/types";
import { EngineVersionSummary } from "./EngineVersionSummary";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === "engines.versions.count") return `${options?.count} versions`;
      if (key === "engines.versions.all") return "All versions";
      return "Latest";
    },
  }),
}));

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const version = (value: string): EngineVersion => ({
  version: value,
  values_schema: {},
});

describe("EngineVersionSummary", () => {
  it("lists every version newest first and marks the latest", () => {
    render(
      <EngineVersionSummary
        versions={[version("v0.13.0"), version("v0.24.0"), version("v0.17.1")]}
        onSelectVersion={() => {}}
      />,
    );

    const [trigger, ...rows] = screen.getAllByRole("button");
    expect(trigger.textContent).toBe("3 versions");
    expect(rows.map((row) => row.textContent)).toEqual([
      "v0.24.0Latest",
      "v0.17.1",
      "v0.13.0",
    ]);
  });

  it("reports the version the user picked", () => {
    const onSelectVersion = vi.fn();
    render(
      <EngineVersionSummary
        versions={[version("v0.17.1"), version("v0.24.0")]}
        onSelectVersion={onSelectVersion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "v0.17.1" }));

    expect(onSelectVersion).toHaveBeenCalledWith("v0.17.1");
  });

  it("renders nothing for a single version", () => {
    const { container } = render(
      <EngineVersionSummary
        versions={[version("v0.3.7")]}
        onSelectVersion={() => {}}
      />,
    );

    expect(container.textContent).toBe("");
  });

  it("renders nothing when the engine has no versions", () => {
    const { container } = render(
      <EngineVersionSummary versions={[]} onSelectVersion={() => {}} />,
    );

    expect(container.textContent).toBe("");
  });
});
