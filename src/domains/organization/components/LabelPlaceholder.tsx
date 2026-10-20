import { Skeleton } from "@/components/ui/skeleton";

/** Stands in for a group label until the group loads. */
export function LabelPlaceholder({ testId }: { testId: string }) {
  return (
    <Skeleton
      className="inline-block h-4 w-20 align-middle"
      data-testid={testId}
      data-loading="true"
    />
  );
}
