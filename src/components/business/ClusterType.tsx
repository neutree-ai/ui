import type { ClusterSpec } from "@/types";

export default function ClusterType({ type }: { type: ClusterSpec["type"] }) {
	return (
		<div className="flex gap-1 items-center">
			{/* <img
                            className="w-6 h-6"
                            src={
                              value === "local"
                                ? "https://cdn.worldvectorlogo.com/logos/docker-4.svg"
                                : "https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Kubernetes_logo_without_workmark.svg/2109px-Kubernetes_logo_without_workmark.svg.png"
                            }
                          /> */}
			<div>{type}</div>
		</div>
	);
}
