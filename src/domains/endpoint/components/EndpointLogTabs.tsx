import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEndpointLogSources } from "@/domains/endpoint/hooks/use-endpoint-log-sources";
import { useStreamingLogs } from "@/domains/endpoint/hooks/use-streaming-logs";
import type { Endpoint } from "@/domains/endpoint/types";
import { LogViewer } from "./LogViewer";

interface EndpointLogTabsProps {
  endpoint: Endpoint;
}

/**
 * Component for displaying endpoint logs in tabs
 * Supports multiple log types (logs, application, stderr, stdout) from both Ray and Kubernetes
 */
export const EndpointLogTabs: FC<EndpointLogTabsProps> = ({ endpoint }) => {
  const { t } = useTranslation();

  // Fetch log sources using the new unified API
  const {
    deployments,
    isLoading: isLoadingLogSources,
    refetch: refetchLogSources,
  } = useEndpointLogSources(endpoint);

  // Find Backend deployment (or use first deployment if Backend not found)
  const backendDeployment = useMemo(() => {
    return deployments.find((d) => d.name === "Backend") || deployments[0];
  }, [deployments]);

  const replicas = useMemo(
    () => backendDeployment?.replicas ?? [],
    [backendDeployment],
  );

  const [activeReplicaId, setActiveReplicaId] = useState<string | null>(
    () => replicas[0]?.replica_id ?? null,
  );

  // Ensure active replica is valid when replicas change
  useMemo(() => {
    if (!replicas.length) {
      if (activeReplicaId !== null) setActiveReplicaId(null);
      return;
    }
    if (!replicas.some((replica) => replica.replica_id === activeReplicaId)) {
      setActiveReplicaId(replicas[0]?.replica_id ?? null);
    }
  }, [replicas, activeReplicaId]);

  const activeReplica = useMemo(() => {
    if (!activeReplicaId) return replicas[0];
    return replicas.find((replica) => replica.replica_id === activeReplicaId);
  }, [replicas, activeReplicaId]);

  // Get logs from selected replica of backend deployment
  const availableLogs = useMemo(() => {
    if (!activeReplica) return [];
    return activeReplica.logs;
  }, [activeReplica]);

  // Determine available log types and set initial active tab
  const logTypeMap = useMemo(() => {
    const map: Record<string, { url: string; downloadUrl: string }> = {};
    availableLogs.forEach((log) => {
      map[log.type] = {
        url: log.url,
        downloadUrl: log.download_url,
      };
    });
    return map;
  }, [availableLogs]);

  // Available tab keys in priority order
  const availableTabKeys = useMemo(() => {
    const priority = ["application", "logs", "stderr", "stdout"];
    return priority.filter((key) => key in logTypeMap);
  }, [logTypeMap]);

  const [activeTab, setActiveTab] = useState<string>(
    () => availableTabKeys[0] || "application",
  );

  // Ensure activeTab is valid when availableTabKeys change
  useMemo(() => {
    if (!availableTabKeys.includes(activeTab) && availableTabKeys.length > 0) {
      setActiveTab(availableTabKeys[0]);
    }
  }, [availableTabKeys, activeTab]);

  // Stream logs for active tab
  const activeLogInfo = logTypeMap[activeTab];

  // Remove /api/v1 prefix from URL if present (hook will add REST_URL automatically)
  const relativeUrl = activeLogInfo?.url
    ? activeLogInfo.url.replace(/^\/api\/v1/, "")
    : null;

  const {
    logs: streamedLogs,
    isLoading: isLoadingLogs,
    error: logsError,
    refetch: refetchLogs,
  } = useStreamingLogs(
    relativeUrl ? `${relativeUrl}?lines=1000` : null,
    !!relativeUrl,
  );

  const handleRefresh = () => {
    refetchLogSources();
    refetchLogs();
  };

  if (isLoadingLogSources) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!backendDeployment || !availableLogs.length) {
    return (
      <Alert>
        <AlertDescription>
          {t("endpoints.logs.noLogsAvailable")}
        </AlertDescription>
      </Alert>
    );
  }

  // Helper function to get tab label based on log type
  const getTabLabel = (logType: string) => {
    const labels: Record<string, string> = {
      application: t("endpoints.logs.application"),
      logs: t("common.tabs.logs"),
      stderr: t("endpoints.logs.stderr"),
      stdout: t("endpoints.logs.stdout"),
    };
    return labels[logType] || logType;
  };

  // Get appropriate grid class based on number of tabs
  const getGridClass = () => {
    const count = availableTabKeys.length;
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count === 3) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <div className="flex items-center gap-4 pb-2">
          {availableTabKeys.length > 1 && (
            <TabsList className={`grid flex-1 ${getGridClass()}`}>
              {availableTabKeys.map((logType) => (
                <TabsTrigger key={logType} value={logType}>
                  {getTabLabel(logType)}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {replicas.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {t("common.fields.replica")} ({replicas.length})
              </span>
              <Select
                value={activeReplicaId ?? replicas[0]?.replica_id}
                onValueChange={(value) => setActiveReplicaId(value)}
              >
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder={t("common.fields.replica")} />
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
        </div>

        {availableTabKeys.map((logType) => (
          <TabsContent
            key={logType}
            value={logType}
            className="h-[calc(100%-theme('spacing.10'))] mt-4"
          >
            <LogViewer
              source={
                isLoadingLogs
                  ? t("endpoints.logs.loading")
                  : logsError
                    ? `Error: ${logsError}`
                    : streamedLogs || t("endpoints.logs.noLogsAvailable")
              }
              downloadUrl={logTypeMap[logType]?.downloadUrl}
              height="100%"
              onRefresh={handleRefresh}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
