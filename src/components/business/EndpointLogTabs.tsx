import { type FC, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useCustom } from "@refinedev/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogViewer } from "./LogViewer";
import { useEndpointLogUrls } from "@/hooks/use-endpoint-log-urls";
import type { Endpoint } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EndpointLogTabsProps {
  endpoint: Endpoint;
}

/**
 * Component for displaying endpoint logs in tabs (Application, Stderr, Stdout)
 * Only shows logs for Backend deployment
 */
export const EndpointLogTabs: FC<EndpointLogTabsProps> = ({ endpoint }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<
    "application" | "stderr" | "stdout"
  >("application");

  // Generate log URLs using the hook (now includes Ray application data fetching)
  const {
    logUrlsByDeployment,
    isLoading: isLoadingApp,
    refetch: refetchApp,
    rayApplicationInfo,
  } = useEndpointLogUrls(endpoint);

  // Get Backend deployment logs only
  const backendLogs = useMemo(() => {
    const backend = logUrlsByDeployment.Backend || [];
    return {
      application: backend.find((log) => log.type === "application"),
      stderr: backend.find((log) => log.type === "error"),
      stdout: backend.find((log) => log.type === "stdout"),
    };
  }, [logUrlsByDeployment]);

  // Fetch log content for active tab
  const activeLogUrl = backendLogs[activeTab]?.url;
  const activeDownloadUrl = backendLogs[activeTab]?.downloadUrl;

  const {
    data: logResponse,
    isLoading: isLoadingLog,
    refetch: refetchLog,
  } = useCustom({
    url: activeLogUrl || "",
    method: "get",
    meta: {
      headers: {
        "Content-Type": "text/plain",
      },
    },
    queryOptions: {
      enabled: !!activeLogUrl,
      refetchInterval: 10 * 1000, // Refresh every 10 seconds
    },
  });

  const logData =
    typeof logResponse?.data === "string"
      ? logResponse.data
      : String(logResponse?.data || "");

  const handleRefresh = () => {
    refetchApp();
    refetchLog();
  };

  if (isLoadingApp) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!rayApplicationInfo) {
    return (
      <Alert>
        <AlertDescription>
          {t("endpoints.logs.failedToLoadRayApplication")}
        </AlertDescription>
      </Alert>
    );
  }

  if (!backendLogs.application && !backendLogs.stderr && !backendLogs.stdout) {
    return (
      <Alert>
        <AlertDescription>
          {t("endpoints.logs.noBackendDeploymentFound")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
        className="h-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="application" disabled={!backendLogs.application}>
            {t("endpoints.logs.application")}
          </TabsTrigger>
          <TabsTrigger value="stderr" disabled={!backendLogs.stderr}>
            {t("endpoints.logs.stderr")}
          </TabsTrigger>
          <TabsTrigger value="stdout" disabled={!backendLogs.stdout}>
            {t("endpoints.logs.stdout")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="application"
          className="h-[calc(100%-theme('spacing.10'))] mt-4"
        >
          {backendLogs.application ? (
            <LogViewer
              source={
                isLoadingLog
                  ? t("endpoints.logs.loading")
                  : logData || t("endpoints.logs.noLogsAvailable")
              }
              downloadUrl={activeDownloadUrl}
              height="100%"
              onRefresh={handleRefresh}
            />
          ) : (
            <Alert>
              <AlertDescription>
                {t("endpoints.logs.applicationLogsNotAvailable")}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent
          value="stderr"
          className="h-[calc(100%-theme('spacing.10'))] mt-4"
        >
          {backendLogs.stderr ? (
            <LogViewer
              source={
                isLoadingLog
                  ? t("endpoints.logs.loading")
                  : logData || t("endpoints.logs.noLogsAvailable")
              }
              downloadUrl={activeDownloadUrl}
              height="100%"
              onRefresh={handleRefresh}
            />
          ) : (
            <Alert>
              <AlertDescription>
                {t("endpoints.logs.stderrLogsNotAvailable")}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent
          value="stdout"
          className="h-[calc(100%-theme('spacing.10'))] mt-4"
        >
          {backendLogs.stdout ? (
            <LogViewer
              source={
                isLoadingLog
                  ? t("endpoints.logs.loading")
                  : logData || t("endpoints.logs.noLogsAvailable")
              }
              downloadUrl={activeDownloadUrl}
              height="100%"
              onRefresh={handleRefresh}
            />
          ) : (
            <Alert>
              <AlertDescription>
                {t("endpoints.logs.stdoutLogsNotAvailable")}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
