import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const showRecord = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("@refinedev/core", () => ({
  useShow: () => ({
    query: { data: { data: showRecord.current }, isLoading: false },
  }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/domains/image-registry/components/ImageRegistryStatus", () => ({
  default: () => <span>Status</span>,
}));

vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => <span>Created</span>,
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  ShowPage.ObjectHeader = ({
    title,
    description,
  }: {
    title: React.ReactNode;
    description: React.ReactNode;
  }) => (
    <header>
      {title}
      {description}
    </header>
  );
  ShowPage.Section = ({ children }: { children: React.ReactNode }) => (
    <section>{children}</section>
  );
  ShowPage.Row = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { ShowPage };
});

import { ImageRegistriesShow } from "./show";

const record = (url: string, repository: string) => ({
  metadata: { name: "registry", creation_timestamp: "2026-01-01" },
  spec: { url, repository },
  status: { phase: "Connected" },
});

describe("ImageRegistriesShow", () => {
  it("joins URL and repository without duplicate slashes", () => {
    showRecord.current = record("https://index.docker.io/v1/", "/neutree");
    render(<ImageRegistriesShow />);

    expect(screen.getByText("https://index.docker.io/v1/neutree")).toBeTruthy();
    expect(screen.queryByText("image_registries.fields.repository")).toBeNull();
  });

  it("shows only the URL when repository is empty", () => {
    showRecord.current = record("https://registry.example.com", "   ");
    render(<ImageRegistriesShow />);

    expect(screen.getByText("https://registry.example.com")).toBeTruthy();
  });
});
