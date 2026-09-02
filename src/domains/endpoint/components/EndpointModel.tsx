import type { EndpointSpec } from "@/domains/endpoint/types";

export default function EndpointModel({
  model,
}: {
  model: EndpointSpec["model"];
}) {
  // A Flex endpoint serves a workload Neutree neither fetches nor names, so it
  // has no model to show. Same empty state as ModelTask, rather than a blank.
  if (!model) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div>{model.version ? `${model.name}:${model.version}` : model.name}</div>
  );
}
