import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Engine, EngineVersion } from "@/domains/engine/types";
import { EngineCard } from "./EngineCard";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) => {
      if (key === "engines.versions.count") return `${options?.count} versions`;
      if (key === "engines.versions.latest") return "Latest";
      if (key === "engines.card.open") return `Open ${options?.name}`;
      if (key.startsWith("status.phases.engine.")) return key.split(".").pop();
      return key;
    },
  }),
}));

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

// jsdom has no layout, so the truncation answer is driven from the test; the
// tooltip primitives are flattened so the content is assertable.
const truncatedMock = vi.fn(() => false);
vi.mock("@/foundation/hooks/use-is-truncated", () => ({
  useIsTruncated: () => truncatedMock(),
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
    truncatedMock.mockReturnValue(false);
  });

  it("shows the newest version rather than the first one the engine returned", () => {
    renderCard(engine({ versions: ["v0.17.1", "v0.24.0"], phase: "Created" }));

    expect(screen.getByTestId("engine-latest-version").textContent).toBe(
      "v0.24.0",
    );
    expect(screen.getByText("v0.17.1")).toBeTruthy(); // listed in the hover card
  });

  it("hides the status badge while the engine is in its steady phase", () => {
    renderCard(engine({ versions: ["v0.24.0"], phase: "Created" }));

    expect(screen.queryByText("Created")).toBeNull();
  });

  it("shows the status badge for a non-steady phase", () => {
    renderCard(engine({ versions: ["v0.24.0"], phase: "Pending" }));

    expect(screen.getByText("Pending")).toBeTruthy();
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

    expect(screen.getByRole("button", { name: "2 versions" })).toBeTruthy();
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

  it("repeats the version in a tooltip once the chip is cut off", () => {
    truncatedMock.mockReturnValue(true);

    renderCard(engine({ versions: ["v0.24.0"] }));

    expect(screen.getByTestId("version-tooltip").textContent).toBe("v0.24.0");
  });

  it("leaves the tooltip out while the version fits", () => {
    renderCard(engine({ versions: ["v0.24.0"] }));

    // The tooltip is the fallback for a clipped chip, not a permanent fixture.
    expect(screen.queryByTestId("version-tooltip")).toBeNull();
  });
});
