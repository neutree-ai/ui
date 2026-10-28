import { render, screen } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnginesShow } from "@/pages/engines/show";

const { useShowMock, searchParamsMock } = vi.hoisted(() => ({
  useShowMock: vi.fn(),
  searchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("@refinedev/core", () => ({ useShow: useShowMock }));
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

// Local state stands in for the table's search and filters, which must not
// carry over from one version to the next.
vi.mock("@/domains/engine/components/ValueSchemaTable", () => ({
  ValueSchemaTable: ({ schema }: { schema: unknown }) => {
    const [mountedWith] = useState(() => JSON.stringify(schema));
    return (
      <div data-testid="schema" data-mounted-with={mountedWith}>
        {JSON.stringify(schema)}
      </div>
    );
  },
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
const versionsOf = (...names: string[]) =>
  names.map((version) => ({ version, values_schema: schemaOf(version) }));

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

    screen.getByTitle("Loading...");
  });

  it("says the engine was not found when the query comes back empty", () => {
    showReturns(undefined);

    render(<EnginesShow />);

    screen.getByText("pages.error.notFound");
  });

  it("names the only version instead of drawing a one-item list", () => {
    showReturns(engineWith(versionsOf("v0.3.7")));

    render(<EnginesShow />);

    expect(versionLinks()).toHaveLength(0);
    expect(
      screen.getByTestId("section-description-common.fields.versions")
        .textContent,
    ).toBe("v0.3.7");
    expect(screen.getByTestId("schema").textContent).toContain("schema v0.3.7");
  });

  it("defaults to the newest version, not the first one in the array", () => {
    showReturns(engineWith(versionsOf("v0.8.5", "v0.24.0", "v0.9.0-rc1")));

    render(<EnginesShow />);

    const [newest] = versionLinks();
    expect(newest.href).toBe("/design-lab/engines/show/vllm?version=v0.24.0");
    expect(newest.current).toBe("true");
    expect(newest.text).toContain("engines.versions.latest");
    expect(screen.getByTestId("schema").textContent).toContain(
      "schema v0.24.0",
    );
  });

  it("honours ?version= and falls back to the newest for one it does not know", () => {
    showReturns(engineWith(versionsOf("v0.8.5", "v0.24.0")));
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

  it("starts the schema table afresh when the version changes", () => {
    showReturns(engineWith(versionsOf("v0.8.5", "v0.24.0")));
    searchParamsMock.mockReturnValue(new URLSearchParams("version=v0.8.5"));

    const { rerender } = render(<EnginesShow />);

    searchParamsMock.mockReturnValue(new URLSearchParams("version=v0.24.0"));
    rerender(<EnginesShow />);

    expect(
      screen.getByTestId("schema").getAttribute("data-mounted-with"),
    ).toContain("schema v0.24.0");
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
    screen.getByText("text-generation");
    screen.getByText("text-embedding");
    screen.getByTestId("created-at");
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
