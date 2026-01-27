import type { EndpointSpec } from "@/types";

export default function EndpointModel({
  model,
}: {
  model: EndpointSpec["model"];
}) {
  return (
    <div>{model.version ? `${model.name}:${model.version}` : model.name}</div>
  );
}
