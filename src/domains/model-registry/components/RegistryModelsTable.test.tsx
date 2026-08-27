import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canPageForward,
  RegistryModelsTable,
} from "@/domains/model-registry/components/RegistryModelsTable";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { useRegistryModels } from "@/foundation/hooks/use-registry-models";
import {
  RegistryModelError,
  type RegistryModelPage,
} from "@/foundation/lib/api/registry-models";
import type { ModelRegistryVisibility } from "@/foundation/lib/model-registry-visibility";
import type { RegistryModel } from "@/foundation/types/model-types";

vi.mock("@/foundation/hooks/use-registry-models", () => ({
  useRegistryModels: vi.fn(),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(",")}` : key,
  }),
}));

type Call = {
  workspace?: string | null;
  registry?: string | null;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
};

const calls: Call[] = [];

const registry = (overrides: {
  visibility?: ModelRegistryVisibility;
  phase?: string;
  deletionTimestamp?: string | null;
}): ModelRegistry =>
  ({
    id: 1,
    api_version: "v1",
    kind: "ModelRegistry",
    metadata: {
      name: "reg",
      workspace: "default",
      deletion_timestamp: overrides.deletionTimestamp ?? null,
      creation_timestamp: "2026-01-01T00:00:00Z",
      update_timestamp: "2026-01-01T00:00:00Z",
      labels: {},
      annotations: {},
    },
    spec: { type: "hugging-face", url: "https://huggingface.co" },
    status: { phase: overrides.phase ?? "Connected", stats: null },
    visibility: overrides.visibility,
  }) as unknown as ModelRegistry;

const models = (count: number): RegistryModel[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `model-${index}`,
    versions: [{ name: "v1", creation_time: "2026-01-01T00:00:00Z" }],
  })) as unknown as RegistryModel[];

/** Answers every call with one page, recording what was asked for. */
const answerWith = (
  build: (call: Call) => {
    page: RegistryModelPage | null;
    isLoading?: boolean;
    isFetching?: boolean;
    error?: RegistryModelError | null;
  },
) => {
  vi.mocked(useRegistryModels).mockImplementation(((call: Call) => {
    calls.push(call);
    const result = build(call);

    return {
      page: result.page,
      models: result.page?.models ?? [],
      total: result.page?.total ?? null,
      isLoading: result.isLoading ?? false,
      isFetching: result.isFetching ?? false,
      error: result.error ?? null,
      refetch: vi.fn(),
    };
  }) as unknown as typeof useRegistryModels);
};

/** A page as the API layer builds one: rows, the total the server reported, and
 * the limit this page was fetched with. `limit` defaults to the component's first
 * window, which is what an untouched table asks for. */
const page = (
  rows: number,
  total: number | null,
  options?: {
    limit?: number;
    freshness?: { timestamp: string | null; cached: boolean };
  },
): RegistryModelPage => ({
  models: models(rows),
  total,
  limit: options?.limit ?? 20,
  freshness: options?.freshness ?? { timestamp: null, cached: false },
});

const renderTable = (
  reg: ModelRegistry,
  onModelSelect: (model: string, version: string) => void = vi.fn(),
) =>
  render(
    <RegistryModelsTable
      workspace="default"
      registry={reg}
      onModelSelect={onModelSelect}
    />,
  );

beforeEach(() => {
  calls.length = 0;
  vi.mocked(useRegistryModels).mockReset();
});

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

describe("paging follows what the registry can do", () => {
  it("offers numbered paging when the server counted the matches", () => {
    answerWith(() => ({ page: page(20, 57) }));

    renderTable(registry({ visibility: "private" }));

    expect(screen.getByText("table.pagination.totalItems:57")).toBeDefined();
    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
    expect(
      screen.getByTestId("registry-models-next").hasAttribute("disabled"),
    ).toBe(false);
  });

  it("disables Next at the end of a counted listing without changing mode", () => {
    answerWith(() => ({ page: page(20, 40) }));

    renderTable(registry({ visibility: "private" }));

    // Two pages of twenty, so the first one has a next.
    expect(
      screen.getByTestId("registry-models-next").hasAttribute("disabled"),
    ).toBe(false);

    fireEvent.click(screen.getByTestId("registry-models-next"));

    expect(calls[calls.length - 1].offset).toBe(20);
    // Where the two predicates disagree: the registry can still be paged, there
    // is just nothing further to reach. A disabled Next, not a switch to
    // "show more".
    expect(
      screen.getByTestId("registry-models-next").hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
  });

  it("offers no next page when the server cannot count, only a wider one", () => {
    // The refusal this avoids is real: `offset > 0` on a registry that answers
    // `Content-Range: 0-19/*` is a 400. A next-page button here is a button
    // whose only outcome is an error.
    answerWith(() => ({ page: page(20, null) }));

    renderTable(registry({ visibility: "public" }));

    expect(
      screen.getByText("model_registries.models.totalUnknown"),
    ).toBeDefined();
    // Stronger than the assertion this replaces. The review finding on #367 was
    // that a Next the server answers with a 400 must not be clickable, and it
    // was fixed by disabling the button; there is now no Next at all, with a
    // widening control in its place.
    expect(screen.queryByTestId("registry-models-next")).toBeNull();
    expect(screen.getByTestId("registry-models-show-more")).toBeDefined();
  });

  it("widens the window instead of moving it, and never sends an offset", () => {
    answerWith((call) => ({
      page: page(call.limit ?? 20, null, { limit: call.limit }),
    }));

    renderTable(registry({ visibility: "public" }));
    fireEvent.click(screen.getByTestId("registry-models-show-more"));

    const last = calls[calls.length - 1];
    expect(last.limit).toBe(40);
    expect(last.offset).toBe(0);
    expect(calls.every((call) => (call.offset ?? 0) === 0)).toBe(true);
  });

  it("does not decide from the registry's type", () => {
    // Same `spec.type` in both directions; only the range header differs. A
    // registry whose provider answers with a total gets numbered paging even
    // though it is a hugging-face one.
    answerWith(() => ({ page: page(20, 100) }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.getByText("table.pagination.totalItems:100")).toBeDefined();
    expect(screen.getByTestId("registry-models-next")).toBeDefined();
    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
  });

  it("stops widening at the cap and says so instead of quietly capping", () => {
    answerWith((call) => ({
      page: page(call.limit ?? 20, null, { limit: call.limit }),
    }));

    renderTable(registry({ visibility: "public" }));

    for (let click = 0; click < 9; click += 1) {
      fireEvent.click(screen.getByTestId("registry-models-show-more"));
    }

    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
    expect(screen.getByTestId("registry-models-window-end").textContent).toBe(
      "model_registries.models.windowCapped:200",
    );
  });

  it("does not announce the end of the listing while a wider one is in flight", () => {
    // The bug this pins. `keepPreviousData` holds the previous 20 rows while 40
    // are being fetched, so anything comparing rows against the *requested*
    // window reads 20 >= 40 as "nothing more" and flashes "End of the listing"
    // through every widening.
    answerWith(() => ({
      page: page(20, null, { limit: 20 }),
      isFetching: true,
    }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.queryByTestId("registry-models-window-end")).toBeNull();
    // The control stays, disabled, rather than being replaced by a conclusion.
    expect(
      screen.getByTestId("registry-models-show-more").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("reports a failed widening as an error, never as the end of the listing", () => {
    // The worse half of the same bug: when the widening fails the held-over page
    // never catches up with the window, so the wrong conclusion stopped being a
    // flash and became permanent — a retryable error dressed as a settled fact.
    answerWith(() => ({
      page: page(20, null, { limit: 20 }),
      error: new RegistryModelError(500, {
        message: "failed to connect to model registry",
      }),
    }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.getByTestId("registry-models-error").textContent).toBe(
      "failed to connect to model registry",
    );
    expect(screen.queryByTestId("registry-models-window-end")).toBeNull();
    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
  });

  it("reports the end of a listing that ran short", () => {
    // A page that came back with fewer rows than it asked for. This is the only
    // end-of-list evidence an uncountable registry ever gives, and it is a fact
    // about the page in hand rather than about the window being requested.
    answerWith(() => ({ page: page(3, null, { limit: 20 }) }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.getByTestId("registry-models-window-end").textContent).toBe(
      "model_registries.models.listingEnd",
    );
    expect(screen.queryByTestId("registry-models-show-more")).toBeNull();
  });
});

describe("states", () => {
  it("opens model details from a row click or the keyboard", () => {
    answerWith(() => ({ page: page(1, 1) }));
    const onModelSelect = vi.fn();

    renderTable(registry({ visibility: "private" }), onModelSelect);
    const row = screen.getByTestId("registry-model-row-model-0:v1");

    fireEvent.click(row);
    fireEvent.keyDown(row, { key: "Enter" });

    expect(onModelSelect).toHaveBeenNthCalledWith(1, "model-0", "v1");
    expect(onModelSelect).toHaveBeenNthCalledWith(2, "model-0", "v1");
  });

  it("shows a loader while asking, and claims nothing about the total", () => {
    answerWith(() => ({ page: null, isLoading: true }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.getByTestId("registry-models-loading")).toBeDefined();
    expect(
      screen.queryByText("model_registries.models.totalUnknown"),
    ).toBeNull();
  });

  it("distinguishes an empty registry from a search that matched nothing", () => {
    answerWith(() => ({ page: page(0, 0) }));

    renderTable(registry({ visibility: "private" }));

    expect(screen.getByTestId("registry-models-empty")).toBeDefined();
    expect(screen.queryByTestId("registry-models-no-matches")).toBeNull();
  });

  it("does not ask an unreachable registry, and does not show a red error", () => {
    // The reason and the retry live in the notice above the table. Asking anyway
    // would add a 500 to a page that has already explained itself — the report
    // noise an air-gapped install must not have.
    answerWith(() => ({ page: null }));

    renderTable(registry({ visibility: "public", phase: "Failed" }));

    expect(calls[0].enabled).toBe(false);
    expect(screen.getByTestId("registry-models-unreachable")).toBeDefined();
    expect(screen.queryByTestId("registry-models-error")).toBeNull();
    expect(
      screen.getByTestId("registry-models-search").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("does not ask a registry that has been removed", () => {
    answerWith(() => ({ page: null }));

    renderTable(
      registry({
        visibility: "private",
        phase: "Connected",
        deletionTimestamp: "2026-02-02T00:00:00Z",
      }),
    );

    expect(calls[0].enabled).toBe(false);
    expect(screen.getByTestId("registry-models-disabled")).toBeDefined();
  });

  it("reports a listing failure in the server's own words", () => {
    answerWith(() => ({
      page: null,
      error: new RegistryModelError(429, {
        reason: "rate_limited",
        message: "the hub is rate limiting us",
      }),
    }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.getByTestId("registry-models-error").textContent).toBe(
      "the hub is rate limiting us",
    );
  });
});

describe("how old the rows are", () => {
  it("shows the moment the server read the registry", () => {
    answerWith(() => ({
      page: page(2, null, {
        freshness: { timestamp: "2026-08-10T04:29:19Z", cached: false },
      }),
    }));

    renderTable(registry({ visibility: "public" }));

    expect(
      screen.getByTestId("registry-models-data-age").textContent,
    ).toContain("model_registries.models.dataAsOf");
  });

  it("says so when the answer was replayed from the server's cache", () => {
    answerWith(() => ({
      page: page(2, null, {
        freshness: { timestamp: "2026-08-10T04:29:19Z", cached: true },
      }),
    }));

    renderTable(registry({ visibility: "public" }));

    expect(
      screen.getByTestId("registry-models-data-age").textContent,
    ).toContain("model_registries.models.dataAsOfCached");
  });

  it("says nothing when the response carried no timestamp", () => {
    answerWith(() => ({ page: page(2, null) }));

    renderTable(registry({ visibility: "public" }));

    expect(screen.queryByTestId("registry-models-data-age")).toBeNull();
  });
});
