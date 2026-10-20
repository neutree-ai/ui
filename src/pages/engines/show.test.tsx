import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnginesShow } from "@/pages/engines/show";

const { useShowMock, searchParamsMock } = vi.hoisted(() => ({
  useShowMock: vi.fn(),
  searchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@refinedev/core", () => ({ useShow: useShowMock }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [searchParamsMock()],
}));

vi.mock("@/foundation/components/ShowPage", () => {
  const ShowPage = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  ShowPage.ObjectHeader = ({
    title,
    status,
    description,
  }: {
    title: ReactNode;
    status?: ReactNode;
    description?: ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <div data-testid="object-header-status">{status}</div>
      <div>{description}</div>
    </header>
  );
  ShowPage.Meta = ({
    label,
    children,
  }: {
    label: ReactNode;
    children: ReactNode;
  }) => <span data-testid={`meta-${String(label)}`}>{children}</span>;
  ShowPage.Section = ({
    title,
    description,
    children,
  }: {
    title?: ReactNode;
    description?: ReactNode;
    children: ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <div data-testid={`section-description-${String(title)}`}>
        {description}
      </div>
      {children}
    </section>
  );
  ShowPage.Row = ({
    title,
    children,
  }: {
    title?: ReactNode;
    children: ReactNode;
  }) => <div data-testid={`row-${String(title)}`}>{children}</div>;
  return { ShowPage };
});

vi.mock("@/foundation/components/MetadataTimestampMeta", () => ({
  MetadataTimestampMeta: () => <span data-testid="created-at" />,
}));

// The app's Link goes through refine's router context; the page only decides
// where a version points, so the stub keeps the anchor contract it passes down.
vi.mock("@/foundation/components/Link", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/domains/engine/components/EngineStatus", () => ({
  default: ({ phase }: { phase?: string }) => (
    <span data-testid="engine-status">{phase}</span>
  ),
}));

vi.mock("@/domains/engine/components/ValueSchemaTable", () => ({
  ValueSchemaTable: ({ schema }: { schema: unknown }) => (
    <div data-testid="schema">{JSON.stringify(schema)}</div>
  ),
}));

const engineWith = (
  versions: Array<{ version: string; values_schema: unknown }>,
  phase?: string,
) => ({
  metadata: { name: "vllm", workspace: "design-lab" },
  spec: { versions, supported_tasks: ["text-generation", "text-embedding"] },
  status: phase ? { phase } : undefined,
});

const showReturns = (data: unknown, isLoading = false) =>
  useShowMock.mockReturnValue({
    query: { data: data ? { data } : undefined, isLoading },
  });

const schemaOf = (version: string) => ({ title: `schema ${version}` });

const versionLinks = () =>
  screen.queryAllByRole("link").map((link) => ({
    href: link.getAttribute("href"),
    current: link.getAttribute("aria-current"),
    text: link.textContent,
  }));

describe("EnginesShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("shows the loader while the engine is loading", () => {
    showReturns(undefined, true);

    render(<EnginesShow />);

    expect(screen.getByTitle("Loading...")).toBeTruthy();
  });

  it("says the engine was not found when the query comes back empty", () => {
    showReturns(undefined);

    render(<EnginesShow />);

    expect(screen.getByText("pages.error.notFound")).toBeTruthy();
  });

  it("names the only version instead of drawing a one-item list", () => {
    showReturns(
      engineWith([{ version: "v0.3.7", values_schema: schemaOf("v0.3.7") }]),
    );

    render(<EnginesShow />);

    expect(versionLinks()).toHaveLength(0);
    expect(
      screen.getByTestId("section-description-common.fields.versions")
        .textContent,
    ).toBe("v0.3.7");
    expect(screen.getByTestId("schema").textContent).toContain("schema v0.3.7");
  });

  it("defaults to the newest version, not the first one in the array", () => {
    showReturns(
      engineWith([
        { version: "v0.8.5", values_schema: schemaOf("v0.8.5") },
        { version: "v0.24.0", values_schema: schemaOf("v0.24.0") },
        { version: "v0.9.0-rc1", values_schema: schemaOf("v0.9.0-rc1") },
      ]),
    );

    render(<EnginesShow />);

    expect(versionLinks().map((link) => link.href)).toEqual([
      "/design-lab/engines/show/vllm?version=v0.24.0",
      "/design-lab/engines/show/vllm?version=v0.9.0-rc1",
      "/design-lab/engines/show/vllm?version=v0.8.5",
    ]);
    expect(versionLinks()[0].current).toBe("true");
    expect(versionLinks()[0].text).toContain("engines.versions.latest");
    expect(screen.getByTestId("schema").textContent).toContain(
      "schema v0.24.0",
    );
  });

  it("honours ?version= and falls back to the newest for one it does not know", () => {
    const versions = [
      { version: "v0.8.5", values_schema: schemaOf("v0.8.5") },
      { version: "v0.24.0", values_schema: schemaOf("v0.24.0") },
    ];
    showReturns(engineWith(versions));
    searchParamsMock.mockReturnValue(new URLSearchParams("version=v0.8.5"));

    const { unmount } = render(<EnginesShow />);

    expect(screen.getByTestId("schema").textContent).toContain("schema v0.8.5");
    expect(versionLinks()[1].current).toBe("true");
    unmount();

    searchParamsMock.mockReturnValue(new URLSearchParams("version=v9.9.9"));
    render(<EnginesShow />);

    expect(screen.getByTestId("schema").textContent).toContain(
      "schema v0.24.0",
    );
    expect(versionLinks()[0].current).toBe("true");
  });

  it("shows a status badge only for a phase that needs attention", () => {
    showReturns(
      engineWith([{ version: "v1.0.0", values_schema: {} }], "Failed"),
    );

    const { unmount } = render(<EnginesShow />);

    expect(screen.getByTestId("engine-status").textContent).toBe("Failed");
    unmount();

    showReturns(
      engineWith([{ version: "v1.0.0", values_schema: {} }], "Created"),
    );
    render(<EnginesShow />);

    expect(screen.queryByTestId("engine-status")).toBeNull();
  });

  it("counts versions and supported tasks in the header and lists the tasks", () => {
    showReturns(
      engineWith([
        { version: "v1.0.0", values_schema: {} },
        { version: "v1.1.0", values_schema: {} },
      ]),
    );

    render(<EnginesShow />);

    expect(screen.getByTestId("meta-common.fields.versions").textContent).toBe(
      "2",
    );
    expect(
      screen.getByTestId("meta-engines.fields.supportedTasks").textContent,
    ).toBe("2");
    expect(screen.getByText("text-generation")).toBeTruthy();
    expect(screen.getByText("text-embedding")).toBeTruthy();
    expect(screen.getByTestId("created-at")).toBeTruthy();
  });

  it("renders an engine that declares no versions at all", () => {
    showReturns({
      metadata: { name: "bare", workspace: "design-lab" },
      spec: {},
    });

    render(<EnginesShow />);

    expect(screen.getByTestId("meta-common.fields.versions").textContent).toBe(
      "0",
    );
    expect(versionLinks()).toHaveLength(0);
    expect(screen.queryByTestId("schema")).toBeNull();
  });
});
