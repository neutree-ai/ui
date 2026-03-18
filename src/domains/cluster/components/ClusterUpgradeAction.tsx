import { useCustom, useInvalidate, useUpdate } from "@refinedev/core";
import { ArrowUpCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Cluster } from "@/domains/cluster/types";
import { RowAction, type RowActionProps } from "@/foundation/components/Table";
import { useTranslation } from "@/foundation/lib/i18n";

type AvailableUpgradeVersions = {
  current_version: string;
  available_versions: string[];
};

type ClusterUpgradeActionProps = RowActionProps & {
  cluster: Cluster;
};

export const ClusterUpgradeAction = ({
  cluster,
  title,
  disabled,
  icon,
  ...props
}: ClusterUpgradeActionProps) => {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading: isUpdating } = useUpdate<Cluster>();

  const [open, setOpen] = useState(false);
  const [targetVersion, setTargetVersion] = useState<string>("");

  const { data, isLoading: isLoadingVersions } =
    useCustom<AvailableUpgradeVersions>({
      url: `/clusters/${cluster.metadata.workspace}/${cluster.metadata.name}/available_upgrade_versions`,
      method: "get",
      queryOptions: {
        enabled: open,
      },
    });

  const availableVersions = data?.data?.available_versions ?? [];
  const currentVersion =
    data?.data?.current_version ?? cluster.status?.version ?? "-";

  const handleOpen = () => {
    setTargetVersion("");
    setOpen(true);
  };

  const handleUpgrade = async () => {
    if (!targetVersion || isUpdating) return;

    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: {
          ...cluster,
          spec: {
            ...cluster.spec,
            version: targetVersion,
          },
        },
        mutationMode: "pessimistic",
        meta: {
          idColumnName: "metadata->name",
          workspace: cluster.metadata.workspace,
          workspaced: true,
        },
        successNotification: false,
        errorNotification: false,
      });

      toast.success(t("clusters.messages.upgradeSuccess"));
      setOpen(false);

      await invalidate({
        resource: "clusters",
        id: cluster.metadata.name,
        invalidates: ["list", "detail"],
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("clusters.messages.upgradeFailed"),
      );
    }
  };

  const handleConfirm = () => {
    void handleUpgrade();
  };

  return (
    <>
      <RowAction
        {...props}
        icon={icon ?? <ArrowUpCircle size={16} />}
        title={title ?? t("clusters.actions.upgrade")}
        disabled={disabled}
        onClick={handleOpen}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("clusters.actions.upgradeTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {t("clusters.fields.currentVersion")}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentVersion}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">
                {t("clusters.fields.targetVersion")}
              </div>
              {isLoadingVersions ? (
                <div className="text-sm text-muted-foreground">...</div>
              ) : availableVersions.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  {t("clusters.messages.noUpgradeVersions")}
                </div>
              ) : (
                <Select value={targetVersion} onValueChange={setTargetVersion}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t("clusters.fields.targetVersion")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.map((version) => (
                      <SelectItem key={version} value={version}>
                        {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              {cluster.spec.type === "ssh"
                ? t("clusters.messages.upgradeWarningSSH")
                : t("clusters.messages.upgradeWarningK8s")}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("buttons.cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!targetVersion || isUpdating}
            >
              {t("clusters.actions.upgrade")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

ClusterUpgradeAction.displayName = "ClusterUpgradeAction";
