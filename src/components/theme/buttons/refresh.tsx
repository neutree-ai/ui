import type { RefreshButtonProps } from "@/components/theme/types";
import { Button } from "@/components/ui/button";
import { useRefreshButton } from "@refinedev/core";
import { Loader2, RefreshCwIcon } from "lucide-react";
import type { FC } from "react";

export const RefreshButton: FC<RefreshButtonProps> = ({
  resource,
  recordItemId,
  hideText = false,
  dataProviderName,
  children,
  ...props
}) => {
  const { onClick, label, loading } = useRefreshButton({
    resource,
    id: recordItemId,
    dataProviderName,
  });

  return (
    <Button onClick={onClick} {...props}>
      {loading && <Loader2 />}
      <RefreshCwIcon className="mr-2 w-4 h-4" />
      {!hideText && (children ?? label)}
    </Button>
  );
};

RefreshButton.displayName = "RefreshButton";
