import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "@/foundation/types/basic-types";
import { MetadataTimestampMeta } from "./MetadataTimestampMeta";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("./ShowPage", () => ({
  ShowPage: {
    Meta: ({ label, children }: { label: ReactNode; children: ReactNode }) => (
      <div>
        <span>{label}</span>
        {children}
      </div>
    ),
  },
}));

vi.mock("./Timestamp", () => ({
  default: ({
    timestamp,
    relative,
  }: {
    timestamp: string;
    relative?: boolean;
  }) => <time data-relative={relative ? "true" : "false"}>{timestamp}</time>,
}));

describe("MetadataTimestampMeta", () => {
  it("shows the creation timestamp in relative mode", () => {
    const metadata = {
      name: "endpoint-a",
      workspace: "default",
      creation_timestamp: "2026-08-10T12:00:00Z",
      update_timestamp: "2026-08-11T12:00:00Z",
      deletion_timestamp: null,
      labels: {},
      annotations: {},
    } satisfies Metadata;

    render(<MetadataTimestampMeta metadata={metadata} />);

    expect(screen.getByText("common.fields.createdAt")).toBeTruthy();
    expect(
      screen
        .getByText(metadata.creation_timestamp)
        .getAttribute("data-relative"),
    ).toBe("true");
    expect(screen.queryByText(metadata.update_timestamp)).toBeNull();
  });
});
