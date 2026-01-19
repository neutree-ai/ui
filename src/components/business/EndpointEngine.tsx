import type { EndpointEngineSpec, Metadata } from "@/types";
import { ShowButton } from "../theme";

interface EndpointEngineProps {
  spec: { engine: EndpointEngineSpec };
  metadata: Metadata;
}

export default function EndpointEngine({
  spec,
  metadata,
}: EndpointEngineProps) {
  const { engine } = spec;
  return (
    <ShowButton
      recordItemId={engine.engine}
      meta={{
        workspace: metadata.workspace,
        query: {
          version: engine.version,
        },
      }}
      variant="link"
      resource="engines"
    >
      {engine.engine}:{engine.version}
    </ShowButton>
  );
}
