import { useTranslation } from "@/foundation/lib/i18n";
import type { ChangeEventHandler, KeyboardEventHandler } from "react";
import { useState } from "react";
import {
  type Control,
  type FieldValues,
  type Path,
  useController,
  useFormState,
} from "react-hook-form";
import {
  type IpsValue,
  type NodeIpsError,
  validateNodeIps,
  validateSingleIp,
} from "../lib/validate-node-ips";

const errorKeyMap: Record<NodeIpsError, string> = {
  required: "clusters.validation.ipRequired",
  invalidIP: "clusters.validation.invalidIPAddress",
  duplicated: "clusters.validation.ipDuplicated",
};

export function useNodeIps<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) {
  const { t } = useTranslation();

  const toMessage = (error: NodeIpsError | null): string =>
    error ? t(errorKeyMap[error]) : "";

  // Form integration
  const {
    field: { value, onChange },
    fieldState: { error: formError },
  } = useController({
    name,
    control,
    rules: {
      validate: (val: IpsValue) => {
        const error = validateNodeIps(val);
        return error ? t(errorKeyMap[error]) : true;
      },
    },
  });

  const { isSubmitted } = useFormState({ control });

  // Derive from form value directly — no local mirrors
  const ipsValue = (value as IpsValue) || { head_ip: "", worker_ips: [] };
  const headIp = ipsValue.head_ip || "";
  const workerIps = ipsValue.worker_ips || [];

  // Only local state: new worker input + validation errors
  const [newWorkerIp, setNewWorkerIp] = useState("");
  const [internalErrors, setInternalErrors] = useState({
    headIp: "",
    newWorkerIp: "",
  });

  // Handlers
  const handleHeadIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const ip = e.target.value;
    onChange({ head_ip: ip, worker_ips: workerIps } as T[Path<T>]);
    const error = validateSingleIp(ip, workerIps, headIp, true);
    setInternalErrors((prev) => ({ ...prev, headIp: toMessage(error) }));
  };

  const handleNewWorkerIpChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const ip = e.target.value;
    setNewWorkerIp(ip);
    const error = validateSingleIp(ip, workerIps, headIp);
    setInternalErrors((prev) => ({ ...prev, newWorkerIp: toMessage(error) }));
  };

  const addWorkerIp = () => {
    if (!newWorkerIp || internalErrors.newWorkerIp) return;
    onChange({
      head_ip: headIp,
      worker_ips: [...workerIps, newWorkerIp],
    } as T[Path<T>]);
    setNewWorkerIp("");
    setInternalErrors((prev) => ({ ...prev, newWorkerIp: "" }));
  };

  const removeWorkerIp = (ipToRemove: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const filtered = workerIps.filter((ip) => ip !== ipToRemove);
    onChange({ head_ip: headIp, worker_ips: filtered } as T[Path<T>]);
    // Re-validate newWorkerIp since available IPs changed
    const error = newWorkerIp
      ? validateSingleIp(newWorkerIp, filtered, headIp)
      : null;
    setInternalErrors((prev) => ({ ...prev, newWorkerIp: toMessage(error) }));
  };

  const handleNewWorkerIpKeyDown: KeyboardEventHandler<HTMLInputElement> = (
    e,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWorkerIp();
    }
  };

  // Derived
  const headIpError =
    internalErrors.headIp ||
    (isSubmitted && formError?.message ? (formError.message as string) : "");

  return {
    headIp,
    workerIps,
    newWorkerIp,
    headIpError,
    newWorkerIpError: internalErrors.newWorkerIp,
    workerCount: workerIps.length,
    handleHeadIpChange,
    handleNewWorkerIpChange,
    handleNewWorkerIpKeyDown,
    addWorkerIp,
    removeWorkerIp,
    canAddWorkerIp: !!newWorkerIp && !internalErrors.newWorkerIp,
  };
}
