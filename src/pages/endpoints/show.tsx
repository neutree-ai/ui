import {
	type IResourceComponentsProps,
	useList,
	useOne,
	useShow,
} from "@refinedev/core";
import { ShowButton, ShowPage } from "@/components/theme";
import type { Endpoint, Engine } from "@/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatPlayground from "@/components/business/ChatPlayground";
import EmbeddingPlayground from "@/components/business/EmbeddingPlayground";
import { getRayDashboardProxy } from "@/lib/api";
import MetadataCard from "@/components/business/MetadataCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EndpointStatus from "@/components/business/EndpointStatus";
import EndpointModel from "@/components/business/EndpointModel";
import EndpointEngine from "@/components/business/EndpointEngine";
import JSONSchemaValueVisualizer from "@/components/business/JsonSchemaValueVisualizer";
import Loader from "@/components/theme/components/loader";
import { useCallback, useRef } from "react";

const RayDashboardTab = ({ record }: { record: Endpoint }) => {
	const { data: clusterData, isLoading } = useList({
		resource: "clusters",
		filters: [
			{
				field: "metadata->name",
				operator: "eq",
				value: JSON.stringify(record.spec.cluster),
			},
		],
		queryOptions: {
			enabled: Boolean(record.spec.cluster),
		},
	});

	const iframeRef = useRef<HTMLIFrameElement>(null);

	const handleIframeLoad = useCallback(() => {
		const doc = iframeRef.current?.contentDocument;
		if (!doc) return;
		if (doc.getElementById("injected-style")) return;
		const style = doc.createElement("style");
		style.id = "injected-style";
		style.textContent = `
      nav > div:first-child {
        display: none !important;
      }
      .css-1snkach {
        padding-top: 37px;
      }
    `;
		doc.head.appendChild(style);
	}, []);

	if (isLoading) {
		return <Loader className="h-4 text-primary" />;
	}

	const rayDashboardUrl = getRayDashboardProxy(clusterData?.data[0]);

	if (!rayDashboardUrl) {
		return (
			<p>
				<span className="text-red-500">Ray dashboard is not available.</span>
			</p>
		);
	}

	return (
		<iframe
			src={`${rayDashboardUrl}#/serve/applications/${record.metadata.name}`}
			className="w-full h-full"
			onLoad={handleIframeLoad}
			ref={iframeRef}
			title="Ray Dashboard"
		/>
	);
};

export const EndpointsShow: React.FC<IResourceComponentsProps> = () => {
	const {
		query: { data, isLoading },
	} = useShow<Endpoint>();
	const record = data?.data;

	const { data: engineData } = useOne<Engine>({
		resource: "engines",
		id: record?.spec.engine.engine,
		queryOptions: {
			enabled: Boolean(record?.spec.engine.engine),
		},
	});

	const url = record?.status?.service_url ?? "";

	if (isLoading) {
		return <Loader className="h-4 text-primary" />;
	}

	if (!record) {
		return <div>404 not found</div>;
	}

	const engineVersionSchema = engineData?.data?.spec.versions.find(
		(v) => v.version === record.spec.engine.version,
	)?.values_schema;

	return (
		<ShowPage record={record}>
			<Tabs defaultValue="basic" className="h-full">
				<TabsList>
					<TabsTrigger value="basic">Basic</TabsTrigger>
					<TabsTrigger value="ray">Ray Dashboard</TabsTrigger>
					<TabsTrigger value="playground">Playground</TabsTrigger>
				</TabsList>
				<TabsContent
					value="basic"
					className="overflow-auto h-[calc(100%-theme('spacing.9'))]"
				>
					<MetadataCard metadata={record.metadata} />
					<Card className="mt-4">
						<CardContent>
							<div className="grid grid-cols-4 gap-8">
								<ShowPage.Row title={"Status"}>
									<EndpointStatus phase={record.status?.phase} />
								</ShowPage.Row>
								<ShowPage.Row
									title="Service URL"
									children={
										<a href={url} target="_blank" rel="noreferrer">
											<Button variant="link" className="p-0">
												{url}
											</Button>
										</a>
									}
								/>
							</div>
							<div className="grid grid-cols-4 gap-8">
								<ShowPage.Row title={"Cluster"}>
									<ShowButton
										recordItemId={record.spec.cluster}
										meta={{
											workspace: record.metadata.workspace,
										}}
										variant="link"
										resource="clusters"
									>
										{record.spec.cluster}
									</ShowButton>
								</ShowPage.Row>
								<ShowPage.Row title={"Engine"}>
									<EndpointEngine {...record} />
								</ShowPage.Row>
								<div className="col-span-2">
									<ShowPage.Row title={"Model"}>
										<EndpointModel model={record.spec.model} />
									</ShowPage.Row>
								</div>
							</div>
						</CardContent>
					</Card>
					<Card className="mt-4">
						<CardHeader>
							<CardTitle>Resources</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-4 gap-8">
								<ShowPage.Row title="GPU">
									{Object.values(record.spec.resources?.accelerator || {})[0] ??
										record.spec.resources?.gpu ??
										"-"}
								</ShowPage.Row>
								<ShowPage.Row title="CPU">
									{record.spec.resources?.cpu ?? "-"}
								</ShowPage.Row>
								<ShowPage.Row title="Memory">
									{record.spec.resources?.memory ?? "-"}
								</ShowPage.Row>
							</div>

							{record.spec.resources?.accelerator && (
								<ShowPage.Row
									title={Object.keys(record.spec.resources?.accelerator)[0]}
								>
									{Object.values(record.spec.resources.accelerator)[0] ?? "-"}
								</ShowPage.Row>
							)}
						</CardContent>
					</Card>
					<Card className="mt-4">
						<CardContent>
							<div className="grid grid-cols-4 gap-8">
								<ShowPage.Row title="Replica">
									{record.spec.replicas?.num ?? 1}
								</ShowPage.Row>
								<ShowPage.Row title="Scheduler">
									{record.spec.deployment_options?.scheduler.type ??
										"Power of two"}
								</ShowPage.Row>
							</div>
						</CardContent>
					</Card>
					{engineVersionSchema && record.spec.variables?.engine_args && (
						<Card className="mt-4">
							<CardHeader>
								<CardTitle>Variables</CardTitle>
							</CardHeader>
							<CardContent>
								<JSONSchemaValueVisualizer
									schema={engineVersionSchema}
									value={record.spec.variables.engine_args}
								/>
							</CardContent>
						</Card>
					)}
				</TabsContent>
				<TabsContent value="ray" className="h-[calc(100%-theme('spacing.9'))]">
					<RayDashboardTab record={record} />
				</TabsContent>
				<TabsContent
					value="playground"
					className="h-[calc(100%-theme('spacing.9'))] overflow-hidden"
				>
					{record.spec.model.task === "text-embedding" ? (
						<EmbeddingPlayground endpoint={record} />
					) : (
						<ChatPlayground endpoint={record} />
					)}
				</TabsContent>
			</Tabs>
		</ShowPage>
	);
};
