import { AlertCircle, CheckCircle, Loader2, Rocket } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  type ResourceResultItem,
  ResourceResultList,
} from "@/foundation/components/ResourceResultList";
import { useQuickStart } from "@/foundation/hooks/use-quick-start";
import { useTranslation } from "@/foundation/lib/i18n";
import { isValidIPAddress } from "@/foundation/lib/validate";

interface QuickStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickStartDialog({
  open,
  onOpenChange,
}: QuickStartDialogProps) {
  const { t } = useTranslation();
  const { state, execute, isEnginesLoading } = useQuickStart();

  const [headIp, setHeadIp] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshPrivateKey, setSshPrivateKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepLabels: Record<string, string> = {
    "image-registry": t("quick_start.steps.imageRegistry"),
    "model-registry": t("quick_start.steps.modelRegistry"),
    cluster: t("quick_start.steps.cluster"),
    endpoint: t("quick_start.steps.endpoint"),
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!headIp.trim()) {
      newErrors.headIp = t("quick_start.validation.required");
    } else if (!isValidIPAddress(headIp.trim())) {
      newErrors.headIp = t("quick_start.validation.invalidIp");
    }

    if (!sshUser.trim()) {
      newErrors.sshUser = t("quick_start.validation.required");
    }

    if (!sshPrivateKey.trim()) {
      newErrors.sshPrivateKey = t("quick_start.validation.required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeploy = () => {
    if (!validate()) return;
    execute({
      headIp: headIp.trim(),
      sshUser: sshUser.trim(),
      sshPrivateKey: sshPrivateKey,
    });
  };

  const completedCount = state.steps.filter(
    (s) => s.status === "success" || s.status === "skipped",
  ).length;
  const progressValue = (completedCount / state.steps.length) * 100;

  const isCreating = state.phase === "creating";

  const resultItems: ResourceResultItem[] = state.steps.map((step) => ({
    label: stepLabels[step.id] ?? step.id,
    name: step.resourceName,
    status: step.status,
    error: step.error,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isCreating) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            {t("quick_start.title")}
          </DialogTitle>
          <DialogDescription>{t("quick_start.description")}</DialogDescription>
        </DialogHeader>

        {state.phase === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qs-headIp">
                {t("quick_start.fields.serverIp")}
              </Label>
              <Input
                id="qs-headIp"
                value={headIp}
                onChange={(e) => {
                  setHeadIp(e.target.value);
                  setErrors((prev) => ({ ...prev, headIp: "" }));
                }}
                placeholder={t("quick_start.fields.serverIpPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("quick_start.fields.serverIpDescription")}
              </p>
              {errors.headIp && (
                <p className="text-sm text-destructive">{errors.headIp}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qs-sshUser">
                {t("quick_start.fields.sshUser")}
              </Label>
              <Input
                id="qs-sshUser"
                value={sshUser}
                onChange={(e) => {
                  setSshUser(e.target.value);
                  setErrors((prev) => ({ ...prev, sshUser: "" }));
                }}
                placeholder={t("quick_start.fields.sshUserPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">
                {t("quick_start.fields.sshUserDescription")}
              </p>
              {errors.sshUser && (
                <p className="text-sm text-destructive">{errors.sshUser}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qs-sshPrivateKey">
                {t("quick_start.fields.sshPrivateKey")}
              </Label>
              <Textarea
                id="qs-sshPrivateKey"
                value={sshPrivateKey}
                onChange={(e) => {
                  setSshPrivateKey(e.target.value);
                  setErrors((prev) => ({ ...prev, sshPrivateKey: "" }));
                }}
                placeholder={t("quick_start.fields.sshPrivateKeyPlaceholder")}
                rows={5}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t("quick_start.fields.sshPrivateKeyDescription")}
              </p>
              {errors.sshPrivateKey && (
                <p className="text-sm text-destructive">
                  {errors.sshPrivateKey}
                </p>
              )}
            </div>

            <Button
              onClick={handleDeploy}
              disabled={isEnginesLoading}
              className="w-full"
            >
              {isEnginesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4" />
              )}
              {t("quick_start.buttons.deploy")}
            </Button>
          </div>
        )}

        {(state.phase === "creating" ||
          state.phase === "done" ||
          state.phase === "error") && (
          <div className="space-y-4">
            <Progress value={progressValue} />
            <ResourceResultList items={resultItems} />

            {state.phase === "done" && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("quick_start.messages.success")}
                </AlertDescription>
              </Alert>
            )}

            {state.phase === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("quick_start.messages.error")}
                </AlertDescription>
              </Alert>
            )}

            {state.phase === "error" && (
              <Button onClick={handleDeploy} variant="outline">
                {t("quick_start.buttons.retry")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
