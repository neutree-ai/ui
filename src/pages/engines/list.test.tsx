import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnginesList } from "@/pages/engines/list";

const { useListMock, goMock } = vi.hoisted(() => ({
  useListMock: vi.fn(),
  goMock: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: useListMock,
  useGo: () => goMock,
  useParsed: () => ({ params: { workspace: "design-lab" } }),
}));

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

// The card has its own test; here it stands in for the contract the page owns —
// one card per engine, and a version pick that has to navigate with `?version=`.
vi.mock("./components/EngineCard", () => ({
  EngineCard: ({
    engine,
    onSelectVersion,
  }: {
    engine: { metadata: { name: string } };
    onSelectVersion: (version: string) => void;
  }) => (
    <div data-testid="engine-card" data-name={engine.metadata.name}>
      <button type="button" onClick={() => onSelectVersion("v9.9.9")}>
        pick {engine.metadata.name}
      </button>
    </div>
  ),
}));

const engine = (name: string, phase?: string) => ({
  id: name,
  metadata: { name, workspace: "design-lab" },
  spec: { versions: [{ version: "v1.0.0", values_schema: {} }] },
  status: phase ? { phase } : undefined,
});

const listReturns = ({ engines = [] as unknown[], isLoading = false } = {}) => {
  useListMock.mockReturnValue({ data: { data: engines }, isLoading });
};

const cardNames = () =>
  screen.getAllByTestId("engine-card").map((card) => card.dataset.name);

describe("EnginesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReturns();
  });

  it("shows the loader while the engines are still loading", () => {
    listReturns({ isLoading: true });

    render(<EnginesList />);

    expect(screen.getByTitle("Loading...")).toBeTruthy();
    expect(screen.queryAllByTestId("engine-card")).toHaveLength(0);
  });

  it("asks for the page's workspace and polls, so a deleted engine's card goes", () => {
    render(<EnginesList />);

    expect(useListMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "engines",
        meta: { workspace: "design-lab" },
        queryOptions: expect.objectContaining({ enabled: true }),
      }),
    );
  });

  it("shows the empty state when the workspace has no engines", () => {
    render(<EnginesList />);

    expect(screen.getByText("engines.list.empty")).toBeTruthy();
  });

  it("renders one card per engine", () => {
    listReturns({ engines: [engine("vllm"), engine("sglang")] });

    render(<EnginesList />);

    expect(cardNames()).toEqual(["sglang", "vllm"]);
  });

  it("filters the grid by name as the search box is used", () => {
    listReturns({ engines: [engine("vllm"), engine("sglang")] });

    render(<EnginesList />);
    fireEvent.change(
      screen.getByPlaceholderText("engines.list.searchPlaceholder"),
      { target: { value: "VLL" } },
    );

    expect(cardNames()).toEqual(["vllm"]);
  });

  it("puts a broken engine first and hides a steady phase behind the rest", () => {
    listReturns({
      engines: [
        engine("a-created", "Created"),
        engine("b-failed", "Failed"),
        engine("c-pending", "Pending"),
        engine("d-created", "Created"),
        engine("e-deleted", "Deleted"),
        // No phase at all is the state right after creation; it sorts as Created.
        engine("f-unknown"),
      ],
    });

    render(<EnginesList />);

    expect(cardNames()).toEqual([
      "b-failed",
      "c-pending",
      "e-deleted",
      "a-created",
      "d-created",
      "f-unknown",
    ]);
  });

  it("opens the version that was picked, inside the page's workspace", () => {
    listReturns({ engines: [engine("vllm")] });

    render(<EnginesList />);
    fireEvent.click(screen.getByRole("button", { name: "pick vllm" }));

    expect(goMock).toHaveBeenCalledWith({
      to: "/design-lab/engines/show/vllm",
      query: { version: "v9.9.9" },
      type: "push",
    });
  });
});
