import type {
  ImageRegistry,
  ImageRegistrySpec,
} from "@/domains/image-registry/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

/** The registry URL with the repository appended, one slash between them. */
export const repositoryUrl = ({ url, repository }: ImageRegistrySpec) => {
  const path = repository?.trim();
  return path ? `${url.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : url;
};

export const imageRegistryConfigFields: DetailField<ImageRegistry>[] = [
  field("image_registries.fields.repo", (registry) =>
    repositoryUrl(registry.spec),
  ),
];
