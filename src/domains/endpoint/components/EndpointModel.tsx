import { endpointModelRef } from "@/domains/endpoint/lib/endpoint-display-model";
import type { EndpointSpec } from "@/domains/endpoint/types";
import { registryModelQuery } from "@/foundation/model-reference/registry-model-link";
import { ShowButton } from "@/foundation/scene/ShowButton";
import { EmptyValue } from "@/foundation/type/EmptyValue";

export default function EndpointModel({
  model,
  workspace,
}: {
  model: EndpointSpec["model"];
  /** When given, the registry and the model link to their detail pages. */
  workspace?: string | null;
}) {
  // A Flex endpoint serves a workload Neutree neither fetches nor names, so it
  // has no model to show. Same empty state as ModelTask, rather than a blank.
  const ref = endpointModelRef(model);
  if (!ref) {
    return <EmptyValue />;
  }

  if (!workspace || !ref.registry) {
    return <div>{ref.label}</div>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <ShowButton
        recordItemId={ref.registry}
        meta={{ workspace }}
        variant="link"
        resource="model_registries"
      >
        {ref.registry}
      </ShowButton>
      <span className="text-muted-foreground">/</span>
      <ShowButton
        recordItemId={ref.registry}
        meta={{
          workspace,
          query: registryModelQuery({ model: ref.name, version: ref.version }),
        }}
        variant="link"
        resource="model_registries"
      >
        {ref.label}
      </ShowButton>
    </span>
  );
}
