import type { License } from "@/types/license";
import { MAX_UNLIMITED } from "@/types/license";
import { useCustom, useCustomMutation } from "@refinedev/core";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export const useLicense = () => {
  const { t } = useTranslation();

  const {
    data: licenseData,
    refetch,
    isLoading,
    error,
  } = useCustom<License>({
    url: "/license",
    method: "get",
    queryOptions: {
      retry: false,
    },
    errorNotification: false,
  });

  const { mutate: updateLicense, isLoading: isUpdating } = useCustomMutation();

  const license = licenseData?.data;

  // Check if license supports multiple workspaces
  const supportMultiWorkspace = useMemo(() => {
    const workspaceLimit = license?.status?.usage?.Workspace?.limit;

    if (workspaceLimit === undefined) {
      return false;
    }

    // Support multi-workspace if limit > 1 or unlimited
    return workspaceLimit > 1 || workspaceLimit === MAX_UNLIMITED;
  }, [license?.status?.usage?.Workspace?.limit]);

  const handleUpdateLicense = (
    code: string,
    options?: {
      onSuccess?: () => void;
      onError?: (error: any) => void;
    },
  ) => {
    if (!code.trim()) {
      toast.error(t("license.errors.emptyCode"));
      return;
    }

    updateLicense(
      {
        url: "/license",
        method: "PATCH" as "patch",
        values: {
          code,
        },
      },
      {
        onSuccess: () => {
          toast.success(t("license.success.updated"));
          refetch();
          options?.onSuccess?.();
        },
        onError: (error: any) => {
          toast.error(error?.message || t("license.errors.updateFailed"));
          options?.onError?.(error);
        },
      },
    );
  };

  return {
    license,
    isLoading,
    isUpdating,
    error,
    refetch,
    updateLicense: handleUpdateLicense,
    supportMultiWorkspace,
  };
};
