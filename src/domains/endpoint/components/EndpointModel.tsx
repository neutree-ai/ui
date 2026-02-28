import type { EndpointSpec } from "@/domains/endpoint/types";
export default function EndpointModel({
  model,
}: {
  model: EndpointSpec["model"];
}) {
  return (
    <div>{model.version ? `${model.name}:${model.version}` : model.name}</div>
  );
}
