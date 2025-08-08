import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { isValidIPAddress } from "@/lib/validate";
import { AlertCircle, Plus, Trash } from "lucide-react";
import {
  type ChangeEventHandler,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from "react";

type IpsValue = {
  head_ip: string;
  worker_ips: string[];
};

type NodeIPsFieldProps = {
  value?: IpsValue;
  onChange?: (value: IpsValue) => void;
  disabled?: boolean;
  name?: string;
};

const NodeIPsField = forwardRef<HTMLDivElement, NodeIPsFieldProps>(
  (
    {
      value = { head_ip: "", worker_ips: [] },
      onChange,
      disabled = false,
      name,
      ...props
    },
    ref,
  ) => {
    const [headIp, setHeadIp] = useState(value.head_ip || "");
    const [workerIps, setWorkerIps] = useState(value.worker_ips || []);
    const [newWorkerIp, setNewWorkerIp] = useState("");
    const [errors, setErrors] = useState({
      headIp: "",
      newWorkerIp: "",
    });

    const { t } = useTranslation();

    useEffect(() => {
      setHeadIp(value.head_ip || "");
    }, [value.head_ip]);

    useEffect(() => {
      setWorkerIps(value.worker_ips || []);
    }, [JSON.stringify(value.worker_ips)]);

    // Update the parent form when values change
    useEffect(() => {
      if (onChange) {
        onChange({ head_ip: headIp, worker_ips: workerIps });
      }
    }, [headIp, JSON.stringify(workerIps), onChange]);

    // Check for duplications
    const ipIsDuplicated = useCallback(
      (ip: string) => workerIps.includes(ip) || ip === headIp,
      [workerIps, headIp],
    );

    // Validate an IP address
    const validateIp = useCallback(
      (ip: string, isrequired = false) => {
        if (!isrequired && !ip) return "";
        if (!ip) return t("clusters.validation.ipRequired");
        if (!isValidIPAddress(ip))
          return t("clusters.validation.invalidIPAddress");
        if (ipIsDuplicated(ip)) {
          return t("clusters.validation.ipDuplicated");
        }
        return "";
      },
      [ipIsDuplicated],
    );

    // Update newWorkerIp validation when dependencies change
    useEffect(() => {
      if (newWorkerIp) {
        const newError = validateIp(newWorkerIp);
        setErrors((prev) => ({
          ...prev,
          newWorkerIp: newError,
        }));
      }
    }, [newWorkerIp, validateIp]);

    // Handle head node IP change
    const handleHeadIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
      const ip = e.target.value;
      setHeadIp(ip);
      setErrors((prev) => ({
        ...prev,
        headIp: validateIp(ip, true),
      }));
    };

    // Handle new worker IP input change
    const handleNewWorkerIpChange: ChangeEventHandler<HTMLInputElement> = (
      e,
    ) => {
      const ip = e.target.value;
      setNewWorkerIp(ip);
      setErrors((prev) => ({
        ...prev,
        newWorkerIp: validateIp(ip),
      }));
    };

    // Add a new worker node IP
    const addWorkerNodeIp = () => {
      // Block adding if there are errors
      if (!newWorkerIp || errors.newWorkerIp) return;

      // Add the new IP and clear the input
      setWorkerIps([...workerIps, newWorkerIp]);
      setNewWorkerIp("");
      setErrors((prev) => ({
        ...prev,
        newWorkerIp: "",
      }));
    };

    // Remove a worker node IP
    const removeWorkerNodeIp = useCallback(
      (ipToRemove: string) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setWorkerIps((prev: string[]) =>
          prev.filter((ip: string) => ip !== ipToRemove),
        );

        setErrors((prev) => {
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

    return (
      <div className="space-y-4" ref={ref} {...props}>
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
                  className={errors.headIp ? "border-destructive" : ""}
                />
              </div>
              {errors.headIp && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{errors.headIp}</span>
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
                workerIps.map((ip: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-card border border-border rounded"
                  >
                    <div className="flex items-center">
                      <span className="font-mono text-sm">{ip}</span>
                    </div>
                    {
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeWorkerNodeIp(ip)}
                        className="h-8 w-8 p-0"
                        type="button"
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  </div>
                ))
              )}
            </div>

            {/* Add new worker node IP */}
            <div className="flex flex-col">
              <div className="flex items-center">
                <Input
                  value={newWorkerIp}
                  onChange={handleNewWorkerIpChange}
                  placeholder={t("clusters.placeholders.sshAddNewWorkerNode")}
                  className={`flex-1 ${
                    errors.newWorkerIp ? "border-destructive" : ""
                  }`}
                  onKeyDown={handleNewWorkerIpKeyDown}
                />
                <Button
                  onClick={addWorkerNodeIp}
                  className="ml-2"
                  disabled={!newWorkerIp || !!errors.newWorkerIp}
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("buttons.add")}
                </Button>
              </div>
              {errors.newWorkerIp && (
                <div className="flex items-center mt-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>{errors.newWorkerIp}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);

// Add display name for better debugging
NodeIPsField.displayName = "NodeIPsField";

export default NodeIPsField;
