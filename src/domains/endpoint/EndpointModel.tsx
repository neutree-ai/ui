import type { EndpointSpec } from "@/foundation/types";

export default function EndpointModel({
  model,
}: {
  model: EndpointSpec["model"];
}) {
  return (
    <div>{model.version ? `${model.name}:${model.version}` : model.name}</div>
  );
}
