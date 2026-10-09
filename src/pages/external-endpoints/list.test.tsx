import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@/foundation/components/ListPage", () => ({
  ListPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/foundation/components/metadata-columns", () => ({
  useMetadataColumns: () => ({
    name: null,
    workspace: null,
    creation_timestamp: null,
    action: null,
  }),
}));

// The list's machinery is not what this file is about, so it is stubbed down to
// the one decision the page itself makes: what a row puts in the Models cell.
// The stub keeps the real contract (`Table.Column` receives `cell`, called with
// `getValue()`), so the column definition under test is the page's own.
const state = vi.hoisted(() => ({ spec: null as unknown }));

vi.mock("@/foundation/components/Table", () => {
  const Table = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  Table.Column = ({
    id,
    cell,
  }: {
    id?: string;
    cell?: (context: { getValue: () => unknown }) => ReactNode;
  }) => (
    <div data-testid={`cell-${id}`}>
      {cell ? cell({ getValue: () => state.spec }) : null}
    </div>
  );
  return { Table, defaultSorters: { initial: [] } };
});

vi.mock(
  "@/domains/external-endpoint/components/ExternalEndpointStatus",
  () => ({
    default: () => null,
  }),
);

import { ExternalEndpointsList } from "./list";

function renderModelsCell(spec: unknown) {
  state.spec = spec;
  render(<ExternalEndpointsList />);
  return screen.getByTestId("cell-models");
}

describe("ExternalEndpointsList", () => {
  it("leaves the chip off a model nobody has labelled", () => {
    // The source is decoration here — the Models cell already names the model,
    // and an "Unspecified" chip on every unlabelled row is noise.
    const cell = renderModelsCell({
      upstreams: [
        {
          name: "primary",
          upstream: { url: "https://api.example.com" },
          model_mapping: { "gpt-6-astra": "gpt-6" },
        },
      ],
    });
    expect(within(cell).getByText("gpt-6-astra")).toBeTruthy();
    expect(within(cell).queryByText("modelSource.unspecified")).toBeNull();
  });

  it("still shows the label an endpoint has actually stored", () => {
    const cell = renderModelsCell({
      upstreams: [
        {
          name: "primary",
          upstream: { url: "https://api.example.com" },
          model_mapping: { "gpt-6-astra": "gpt-6" },
        },
      ],
      model_sources: { "gpt-6-astra": "third-party-public" },
    });
    expect(within(cell).getByText("third-party-public")).toBeTruthy();
  });

  it("renders a placeholder when the endpoint exposes no models", () => {
    const cell = renderModelsCell({ upstreams: [] });
    expect(cell.textContent).toBe("-");
  });
});
