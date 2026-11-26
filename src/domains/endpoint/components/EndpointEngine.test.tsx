import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";
import type { Metadata } from "@/foundation/types/basic-types";
import EndpointEngine from "./EndpointEngine";

vi.mock("@/foundation/scene/ShowButton", () => ({
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

    screen.getByText("vllm:v0.24.0");
  });

  // A catalog saved with an engine-less spec used to throw here and, with no
  // error boundary above it, blank the whole list page.
  it("renders a placeholder for a missing engine", () => {
    render(<EndpointEngine spec={{}} metadata={metadata} />);

    screen.getByText("-");
  });
});
