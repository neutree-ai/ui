import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const permission = vi.hoisted(() => ({
  allowed: undefined as boolean | undefined,
}));

vi.mock("@/foundation/hooks/use-has-permission", () => ({
  useHasGlobalPermission: (name: string) => ({
    allowed: name === "log_sink:create" ? permission.allowed : false,
    isLoading: permission.allowed === undefined,
  }),
}));

vi.mock("@/foundation/scene/ListPage", () => ({
  ListPage: ({
    canCreate,
    createButtonProps,
  }: {
    canCreate?: boolean;
    createButtonProps?: { children?: React.ReactNode };
  }) =>
    canCreate ? (
      <button type="button">{createButtonProps?.children}</button>
    ) : null,
}));

vi.mock("@/foundation/scene/Table", () => ({ Table: () => null }));

vi.mock("@/foundation/scene/metadata-columns", () => ({
  useMetadataColumns: () => ({ name: null }),
}));

vi.mock("@/domains/log-sink/hooks/use-log-sink-delete-confirmation", () => ({
  useLogSinkDeleteConfirmation: () => () => undefined,
}));

vi.mock("@/foundation/components/AppBreadcrumbs", () => ({
  AppBreadcrumbs: () => null,
}));

import { LogSinksList } from "./list";

const addButton = () =>
  screen.queryByRole("button", { name: "log_sinks.buttons.addDestination" });

describe("LogSinksList create entry", () => {
  beforeEach(() => {
    permission.allowed = undefined;
  });

  it("offers Add destination with a global log_sink:create grant", () => {
    permission.allowed = true;
    render(<LogSinksList />);
    expect(addButton()).not.toBeNull();
  });

  it("hides Add destination without the grant and while it is being checked", () => {
    permission.allowed = false;
    const { rerender } = render(<LogSinksList />);
    expect(addButton()).toBeNull();

    permission.allowed = undefined;
    rerender(<LogSinksList />);
    expect(addButton()).toBeNull();
  });
});
