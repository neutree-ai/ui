import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "@/foundation/types/basic-types";
import EndpointEngine from "./EndpointEngine";

vi.mock("@/foundation/components/ShowButton", () => ({
  ShowButton: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

const metadata = { name: "mc", workspace: "default" } as Metadata;

describe("EndpointEngine", () => {
  it("renders the engine reference when the spec carries one", () => {
    render(
      <EndpointEngine
        spec={{ engine: { engine: "vllm", version: "v0.24.0" } }}
        metadata={metadata}
      />,
    );

    expect(screen.getByText("vllm:v0.24.0")).toBeTruthy();
  });

  // A catalog saved with a broken or engine-less spec used to throw here and,
  // with no error boundary above it, blank the whole list page (NEU-611).
  it.each([
    ["a missing engine", {}],
    ["an engine without a name", { engine: { version: "v1" } }],
  ])("renders a placeholder for %s", (_label, spec) => {
    render(<EndpointEngine spec={spec as never} metadata={metadata} />);

    expect(screen.getByText("-")).toBeTruthy();
  });
});
