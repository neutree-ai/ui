import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-[calc(var(--nt-radius-button)+2px)] bg-[var(--nt-fill-neutral-opaque-1)] p-1 text-[var(--nt-text-neutral-secondary)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--nt-radius-button)] px-3 py-1 text-sm font-medium [transition:background-color_var(--nt-motion-fast),color_var(--nt-motion-fast),box-shadow_var(--nt-motion-fast)] hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus-visible:outline-none focus-visible:shadow-[var(--nt-outline-active-focus)] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[var(--nt-fill-neutral-white)] data-[state=active]:text-[var(--nt-text-neutral-primary)] data-[state=active]:shadow-[var(--nt-effect-button-shadow-push-button-ordinary)] data-[state=active]:hover:bg-[var(--nt-fill-neutral-white)]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      // `relative` keeps absolutely-positioned descendants (e.g. Tailwind
      // `sr-only` spans) contained in the panel; without it they resolve
      // against an outer positioned ancestor and inflate its scroll area.
      "relative mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
