import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { isValidIPAddress } from "@/lib/validate";
import { AlertCircle, Plus, Trash } from "lucide-react";
import {
  type ChangeEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Control,
  type FieldValues,
  type Path,
  useController,
  useFormState,
} from "react-hook-form";

type IpsValue = {
  head_ip: string;
  worker_ips: string[];
};

type NodeIPsFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  disabled?: boolean;
};

function NodeIPsField<T extends FieldValues>({
  control,
  name,
  disabled = false,
}: NodeIPsFieldProps<T>) {
  const { t } = useTranslation();

  // Use useController to integrate with react-hook-form
  const {
    field: { value, onChange },
    fieldState: { error: formError },
  } = useController({
    name,
    control,
    rules: {
      validate: (val: IpsValue) => {
        const { head_ip, worker_ips } = val || { head_ip: "", worker_ips: [] };
        if (!head_ip) {
          return t("clusters.validation.ipRequired");
        }
        if (!isValidIPAddress(head_ip)) {
          return t("clusters.validation.invalidIPAddress");
        }
        if ((worker_ips || []).includes(head_ip)) {
          return t("clusters.validation.ipDuplicated");
        }
        return true;
      },
    },
  });

  // Check if form has been submitted
  const { isSubmitted } = useFormState({ control });

  const ipsValue = useMemo(
    () => (value as IpsValue) || { head_ip: "", worker_ips: [] },
    [value],
  );

  const [headIp, setHeadIp] = useState(ipsValue.head_ip || "");
  const [workerIps, setWorkerIps] = useState<string[]>(
    ipsValue.worker_ips || [],
  );
  const [newWorkerIp, setNewWorkerIp] = useState("");
  const [internalErrors, setInternalErrors] = useState({
    headIp: "",
    newWorkerIp: "",
  });

  // Sync from form value to local state
  useEffect(() => {
    setHeadIp(ipsValue.head_ip || "");
  }, [ipsValue.head_ip]);

  useEffect(() => {
    setWorkerIps(ipsValue.worker_ips || []);
  }, [ipsValue.worker_ips]);

  // Sync from local state to form value
  useEffect(() => {
    onChange({ head_ip: headIp, worker_ips: workerIps } as T[Path<T>]);
  }, [headIp, workerIps, onChange]);

  // Check for duplications
  const ipIsDuplicated = useCallback(
    (ip: string) => workerIps.includes(ip) || ip === headIp,
    [workerIps, headIp],
  );

  // Validate an IP address (for real-time feedback)
  const validateIp = useCallback(
    (ip: string, isRequired = false) => {
      if (!isRequired && !ip) return "";
      if (!ip) return t("clusters.validation.ipRequired");
      if (!isValidIPAddress(ip))
        return t("clusters.validation.invalidIPAddress");
      if (ipIsDuplicated(ip)) {
        return t("clusters.validation.ipDuplicated");
      }
      return "";
    },
    [ipIsDuplicated, t],
  );

  // Update newWorkerIp validation when dependencies change
  useEffect(() => {
    if (newWorkerIp) {
      const newError = validateIp(newWorkerIp);
      setInternalErrors((prev) => ({
        ...prev,
        newWorkerIp: newError,
      }));
    }
  }, [newWorkerIp, validateIp]);

  // Handle head node IP change
  const handleHeadIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const ip = e.target.value;
    setHeadIp(ip);
    setInternalErrors((prev) => ({
      ...prev,
      headIp: validateIp(ip, true),
    }));
  };

  // Handle new worker IP input change
  const handleNewWorkerIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const ip = e.target.value;
    setNewWorkerIp(ip);
    setInternalErrors((prev) => ({
      ...prev,
      newWorkerIp: validateIp(ip),
    }));
  };

  // Add a new worker node IP
  const addWorkerNodeIp = useCallback(() => {
    // Block adding if there are errors
    if (!newWorkerIp || internalErrors.newWorkerIp) return;

    // Add the new IP and clear the input
    setWorkerIps((prev) => [...prev, newWorkerIp]);
    setNewWorkerIp("");
    setInternalErrors((prev) => ({
      ...prev,
      newWorkerIp: "",
    }));
  }, [newWorkerIp, internalErrors.newWorkerIp]);

  // Remove a worker node IP
  const removeWorkerNodeIp = useCallback(
    (ipToRemove: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setWorkerIps((prev) => prev.filter((ip) => ip !== ipToRemove));

      setInternalErrors((prev) => {
        const updatedErrors = { ...prev };
        if (ipToRemove === headIp) {
          updatedErrors.headIp = "";
        }
        return updatedErrors;
      });
    },
    [headIp],
  );

  const handleNewWorkerIpKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addWorkerNodeIp();
      }
    },
    [addWorkerNodeIp],
  );

  // Show internal error if user has interacted,
  // OR show form error only after form submission
  const headIpError =
    internalErrors.headIp ||
    (isSubmitted && formError?.message ? (formError.message as string) : "");

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
                disabled={disabled}
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
              {workerIps.length} {t("clusters.labels.nodes")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {/* Worker IP list */}
          <div className="space-y-2 mb-4">
            {workerIps.length === 0 ? (
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
                    onClick={removeWorkerNodeIp(ip)}
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
                    internalErrors.newWorkerIp ? "border-destructive" : ""
                  }`}
                  onKeyDown={handleNewWorkerIpKeyDown}
                />
                <Button
                  onClick={addWorkerNodeIp}
                  className="ml-2"
                  disabled={!newWorkerIp || !!internalErrors.newWorkerIp}
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("buttons.add")}
                </Button>
              </div>
              {internalErrors.newWorkerIp && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{internalErrors.newWorkerIp}</span>
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
