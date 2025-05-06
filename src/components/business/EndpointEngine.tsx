import type { Endpoint } from "@/types";
import { ShowButton } from "../theme";

export default function EndpointEngine({ spec, metadata }: Endpoint) {
	const { engine } = spec;
	return (
		<ShowButton
			recordItemId={engine.engine}
			meta={{
				workspace: metadata.workspace,
			}}
			variant="link"
			resource="engines"
		>
			{engine.engine}:{engine.version}
		</ShowButton>
	);
}
