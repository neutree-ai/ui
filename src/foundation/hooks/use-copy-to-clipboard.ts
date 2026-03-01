import { copyToClipboard } from "@/foundation/lib/clipboard";
import { useCallback, useState } from "react";

type CopyOptions = {
  successMessage: string;
  errorMessage: string;
  successDescription?: string;
};

export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, options: CopyOptions) => {
      const ok = await copyToClipboard(text, options);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), resetMs);
      }
      return ok;
    },
    [resetMs],
  );

  return { copy, copied };
}
