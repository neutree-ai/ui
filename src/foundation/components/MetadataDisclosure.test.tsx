import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "@/foundation/types/basic-types";
import { MetadataDisclosure } from "./MetadataDisclosure";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/ShowPage", () => ({
  ShowPage: {
    Row: ({ title, children }: { title: ReactNode; children: ReactNode }) => (
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    ),
  },
}));

vi.mock("./MetadataCard", () => ({
  KeyValueTags: ({ data }: { data: Record<string, string> }) => (
    <div>
      {Object.entries(data).map(([key, value]) => (
        <span key={key}>{value}</span>
      ))}
    </div>
  ),
}));

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

  it("summarizes metadata and reveals both groups", () => {
    render(
      <MetadataDisclosure
        metadata={metadata({
          labels: { team: "inference" },
          annotations: { owner: "platform", purpose: "production" },
        })}
      />,
    );

    expect(
      screen.getByText("1 common.fields.labels · 2 common.fields.annotations"),
    ).toBeTruthy();
    expect(screen.queryByText("inference")).toBeNull();

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("inference")).toBeTruthy();
    expect(screen.getByText("platform")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();
  });

  it("renders a single available metadata group", () => {
    render(
      <MetadataDisclosure
        metadata={metadata({ annotations: { owner: "platform" } })}
      />,
    );

    expect(screen.getByText("1 common.fields.annotations")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("platform")).toBeTruthy();
    expect(screen.queryByText("common.fields.labels")).toBeNull();
  });
});
