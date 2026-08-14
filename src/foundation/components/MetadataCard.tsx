import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type KeyValueTagsProps = {
  data: Record<string, string>;
};

export function KeyValueTags({ data }: KeyValueTagsProps) {
  const MAX_VALUE_LENGTH = 30;

  const truncateValue = (value: string) => {
    if (value.length > MAX_VALUE_LENGTH) {
      return `${value.substring(0, MAX_VALUE_LENGTH)}...`;
    }
    return value;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        {Object.entries(data).map(([key, value]) => {
          const shouldTruncate = value.length > MAX_VALUE_LENGTH;

          return (
            <span
              key={key}
              className="inline-flex items-center rounded-md border border-border/70 bg-background/40 px-2 py-1 text-xs text-foreground shadow-[0_1px_0_rgba(15,23,42,0.03)]"
            >
              <span className="font-medium text-muted-foreground">{key}:</span>
              {shouldTruncate ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 cursor-help">
                      {truncateValue(value)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md max-h-96 overflow-y-auto">
                    <p className="break-all whitespace-pre-wrap">{value}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <span className="ml-1">{value}</span>
              )}
            </span>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
