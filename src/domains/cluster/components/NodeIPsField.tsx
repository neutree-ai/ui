import { AlertCircle, Plus, Trash } from "lucide-react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/foundation/components/EmptyState";
import { useTranslation } from "@/foundation/lib/i18n";
import { cn } from "@/foundation/lib/utils";
import { useNodeIps } from "../hooks/use-node-ips";

type NodeIPsFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  disabled?: boolean;
  headIpDisabled?: boolean;
  variant?: "card" | "section";
};

function NodeIPsField<T extends FieldValues>({
  control,
  name,
  disabled = false,
  headIpDisabled = false,
  variant = "card",
}: NodeIPsFieldProps<T>) {
  const { t } = useTranslation();
  const {
    headIp,
    workerIps,
    newWorkerIp,
    headIpError,
    newWorkerIpError,
    workerCount,
    handleHeadIpChange,
    handleNewWorkerIpChange,
    handleNewWorkerIpKeyDown,
    addWorkerIp,
    removeWorkerIp,
    canAddWorkerIp,
  } = useNodeIps({ control, name });

  const groupClassName = cn(
    "space-y-3",
    variant === "card" &&
      "rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-[var(--nt-fill-neutral-white)] p-4",
  );
  const listItemClassName = cn(
    "flex items-center justify-between rounded-[var(--nt-radius-input)] border border-[var(--nt-stroke-neutral-trans-2)] px-3 py-2",
    variant === "section"
      ? "bg-[var(--nt-fill-neutral-opaque-1)]"
      : "bg-[var(--nt-fill-neutral-white)]",
  );

  return (
    <div className="space-y-5">
      <div className={groupClassName}>
        <Label className="text-sm font-medium">
          {t("clusters.fields.sshHeadNodeIP")}
        </Label>
        <div className="flex flex-col">
          <Input
            value={headIp}
            onChange={handleHeadIpChange}
            placeholder={t("clusters.placeholders.sshHeadNodeExample")}
            disabled={disabled || headIpDisabled}
            className={headIpError ? "border-destructive" : ""}
          />
          {headIpError && (
            <div className="mt-1 flex items-center text-sm text-destructive">
              <AlertCircle className="mr-1 h-4 w-4" />
              <span>{headIpError}</span>
            </div>
          )}
        </div>
      </div>

      <div className={groupClassName}>
        <div className="flex items-center justify-between gap-3">
          <Label className="text-sm font-medium">
            {t("clusters.fields.sshWorkerNodeIPs")}
          </Label>
          <Badge variant="outline">
            {workerCount} {t("clusters.labels.nodes")}
          </Badge>
        </div>

        <div className="space-y-2">
          {workerCount === 0 ? (
            <EmptyState variant="inline">
              {t("clusters.messages.sshEmptyWorkerNodeIPs")}
            </EmptyState>
          ) : (
            workerIps.map((ip, index) => (
              <div key={`${ip}-${index}`} className={listItemClassName}>
                <span className="font-mono text-sm">{ip}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={removeWorkerIp(ip)}
                  className="h-8 w-8"
                  type="button"
                  disabled={disabled}
                  data-testid="remove-worker-ip"
                >
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {!disabled && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Input
                value={newWorkerIp}
                onChange={handleNewWorkerIpChange}
                placeholder={t("clusters.placeholders.sshAddNewWorkerNode")}
                className={cn(
                  "flex-1",
                  newWorkerIpError && "border-destructive",
                )}
                onKeyDown={handleNewWorkerIpKeyDown}
              />
              <Button
                onClick={addWorkerIp}
                disabled={!canAddWorkerIp}
                type="button"
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("buttons.add")}
              </Button>
            </div>
            {newWorkerIpError && (
              <div className="mt-1 flex items-center text-sm text-destructive">
                <AlertCircle className="mr-1 h-4 w-4" />
                <span>{newWorkerIpError}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

NodeIPsField.displayName = "NodeIPsField";

export default NodeIPsField;
