import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import PermissionsTreeField from "./PermissionsTreeField";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.actions ? `${key}:${options.actions}` : key,
  }),
}));

/** Mirrors how the role form drives the field: value comes back as state. */
const ControlledField = ({ initialValue }: { initialValue: string[] }) => {
  const [value, setValue] = useState(initialValue);
  return (
    <TooltipProvider>
      <PermissionsTreeField value={value} onChange={setValue} />
      <div data-testid="value">{[...value].sort().join(",")}</div>
    </TooltipProvider>
  );
};

describe("PermissionsTreeField", () => {
  it("NEU-674: backfills missing dependencies of a push-only role and reports them", () => {
    render(<ControlledField initialValue={["model:push"]} />);

    expect(screen.getByTestId("value").textContent).toBe(
      "model:push,model:read,model_registry:read",
    );
    expect(
      screen.getByTestId("permission-backfill-notice").textContent,
    ).toContain("models.title:permissions.read");
  });

  it("leaves a complete permission set untouched and shows no notice", () => {
    render(
      <ControlledField
        initialValue={["model:push", "model:read", "model_registry:read"]}
      />,
    );

    expect(screen.getByTestId("value").textContent).toBe(
      "model:push,model:read,model_registry:read",
    );
    expect(screen.queryByTestId("permission-backfill-notice")).toBeNull();
  });
});
