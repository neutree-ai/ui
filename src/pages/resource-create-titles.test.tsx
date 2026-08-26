import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/foundation/lib/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/foundation/components/ResourceForm", () => ({
  ResourceForm: ({
    title,
    children,
  }: {
    title?: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/domains/external-endpoint/hooks/use-external-endpoint-form", () => ({
  useExternalEndpointForm: () => ({
    form: {},
    metadataFields: <div>External metadata</div>,
    specFields: <div>External spec</div>,
  }),
}));

vi.mock("@/domains/image-registry/hooks/use-image-registry-form", () => ({
  useImageRegistryForm: () => ({
    form: {},
    metadataFields: <div>Image metadata</div>,
    specFields: <div>Image spec</div>,
  }),
}));

import { ExternalEndpointsCreate } from "./external-endpoints/create";
import { ImageRegistriesCreate } from "./image-registries/create";

describe("resource create page titles", () => {
  it("labels the external endpoint create page", () => {
    render(<ExternalEndpointsCreate />);
    expect(screen.getByRole("heading").textContent).toBe(
      "external_endpoints.create",
    );
  });

  it("labels the image registry create page", () => {
    render(<ImageRegistriesCreate />);
    expect(screen.getByRole("heading").textContent).toBe(
      "image_registries.create.title",
    );
  });
});
