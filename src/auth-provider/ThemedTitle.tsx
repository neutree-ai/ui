import type React from "react";

type ThemedTitleProps = {
  collapsed: boolean;
  text?: string;
  icon?: React.ReactNode;
};

export const ThemedTitle: React.FC<ThemedTitleProps> = ({
  collapsed,
  text = "Neutree",
  icon,
}) => {
  return (
    <div className="flex items-center gap-2">
      {icon && <div className="flex items-center justify-center">{icon}</div>}
      {!collapsed && <div className="font-bold text-xl">{text}</div>}
    </div>
  );
};
