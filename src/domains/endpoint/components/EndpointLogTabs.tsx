import { useList } from "@refinedev/core";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBackendReplicas,
  type LogSource,
  useEndpointLogSources,
} from "@/domains/endpoint/hooks/use-endpoint-log-sources";
import { useStreamingLogs } from "@/domains/endpoint/hooks/use-streaming-logs";
import {
  getDefaultLogContainer,
  getLogUrls,
} from "@/domains/endpoint/lib/log-helpers";
import type { Endpoint, EndpointEngineRef } from "@/domains/endpoint/types";
import { EmptyState } from "@/foundation/components/EmptyState";
import { SegmentedControl } from "@/foundation/components/SegmentedControl";
import { LogViewer } from "./LogViewer";

interface EndpointLogTabsProps {
  endpoint: Endpoint;
  clusterType: string | undefined;
}

export const EndpointLogTabs: FC<EndpointLogTabsProps> = ({
  endpoint,
  clusterType,
}) => {
  const { t } = useTranslation();
  const {
    deployments,
    isLoading: isLoadingLogSources,
    refetch: refetchLogSources,
  } = useEndpointLogSources(endpoint);
  const replicas = useMemo(
    () => getBackendReplicas(deployments),
    [deployments],
  );
  const [activeReplicaId, setActiveReplicaId] = useState<string | null>(null);
  const [activeContainerName, setActiveContainerName] = useState<string | null>(
    null,
  );
  const [previous, setPrevious] = useState(false);
  const [activeTab, setActiveTab] = useState("application");

  const activeReplica =
    replicas.find((replica) => replica.replica_id === activeReplicaId) ??
    replicas[0];
  const availableLogs = activeReplica?.logs ?? [];
  const isKubernetes = clusterType === "kubernetes";
  const containers = isKubernetes
    ? availableLogs.filter(
        (log): log is LogSource & { container_name: string } =>
          !!log.container_name,
      )
    : [];
  const { data: enginesData } = useList<Pick<EndpointEngineRef, "metadata">>({
    resource: "engines",
    meta: {
      select: "metadata",
      workspaced: true,
      workspace: endpoint.metadata.workspace,
    },
    pagination: { mode: "off" },
    queryOptions: { enabled: isKubernetes },
  });
  const engineNames = new Set(
    enginesData?.data.map((engine) => engine.metadata.name) ?? [
      endpoint.spec.engine.engine,
    ],
  );
  const activeContainer =
    containers.find(
      (container) => container.container_name === activeContainerName,
    ) ?? getDefaultLogContainer(containers, engineNames);
  const canViewPrevious = (activeContainer?.restart_count ?? 0) > 0;

  if (activeReplicaId !== (activeReplica?.replica_id ?? null)) {
    setActiveReplicaId(activeReplica?.replica_id ?? null);
    setPrevious(false);
  }
  if (activeContainerName !== (activeContainer?.container_name ?? null)) {
    setActiveContainerName(activeContainer?.container_name ?? null);
    setPrevious(false);
  }
  if (previous && !canViewPrevious) setPrevious(false);

  const availableTabKeys = ["application", "logs", "stderr", "stdout"].filter(
    (type) => availableLogs.some((log) => log.type === type),
  );
  if (availableTabKeys.length && !availableTabKeys.includes(activeTab)) {
    setActiveTab(availableTabKeys[0]);
  }

  const activeLog = isKubernetes
    ? activeContainer
    : availableLogs.find((log) => log.type === activeTab);
  const activeLogInfo =
    activeLog?.url && (!isKubernetes || activeContainer)
      ? getLogUrls(activeLog, activeContainer?.container_name, previous)
      : null;
  const {
    logs: streamedLogs,
    isLoading: isLoadingLogs,
    error: logsError,
    refetch: refetchLogs,
  } = useStreamingLogs(activeLogInfo?.url ?? null, !!activeLogInfo?.url);

  const handleRefresh = () => {
    void refetchLogSources();
    refetchLogs();
  };

  if (isLoadingLogSources) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }
  if (!replicas.length || !availableLogs.length) {
    return <EmptyState>{t("endpoints.logs.noLogsAvailable")}</EmptyState>;
  }

  const labels: Record<string, string> = {
    application: t("endpoints.logs.application"),
    logs: t("common.tabs.logs"),
    stderr: t("endpoints.logs.stderr"),
    stdout: t("endpoints.logs.stdout"),
  };
  const replicaLabel = t("common.fields.replica");
  const showToolbar =
    isKubernetes || availableTabKeys.length > 1 || replicas.length > 1;
  const containerLabels = new Map([
    ...Array.from(
      engineNames,
      (name) => [name, t("endpoints.logs.inference")] as const,
    ),
    ["model-downloader", t("endpoints.logs.modelDownloader")],
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showToolbar && (
        <div
          data-testid="endpoint-log-toolbar"
          className="flex min-h-9 shrink-0 flex-wrap items-center gap-3 pb-2"
        >
          {!isKubernetes && availableTabKeys.length > 1 && (
            <SegmentedControl
              ariaLabel={t("common.tabs.logs")}
              items={availableTabKeys.map((type) => ({
                value: type,
                label: labels[type],
              }))}
              onValueChange={setActiveTab}
              value={activeTab}
            />
          )}
          {(isKubernetes || replicas.length > 1) && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {replicaLabel}
              </span>
              <Select
                value={activeReplicaId ?? undefined}
                onValueChange={(replicaId) => {
                  setActiveReplicaId(replicaId);
                  setPrevious(false);
                }}
              >
                <SelectTrigger aria-label={replicaLabel} className="w-[260px]">
                  <SelectValue placeholder={replicaLabel} />
                </SelectTrigger>
                <SelectContent>
                  {replicas.map((replica) => (
                    <SelectItem
                      key={replica.replica_id}
                      value={replica.replica_id}
                    >
                      {replica.replica_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isKubernetes && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {t("endpoints.logs.container")}
                </span>
                <Select
                  value={activeContainer?.container_name}
                  disabled={!containers.length}
                  onValueChange={(containerName) => {
                    setActiveContainerName(containerName);
                    setPrevious(false);
                  }}
                >
                  <SelectTrigger
                    aria-label={t("endpoints.logs.container")}
                    className="w-[220px]"
                  >
                    <SelectValue placeholder={t("endpoints.logs.container")} />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((container) => (
                      <SelectItem
                        key={container.container_name}
                        value={container.container_name}
                      >
                        {containerLabels.get(container.container_name) ??
                          container.container_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canViewPrevious && (
                <SegmentedControl
                  ariaLabel={t("endpoints.logs.containerRun")}
                  value={previous ? "previous" : "current"}
                  items={[
                    { value: "current", label: t("endpoints.logs.current") },
                    { value: "previous", label: t("endpoints.logs.previous") },
                  ]}
                  onValueChange={(run) => {
                    setPrevious(run === "previous");
                  }}
                />
              )}
            </>
          )}
        </div>
      )}
      {activeLogInfo ? (
        <div
          className={`min-h-0 flex-1 overflow-hidden ${showToolbar ? "mt-2" : ""}`}
        >
          <LogViewer
            source={
              isLoadingLogs
                ? t("endpoints.logs.loading")
                : logsError
                  ? t(
                      previous
                        ? "endpoints.logs.previousUnavailable"
                        : "endpoints.logs.loadError",
                      { error: logsError },
                    )
                  : streamedLogs || t("endpoints.logs.noLogsAvailable")
            }
            downloadUrl={activeLogInfo.downloadUrl}
            downloadErrorMessage={
              previous ? t("endpoints.logs.previousUnavailable") : undefined
            }
            height="100%"
            onRefresh={handleRefresh}
          />
        </div>
      ) : (
        <EmptyState>{t("endpoints.logs.noLogsAvailable")}</EmptyState>
      )}
    </div>
  );
};
