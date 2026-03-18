import { useCustom, useInvalidate, useUpdate } from "@refinedev/core";
import { ArrowUpCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { Cluster } from "@/domains/cluster/types";
import { useTranslation } from "@/foundation/lib/i18n";

type AvailableVersionsResponse = {
  available_versions: string[];
};

// ── Context to lift dialog state above the dropdown ──

type UpgradeContextValue = {
  openUpgrade: (cluster: Cluster) => void;
};

const UpgradeContext = createContext<UpgradeContextValue | null>(null);

/**
 * Provider that renders the upgrade dialog outside of any dropdown.
 * Wrap your page content (including the table/show page) with this.
 */
export function ClusterUpgradeProvider({
  children,
}: { children: React.ReactNode }) {
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [open, setOpen] = useState(false);

  const openUpgrade = useCallback((c: Cluster) => {
    setCluster(c);
    setOpen(true);
  }, []);

  return (
    <UpgradeContext.Provider value={{ openUpgrade }}>
      {children}
      {cluster && (
        <UpgradeDialog
          cluster={cluster}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </UpgradeContext.Provider>
  );
}

/**
 * DropdownMenuItem that triggers the upgrade dialog via context.
 * Safe to render inside dropdown content — no dialog lives here.
 */
export const ClusterUpgradeAction = ({
  cluster,
}: { cluster: Cluster }) => {
  const { t } = useTranslation();
  const ctx = useContext(UpgradeContext);

  return (
    <DropdownMenuItem
      onSelect={() => {
        ctx?.openUpgrade(cluster);
      }}
    >
      <span className="mr-2">
        <ArrowUpCircle size={16} />
      </span>
      {t("clusters.actions.upgrade")}
    </DropdownMenuItem>
  );
};

ClusterUpgradeAction.displayName = "ClusterUpgradeAction";

// ── Dialog (internal) ──

function UpgradeDialog({
  cluster,
  open,
  onOpenChange,
}: { cluster: Cluster; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { mutateAsync, isLoading: isUpdating } = useUpdate<Cluster>();
  const [targetVersion, setTargetVersion] = useState<string>("");

  const upgradeVersionsUrl = (() => {
    const params = new URLSearchParams({
      workspace: cluster.metadata.workspace ?? "",
      image_registry: cluster.spec.image_registry,
      cluster_type: cluster.spec.type,
    });
    if (cluster.status?.accelerator_type) {
      params.set("accelerator_type", cluster.status.accelerator_type);
    }
    return `/clusters/available_versions?${params.toString()}`;
  })();

  const { data, isLoading: isLoadingVersions } =
    useCustom<AvailableVersionsResponse>({
      url: upgradeVersionsUrl,
      method: "get",
      queryOptions: {
        enabled: open,
      },
    });

  const excludeVersions = new Set(
    [cluster.spec.version, cluster.status?.version].filter(Boolean),
  );
  const availableVersions = (data?.data?.available_versions ?? []).filter(
    (v) => !excludeVersions.has(v),
  );
  const currentVersion = cluster.status?.version ?? "-";

  useEffect(() => {
    if (availableVersions.length > 0 && !targetVersion) {
      setTargetVersion(availableVersions[availableVersions.length - 1]);
    }
  }, [availableVersions, targetVersion]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) setTargetVersion("");
  }, [open]);

  const handleUpgrade = async () => {
    if (!targetVersion || isUpdating) return;
    try {
      await mutateAsync({
        resource: "clusters",
        id: cluster.metadata.name,
        values: {
          ...cluster,
          spec: { ...cluster.spec, version: targetVersion },
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
      onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Combobox
                value={targetVersion}
                onChange={setTargetVersion}
                options={availableVersions.map((v) => ({
                  label: v,
                  value: v,
                }))}
                placeholder={t("clusters.fields.targetVersion")}
                asField={false}
                allowUnselect={false}
              />
            )}
          </div>
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            {cluster.spec.type === "ssh"
              ? t("clusters.messages.upgradeWarningSSH")
              : t("clusters.messages.upgradeWarningK8s")}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("buttons.cancel")}
          </Button>
          <Button
            onClick={() => void handleUpgrade()}
            disabled={!targetVersion || isUpdating}
          >
            {t("clusters.actions.upgrade")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
