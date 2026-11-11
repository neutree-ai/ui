import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CacheEndpointRef } from "../lib/cache-endpoints";
import { CacheEndpointLinks } from "./CacheEndpointLinks";

vi.mock("@/components/ui/hover-card", () => ({
  HoverCard: ({ children }: { children: ReactNode }) => <>{children}</>,
  HoverCardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  HoverCardTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/foundation/components/Link", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const endpoint = (
  overrides: Partial<CacheEndpointRef> = {},
): CacheEndpointRef => ({
  key: "default/chat",
  label: "Chat",
  name: "chat",
  workspace: "default",
  status: null,
  nodes: ["node-a"],
  ...overrides,
});

describe("CacheEndpointLinks", () => {
  it("uses an em dash when the dependency list is empty", () => {
    render(<CacheEndpointLinks endpoints={[]} error={false} />);
    screen.getByText("—");
  });

  it("reports a failed dependency check without showing an empty result", () => {
    render(<CacheEndpointLinks endpoints={[]} error />);

    screen.getByText("clusters.zcache.dependencyCheckFailed");
    screen.getByText("clusters.zcache.dependencyCheckFailedTitle");
    screen.getByText("clusters.zcache.dependencyCheckFailedHint");
    expect(
      screen.queryByText("clusters.zcache.dependencyInstruction"),
    ).toBeNull();
  });

  it("renders an endpoint without a resource name as text instead of a broken link", () => {
    render(
      <CacheEndpointLinks
        endpoints={[endpoint({ name: undefined, label: "Deleted endpoint" })]}
        error={false}
      />,
    );

    screen.getByText("Deleted endpoint");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
