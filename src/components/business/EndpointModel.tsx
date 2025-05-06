import type { EndpointSpec } from "@/types";

export default function EndpointModel({
  model,
}: {
  model: EndpointSpec["model"];
}) {
  return <div>{`${model.name}:${model.version}`}</div>;
}
