import { useOemConfig } from "@/hooks/use-oem-config";
import type React from "react";

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
  const { brandName, logoBase64, isLoading } = useOemConfig();
  const displayText = isLoading ? "..." : text || brandName;
  const logoSrc = logoBase64 || "/logo.svg";
  const displayIcon = icon ?? (
    <img alt="logo" src={logoSrc} className="w-[64px] h-[64px]" />
  );

  return (
    <div className="flex flex-col items-center gap-2">
      {displayIcon && (
        <div className="flex items-center justify-center">{displayIcon}</div>
      )}
      {!collapsed && <div className="font-bold text-xl">{displayText}</div>}
    </div>
  );
};
