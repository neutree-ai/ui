import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/foundation/lib/i18n";
import { AlertCircle, Plus, Trash } from "lucide-react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { useNodeIps } from "../hooks/use-node-ips";

type NodeIPsFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  disabled?: boolean;
  headIpDisabled?: boolean;
};

function NodeIPsField<T extends FieldValues>({
  control,
  name,
  disabled = false,
  headIpDisabled = false,
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

  return (
    <div className="space-y-4">
      {/* Head Node IP */}
      <Card className="border border-border">
        <CardHeader className="bg-secondary text-secondary-foreground py-2 px-4">
          <div className="flex items-center">
            <CardTitle className="text-sm">
              {t("clusters.fields.sshHeadNodeIP")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col">
            <div className="flex items-center">
              <Input
                value={headIp}
                onChange={handleHeadIpChange}
                placeholder={t("clusters.placeholders.sshHeadNodeExample")}
                disabled={disabled || headIpDisabled}
                className={headIpError ? "border-destructive" : ""}
              />
            </div>
            {headIpError && (
              <div className="flex items-center mt-1 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>{headIpError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader className="bg-secondary text-secondary-foreground py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CardTitle className="text-sm">
                {t("clusters.fields.sshWorkerNodeIPs")}
              </CardTitle>
            </div>
            <Badge variant="outline">
              {workerCount} {t("clusters.labels.nodes")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Worker IP list */}
          <div className="space-y-2 mb-4">
            {workerCount === 0 ? (
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                {t("clusters.messages.sshEmptyWorkerNodeIPs")}
              </div>
            ) : (
              workerIps.map((ip, index) => (
                <div
                  key={`${ip}-${index}`}
                  className="flex items-center justify-between p-2 bg-card border border-border rounded"
                >
                  <div className="flex items-center">
                    <span className="font-mono text-sm">{ip}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeWorkerIp(ip)}
                    className="h-8 w-8 p-0"
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

          {/* Add new worker node IP */}
          {!disabled && (
            <div className="flex flex-col">
              <div className="flex items-center">
                <Input
                  value={newWorkerIp}
                  onChange={handleNewWorkerIpChange}
                  placeholder={t("clusters.placeholders.sshAddNewWorkerNode")}
                  className={`flex-1 ${
                    newWorkerIpError ? "border-destructive" : ""
                  }`}
                  onKeyDown={handleNewWorkerIpKeyDown}
                />
                <Button
                  onClick={addWorkerIp}
                  className="ml-2"
                  disabled={!canAddWorkerIp}
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("buttons.add")}
                </Button>
              </div>
              {newWorkerIpError && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{newWorkerIpError}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

NodeIPsField.displayName = "NodeIPsField";

export default NodeIPsField;
