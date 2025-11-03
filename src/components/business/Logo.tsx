import { useOemConfig } from "@/hooks/use-oem-config";

interface LogoProps {
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ collapsed = false }) => {
  const { brandName, logoBase64, logoCollapsedBase64, isLoading } =
    useOemConfig();

  const logoSrc =
    collapsed && logoCollapsedBase64
      ? logoCollapsedBase64
      : logoBase64 || "/logo.png"; // fallback to default logo

  if (isLoading) {
    return null;
  }

  if (collapsed) {
    return <img alt="logo" src={logoSrc} className="w-8 h-8 block" />;
  }

  return (
    <div className="flex justify-center items-center">
      <img alt="logo" src={logoSrc} className="w-8 h-8 block" />
      <div className="text-sm font-bold break-all">{brandName}</div>
    </div>
  );
};
