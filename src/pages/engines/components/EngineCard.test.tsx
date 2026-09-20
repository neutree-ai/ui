import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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
});
