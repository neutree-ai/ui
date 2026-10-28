import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Engine, EngineVersion } from "@/domains/engine/types";
import { useIsTruncated } from "@/foundation/hooks/use-is-truncated";
import { EngineCard } from "./EngineCard";

// The card is a navigation surface; render the anchor without the router.
vi.mock("@/foundation/components/Link", () => ({
  Link: ({ href, ...props }: { href: string }) => <a href={href} {...props} />,
}));

// Match the hover-card test convention: render the content inline.
vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="version-tooltip">{children}</div>
  ),
}));

function engine(options: {
  versions: string[];
  phase?: "Created" | "Pending" | "Failed";
}): Engine {
  return {
    id: 1,
    api_version: "v1",
    kind: "Engine",
    metadata: {
      name: "vllm",
      workspace: "default",
      deletion_timestamp: null,
      creation_timestamp: "2026-08-14T00:00:00Z",
      update_timestamp: "2026-08-14T00:00:00Z",
      labels: {},
      annotations: {},
    },
    spec: {
      versions: options.versions.map<EngineVersion>((version) => ({
        version,
        values_schema: {},
      })),
      supported_tasks: ["text-generation"],
    },
    status: options.phase
      ? {
          phase: options.phase as unknown as NonNullable<
            Engine["status"]
          >["phase"],
        }
      : null,
  };
}

const renderCard = (value: Engine) =>
  render(
    <TooltipProvider>
      <EngineCard engine={value} onSelectVersion={() => {}} />
    </TooltipProvider>,
  );

describe("EngineCard", () => {
  beforeEach(() => {
    vi.mocked(useIsTruncated).mockReturnValue(false);
  });

  it("shows the newest version rather than the first one the engine returned", () => {
    renderCard(engine({ versions: ["v0.17.1", "v0.24.0"], phase: "Created" }));

    expect(screen.getByTestId("engine-latest-version").textContent).toBe(
      "v0.24.0",
    );
    screen.getByText("v0.17.1"); // listed in the hover card
  });

  it.each([
    { phase: "Created", shown: false },
    { phase: "Pending", shown: true },
  ] as const)("shows a status badge for $phase: $shown", ({ phase, shown }) => {
    renderCard(engine({ versions: ["v0.24.0"], phase }));

    expect(screen.queryByText(`status.phases.engine.${phase}`) !== null).toBe(
      shown,
    );
  });

  it("offers no version entry point for a single-version engine", () => {
    renderCard(engine({ versions: ["v0.3.7"], phase: "Created" }));

    expect(screen.getByTestId("engine-latest-version").textContent).toBe(
      "v0.3.7",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the full version list for a multi-version engine", () => {
    renderCard(engine({ versions: ["v0.17.1", "v0.24.0"], phase: "Created" }));

    screen.getByRole("button", { name: "engines.versions.count:2" });
  });

  it("renders an engine that declares no versions, tasks or status", () => {
    // A package that has just been imported can be this bare, so the card must
    // not depend on any of those fields being present.
    const bare = engine({ versions: [] });
    renderCard({
      ...bare,
      metadata: {
        ...bare.metadata,
        workspace: undefined as unknown as string,
      },
      spec: {} as Engine["spec"],
      status: null,
    });

    expect(screen.getByTestId("engine-latest-version").textContent).toBe("-");
    // The fallback only exists to keep the template from printing
    // "undefined" into the URL.
    expect(screen.getAllByRole("link")[0].getAttribute("href")).not.toContain(
      "undefined",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("text-generation")).toBeNull();
  });

  it.each([
    { truncated: true, tooltip: "v0.24.0" },
    { truncated: false, tooltip: null },
  ])(
    "repeats the version in a tooltip only when the chip is cut off (truncated: $truncated)",
    ({ truncated, tooltip }) => {
      vi.mocked(useIsTruncated).mockReturnValue(truncated);

      renderCard(engine({ versions: ["v0.24.0"] }));

      expect(screen.queryByTestId("version-tooltip")?.textContent ?? null).toBe(
        tooltip,
      );
    },
  );
});
