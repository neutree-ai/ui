import { useCan, useInvalidate, useUpdate } from "@refinedev/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/foundation/lib/error-message";
import { cacheMessage } from "../lib/zcache-presentation";
import type { Cluster } from "../types";

export function CacheRetry({ cluster }: { cluster: Cluster }) {
  const { t } = useTranslation();
  const { data: access } = useCan({ resource: "clusters", action: "edit" });
  const { mutateAsync, isLoading } = useUpdate<Cluster>();
  const invalidate = useInvalidate();
  const [error, setError] = useState("");
  const retry = async () => {
    if (isLoading || access?.can !== true) return;
    setError("");
    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: {
          metadata: {
            ...cluster.metadata,
            annotations: {
              ...cluster.metadata.annotations,
              "neutree.ai/zcache-retry": uuidv4(),
            },
          },
        },
        meta: {
          idColumnName: "metadata->name",
          workspace: cluster.metadata.workspace,
          workspaced: true,
        },
        mutationMode: "pessimistic",
        successNotification: false,
        errorNotification: false,
      });
      await invalidate({
        resource: "clusters",
        id: cluster.metadata.name,
        invalidates: ["detail", "list"],
      });
    } catch (e) {
      setError(getErrorMessage(e, t("clusters.zcache.saveFailed")));
    }
  };
  return (
    <div>
      <Button
        variant="outline"
        disabled={isLoading || access?.can !== true}
        onClick={() => void retry()}
      >
        {t("clusters.zcache.retry")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {cacheMessage(error, t("clusters.zcache.serviceName"))}
        </p>
      )}
    </div>
  );
}
