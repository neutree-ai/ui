import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Rocket,
  SkipForward,
  XCircle,
} from "lucide-react";
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
  type QuickStartStep,
  type StepStatus,
  useQuickStart,
} from "@/foundation/hooks/use-quick-start";
import { useTranslation } from "@/foundation/lib/i18n";
import { isValidIPAddress } from "@/foundation/lib/validate";

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case "in-progress":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}

function StepList({ steps }: { steps: QuickStartStep[] }) {
  const { t } = useTranslation();

  const stepLabels: Record<string, string> = {
    "image-registry": t("quick_start.steps.imageRegistry"),
    "model-registry": t("quick_start.steps.modelRegistry"),
    cluster: t("quick_start.steps.cluster"),
    endpoint: t("quick_start.steps.endpoint"),
  };

  const statusLabels: Record<StepStatus, string> = {
    pending: t("quick_start.status.pending"),
    "in-progress": t("quick_start.status.inProgress"),
    success: t("quick_start.status.success"),
    skipped: t("quick_start.status.skipped"),
    error: t("quick_start.status.error"),
  };

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3">
          <StepIcon status={step.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {stepLabels[step.id]}
              </span>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                {statusLabels[step.status]}
              </span>
            </div>
            {step.error && (
              <p className="text-xs text-destructive mt-0.5">{step.error}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isCreating) return; // prevent closing while creating
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
            <StepList steps={state.steps} />

            {state.phase === "done" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
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
