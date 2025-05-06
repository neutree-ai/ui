import type { Engine, EngineVersion } from "@/types";

export default function EngineVersions({
	versions,
}: Pick<Engine["spec"], "versions">) {
	return (
		<div className="flex gap-1 items-center">
			{versions.map((v: EngineVersion) => v.version).join(",")}
		</div>
	);
}
