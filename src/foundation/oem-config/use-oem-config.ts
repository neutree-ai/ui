import { useList } from "@refinedev/core";

export const useOemConfig = () => {
  const { data, isLoading, error, refetch } = useList({
    resource: "oem_configs",
    filters: [
      {
        field: "metadata->>name",
        operator: "eq",
        value: "default",
      },
    ],
  });

  const oemConfig = data?.data?.[0];

  return {
    oemConfig,
    isLoading,
    error,
    refetch,
    brandName:
      oemConfig?.spec?.brand_name ??
      import.meta.env.VITE_BRAND_NAME ??
      "Neutree",
    logoBase64: oemConfig?.spec?.logo_base64,
    logoCollapsedBase64: oemConfig?.spec?.logo_collapsed_base64,
  };
};
