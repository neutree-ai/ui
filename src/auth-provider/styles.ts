import { cva } from "class-variance-authority";

export const authStyles = {
  container:
    "min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--secondary))]",

  button: cva(
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-[hsl(var(--background))]",
    {
      variants: {
        variant: {
          default:
            "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90",
          outline:
            "border border-input bg-transparent hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]",
        },
        size: {
          default: "h-10 py-2 px-4",
          sm: "h-9 px-3 rounded-md",
          lg: "h-11 px-8 rounded-md",
        },
      },
      defaultVariants: {
        variant: "default",
        size: "default",
      },
    }
  ),

  input:
    "flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",

  label:
    "text-sm font-medium text-[hsl(var(--foreground))] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
};
