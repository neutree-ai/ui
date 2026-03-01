import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/foundation/providers/themeProvider";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<
  Partial<React.ComponentProps<typeof ThemeProvider>>
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
        <Toaster richColors />
      </TooltipProvider>
    </ThemeProvider>
  );
};

BaseLayout.displayName = "BaseLayout";
