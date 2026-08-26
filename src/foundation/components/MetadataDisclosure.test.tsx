import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Metadata } from "@/foundation/types/basic-types";
import { MetadataDisclosure } from "./MetadataDisclosure";

const metadata = (overrides: Partial<Metadata> = {}): Metadata => ({
  name: "endpoint-a",
  workspace: "default",
  creation_timestamp: "2026-01-01T00:00:00Z",
  update_timestamp: "2026-01-01T00:00:00Z",
  labels: {},
  annotations: {},
  ...overrides,
  deletion_timestamp: overrides.deletion_timestamp ?? null,
});

describe("MetadataDisclosure", () => {
  it("does not render without labels or annotations", () => {
    const { container } = render(<MetadataDisclosure metadata={metadata()} />);

    expect(container.firstChild).toBeNull();
  });

  it("does not render metadata groups", () => {
    render(
      <MetadataDisclosure
        metadata={metadata({
          labels: { team: "inference" },
          annotations: { owner: "platform", purpose: "production" },
        })}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("inference")).toBeNull();
  });

  it("does not render a single metadata group", () => {
    render(
      <MetadataDisclosure
        metadata={metadata({ annotations: { owner: "platform" } })}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("platform")).toBeNull();
    expect(screen.queryByText("common.fields.labels")).toBeNull();
  });
});
