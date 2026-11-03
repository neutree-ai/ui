import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, it, vi } from "vitest";
import type { ModelCatalog } from "@/domains/model-catalog/types";

const catalog = {
  metadata: { name: "catalog-a", workspace: "workspace-a" },
  spec: {
    model: null,
    engine: null,
    resources: null,
    replicas: null,
    deployment_options: null,
    variables: { engine_args: { max_model_len: 32768 } },
    env: null,
  },
} as unknown as ModelCatalog;

// The page imports @refinedev/react-table transitively; its ESM build fails to
// resolve `lodash/isEqual` under vitest, and nothing here renders a data table.
vi.mock("@refinedev/react-table", () => ({ useTable: vi.fn() }));

vi.mock("@refinedev/core", () => ({
  useShow: () => ({ query: { data: { data: catalog }, isLoading: false } }),
}));

// ShowPage reads Refine's router context; render its slots as plain markup.
vi.mock("@/foundation/components/ShowPage", () => {
  const Slot = ({
    title,
    children,
  }: {
    title?: ReactNode;
    children?: ReactNode;
  }) => (
    <section>
      {title}
      {children}
    </section>
  );
  return {
    ShowPage: Object.assign(Slot, {
      ObjectHeader: Slot,
      Meta: Slot,
      Row: Slot,
      Section: Slot,
    }),
  };
});

import { ModelCatalogsShow } from "./show";

describe("ModelCatalogsShow", () => {
  it("lists the catalog's engine arguments in the advanced table", () => {
    render(<ModelCatalogsShow />);

    screen.getByText("endpoints.sections.advancedOptions");
    screen.getByRole("cell", { name: "max_model_len" });
  });
});
