import { render, screen } from "@testing-library/react";
import { describe, it } from "vitest";
import { RegistryVisibility } from "./RegistryVisibility";

describe("RegistryVisibility", () => {
  it("names the visibility the server reported", () => {
    render(<RegistryVisibility visibility="public" />);

    screen.getByText("model_registries.visibility.public");
  });

  it("renders an unknown visibility without inventing a value", () => {
    render(<RegistryVisibility visibility={undefined} />);

    screen.getByText("-");
  });
});
