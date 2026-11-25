import ModelRegistryType from "@/domains/model-registry/components/ModelRegistryType";
import { RegistryUrl } from "@/domains/model-registry/components/RegistryUrl";
import { RegistryVisibility } from "@/domains/model-registry/components/RegistryVisibility";
import type { ModelRegistry } from "@/domains/model-registry/types";
import { type DetailField, field } from "@/foundation/scene/detail-field";

export const modelRegistryHeaderFields: DetailField<ModelRegistry>[] = [
  field("common.fields.type", {
    render: (registry) => <ModelRegistryType type={registry.spec.type} />,
  }),
  field("model_registries.fields.visibility", {
    render: (registry) => (
      <RegistryVisibility visibility={registry.visibility} />
    ),
  }),
  field("model_registries.fields.url", {
    render: (registry) => <RegistryUrl url={registry.spec.url} />,
  }),
];
