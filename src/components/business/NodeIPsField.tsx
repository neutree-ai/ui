import {
  useState,
  useEffect,
  forwardRef,
  type ChangeEventHandler,
  useCallback,
} from "react";
import { Plus, Trash, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// IP address validation regex
const ipRegex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

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
    const [workerIps, setworkerIps] = useState(value.worker_ips || []);
    const [newWorkerIp, setNewWorkerIp] = useState("");
    const [errors, setErrors] = useState({
      headIp: "",
      workerIps: {},
      newWorkerIp: "",
    });

    useEffect(() => {
      setHeadIp(value.head_ip || "");
    }, [value.head_ip]);

    useEffect(() => {
      setworkerIps(value.worker_ips || []);
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
      (ip: string) => {
        if (!ip) return "IP address is required";
        if (!ipRegex.test(ip)) return "Invalid IP address format";
        if (ipIsDuplicated(ip)) {
          return "This IP address is already in use";
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
    const handleheadIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
      const ip = e.target.value;
      setHeadIp(ip);
      setErrors((prev) => ({
        ...prev,
        headIp: validateIp(ip),
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
      setworkerIps([...workerIps, newWorkerIp]);
      setNewWorkerIp("");
      setErrors((prev) => ({
        ...prev,
        newWorkerIp: "",
      }));
    };

    // Remove a worker node IP
    const removeWorkerNodeIp = (ipToRemove: string) => {
      setworkerIps(workerIps.filter((ip) => ip !== ipToRemove));

      // Clear any errors for this IP
      setErrors((prev) => {
        const updatedErrors = { ...prev };
        if (ipToRemove in updatedErrors.workerIps) {
          delete (updatedErrors.workerIps as Record<string, unknown>)[
            ipToRemove
          ];
        }
        if (ipToRemove === headIp) {
          // invariant: headIP === ipToRemove is valid as the ipToRemove has been validated upon adding
          updatedErrors.headIp = "";
        }
        return updatedErrors;
      });
    };

    return (
      <div className="space-y-4" ref={ref} {...props}>
        {/* Head Node IP */}
        <Card className="border border-border">
          <CardHeader className="bg-secondary text-secondary-foreground py-2 px-4">
            <div className="flex items-center">
              <CardTitle className="text-sm">Head Node IP</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col">
              <div className="flex items-center">
                <Input
                  value={headIp}
                  onChange={handleheadIpChange}
                  placeholder="e.g 192.168.1.1"
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
                <CardTitle className="text-sm">Worker Node IPs</CardTitle>
              </div>
              <Badge variant="outline">{workerIps.length} nodes</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Worker IP list */}
            <div className="space-y-2 mb-4">
              {workerIps.length === 0 ? (
                <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                  No worker nodes added. Add at least one worker node.
                </div>
              ) : (
                workerIps.map((ip, index) => (
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
                        onClick={() => removeWorkerNodeIp(ip)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    }
                  </div>
                ))
              )}
            </div>

            {/* Add new worker node IP */}
            {
              <div className="flex flex-col">
                <div className="flex items-center">
                  <Input
                    value={newWorkerIp}
                    onChange={handleNewWorkerIpChange}
                    placeholder="Add new worker node IP"
                    className={`flex-1 ${
                      errors.newWorkerIp ? "border-destructive" : ""
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addWorkerNodeIp();
                      }
                    }}
                  />
                  <Button
                    onClick={addWorkerNodeIp}
                    className="ml-2"
                    disabled={!newWorkerIp || !!errors.newWorkerIp}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {errors.newWorkerIp && (
                  <div className="flex items-center mt-1 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <span>{errors.newWorkerIp}</span>
                  </div>
                )}
              </div>
            }
          </CardContent>
        </Card>
      </div>
    );
  },
);

// Add display name for better debugging
NodeIPsField.displayName = "NodeIPsField";

export default NodeIPsField;
