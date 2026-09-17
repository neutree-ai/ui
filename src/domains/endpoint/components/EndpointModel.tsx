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

  // The version is not shown: most are ids the registry generated, which mean
  // nothing to a reader, and the registry page is where versions are told
  // apart (NEU-771).
  return <div>{model.name}</div>;
}
