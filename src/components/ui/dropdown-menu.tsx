import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react";
import * as React from "react";

import { cn } from "@/foundation/lib/utils";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex min-h-8 cursor-default select-none items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm text-[var(--nt-text-neutral-primary)] outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus:bg-[var(--nt-fill-neutral-trans-3)] focus:text-[var(--nt-text-neutral-super)] data-[highlighted]:bg-[var(--nt-fill-neutral-trans-3)] data-[highlighted]:text-[var(--nt-text-neutral-super)] data-[state=open]:bg-[var(--nt-fill-neutral-trans-3)] data-[state=open]:text-[var(--nt-text-neutral-super)] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-popover p-1 text-popover-foreground shadow-[var(--nt-effect-menu-shadow-default)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 origin-[--radix-dropdown-menu-content-transform-origin]",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-[var(--nt-radius-card)] border border-[var(--nt-stroke-neutral-trans-2)] bg-popover p-1 text-popover-foreground shadow-[var(--nt-effect-menu-shadow-default)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 origin-[--radix-dropdown-menu-content-transform-origin]",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm text-[var(--nt-text-neutral-primary)] outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus:bg-[var(--nt-fill-neutral-trans-3)] focus:text-[var(--nt-text-neutral-super)] data-[highlighted]:bg-[var(--nt-fill-neutral-trans-3)] data-[highlighted]:text-[var(--nt-text-neutral-super)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&[data-variant=destructive]]:text-[var(--nt-fill-serious-base)] [&[data-variant=destructive]]:hover:bg-[rgba(240,72,62,0.1)] [&[data-variant=destructive]]:hover:text-[var(--nt-fill-serious-base)] [&[data-variant=destructive]]:focus:bg-[rgba(240,72,62,0.1)] [&[data-variant=destructive]]:focus:text-[var(--nt-fill-serious-base)] [&[data-variant=destructive]][data-highlighted]:bg-[rgba(240,72,62,0.1)] [&[data-variant=destructive]][data-highlighted]:text-[var(--nt-fill-serious-base)]",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-default select-none items-center rounded-[4px] py-1.5 pl-8 pr-2 text-sm text-[var(--nt-text-neutral-primary)] outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus:bg-[var(--nt-fill-neutral-trans-3)] focus:text-[var(--nt-text-neutral-super)] data-[highlighted]:bg-[var(--nt-fill-neutral-trans-3)] data-[highlighted]:text-[var(--nt-text-neutral-super)] data-[state=checked]:bg-[var(--nt-fill-outstanding-thin)] data-[state=checked]:text-[var(--nt-text-neutral-super)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-default select-none items-center rounded-[4px] py-1.5 pl-8 pr-2 text-sm text-[var(--nt-text-neutral-primary)] outline-none transition-colors hover:bg-[var(--nt-fill-neutral-trans-3)] hover:text-[var(--nt-text-neutral-super)] focus:bg-[var(--nt-fill-neutral-trans-3)] focus:text-[var(--nt-text-neutral-super)] data-[highlighted]:bg-[var(--nt-fill-neutral-trans-3)] data-[highlighted]:text-[var(--nt-text-neutral-super)] data-[state=checked]:bg-[var(--nt-fill-outstanding-thin)] data-[state=checked]:text-[var(--nt-text-neutral-super)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-xs font-semibold text-[var(--nt-text-neutral-tertiary)]",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn(
      "-mx-1 my-1 h-px bg-[var(--nt-stroke-neutral-trans-2)]",
      className,
    )}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
