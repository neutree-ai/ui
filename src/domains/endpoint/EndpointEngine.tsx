import { ShowButton } from "@/foundation/components/ShowButton";
import type { Metadata } from "@/foundation/types/basic-types";
import type { EndpointEngineSpec } from "@/foundation/types/serving-types";
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
