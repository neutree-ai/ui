import type { LayoutProps } from "@/components/theme/types";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PropsWithChildren } from "react";
import { ThemeProvider } from "@/components/theme/providers";

type Props = PropsWithChildren<
  Pick<
    LayoutProps,
    | "attribute"
    | "defaultTheme"
    | "enableSystem"
    | "disableTransitionOnChange"
    | "enableColorScheme"
    | "forcedTheme"
    | "nonce"
    | "storageKey"
    | "themes"
    | "value"
  >
>;

export const BaseLayout = ({
  attribute,
  defaultTheme,
  enableSystem,
  disableTransitionOnChange,
  enableColorScheme,
  forcedTheme,
  nonce,
  storageKey,
  themes,
  value,
  children,
}: Partial<Props>) => {
  return (
    <ThemeProvider
      attribute={attribute ?? "class"}
      defaultTheme={defaultTheme ?? "system"}
      enableSystem={enableSystem ?? true}
      disableTransitionOnChange={disableTransitionOnChange ?? false}
      enableColorScheme={enableColorScheme ?? true}
      forcedTheme={forcedTheme}
      nonce={nonce}
      storageKey={storageKey}
      themes={themes}
      value={value}
    >
      <TooltipProvider
        delayDuration={0}
        skipDelayDuration={0}
        disableHoverableContent={true}
      >
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
};

BaseLayout.displayName = "BaseLayout";
