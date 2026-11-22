import { useEffect } from "react";
import { useOemConfig } from "@/foundation/oem-config/use-oem-config";

export const OemFavicon = () => {
  const { logoBase64 } = useOemConfig();

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link) {
      link.href = logoBase64 || `${import.meta.env.BASE_URL}favicon.svg`;
    }
  }, [logoBase64]);

  return null;
};
