import { useOemConfig } from "@/hooks/use-oem-config";

interface LogoProps {
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ collapsed = false }) => {
  const { brandName, logoBase64, logoCollapsedBase64, isLoading } =
    useOemConfig();

  if (isLoading) {
    return null;
  }

  const logoSrc =
    collapsed && logoCollapsedBase64
      ? logoCollapsedBase64
      : logoBase64 || "/logo.svg";

  if (collapsed) {
    return <img alt="logo" src={logoSrc} className="h-6 w-auto block mr-1" />;
  }

  return (
    <div className="flex justify-center items-center">
      <img alt="logo" src={logoSrc} className="h-6 w-auto block mr-1" />
      <div className="text-sm font-bold break-all">{brandName}</div>
    </div>
  );
};
