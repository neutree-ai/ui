import type { EndpointSpec } from "@/domains/endpoint/types";
import { ShowButton } from "@/foundation/components/ShowButton";
import { registryModelQuery } from "@/foundation/lib/registry-model-link";

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
  if (!model) {
    return <span className="text-muted-foreground">-</span>;
  }

  const nameWithVersion = model.version
    ? `${model.name}:${model.version}`
    : model.name;

  if (!workspace || !model.registry) {
    return <div>{nameWithVersion}</div>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <ShowButton
        recordItemId={model.registry}
        meta={{ workspace }}
        variant="link"
        resource="model_registries"
      >
        {model.registry}
      </ShowButton>
      <span className="text-muted-foreground">/</span>
      <ShowButton
        recordItemId={model.registry}
        meta={{
          workspace,
          query: registryModelQuery({
            model: model.name,
            version: model.version,
          }),
        }}
        variant="link"
        resource="model_registries"
      >
        {nameWithVersion}
      </ShowButton>
    </span>
  );
}
