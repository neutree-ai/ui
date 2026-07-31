import { ShowButton } from "@/foundation/components/ShowButton";
import type { Metadata } from "@/foundation/types/basic-types";
import type { EndpointEngineSpec } from "@/foundation/types/serving-types";

interface EndpointEngineProps {
  spec: { engine?: EndpointEngineSpec | null };
  metadata: Metadata;
}

export default function EndpointEngine({
  spec,
  metadata,
}: EndpointEngineProps) {
  const { engine } = spec;
  // A catalog can reach the UI without an engine — a recipe that omits it, or a
  // spec a user saved in a broken shape. Render a placeholder rather than
  // throwing: this sits inside list cards, where one bad record would otherwise
  // take down the whole page.
  if (!engine?.engine) {
    return <span className="text-muted-foreground">-</span>;
  }
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
