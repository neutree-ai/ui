import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  canPageForward,
  RegistryModelsTable,
} from "@/domains/model-registry/components/RegistryModelsTable";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/hooks/use-registry-models", () => ({
  useRegistryModels: vi.fn(),
}));

const page = (total: number | null, count: number) => ({
  page: { models: [], total },
  models: Array.from({ length: count }, (_, index) => ({
    name: `model-${index}`,
    versions: [{ name: "v1", creation_time: "2026-01-01T00:00:00Z" }],
  })),
  total,
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});

const renderTable = () =>
  render(
    <MemoryRouter>
      <RegistryModelsTable
        workspace="default"
        registry="reg"
        modelHref={(model, version) => `/${model}/${version}`}
      />
    </MemoryRouter>,
  );

describe("canPageForward", () => {
  it("pages forward while the total says there is more", () => {
    expect(canPageForward(50, 0, 20)).toBe(true);
    expect(canPageForward(50, 20, 20)).toBe(true);
  });

  it("stops at the end of a countable listing", () => {
    expect(canPageForward(50, 40, 20)).toBe(false);
    expect(canPageForward(0, 0, 20)).toBe(false);
  });

  it("never pages a registry that cannot report a total", () => {
    // Not being able to count and not being able to read from an offset are the
    // same upstream limitation. A full page is not evidence of a next one here:
    // asking for it is answered with a 400, so the control must not offer it.
    expect(canPageForward(null, 0, 20)).toBe(false);
    expect(canPageForward(null, 20, 20)).toBe(false);
  });
});

describe("RegistryModelsTable", () => {
  it("disables Next when the registry reports no total, even on a full page", () => {
    vi.mocked(useRegistryModels).mockReturnValue(
      page(null, 20) as unknown as ReturnType<typeof useRegistryModels>,
    );

    renderTable();

    expect(
      screen.getByTestId("registry-models-next").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("enables Next while a counted listing has more to show", () => {
    vi.mocked(useRegistryModels).mockReturnValue(
      page(50, 20) as unknown as ReturnType<typeof useRegistryModels>,
    );

    renderTable();

    expect(
      screen.getByTestId("registry-models-next").hasAttribute("disabled"),
    ).toBe(false);
  });
});
