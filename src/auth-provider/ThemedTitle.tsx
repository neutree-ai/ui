import type React from "react";
import { useOemConfig } from "@/hooks/use-oem-config";

type ThemedTitleProps = {
  collapsed: boolean;
  text?: string;
  icon?: React.ReactNode;
};

export const ThemedTitle: React.FC<ThemedTitleProps> = ({
  collapsed,
  text,
  icon,
}) => {
  const { brandName, isLoading } = useOemConfig();
  let displayText = text || brandName;
  if (isLoading) {
    displayText = "...";
  }

  return (
    <div className="flex items-center gap-2">
      {icon && <div className="flex items-center justify-center">{icon}</div>}
      {!collapsed && <div className="font-bold text-xl">{displayText}</div>}
    </div>
  );
};
