import * as clipboard from "clipboard-polyfill";
import { toast } from "sonner";

export async function copyToClipboard(
  text: string,
  options: {
    successMessage: string;
    errorMessage: string;
    successDescription?: string;
  },
): Promise<boolean> {
  try {
    await clipboard.writeText(text);
    toast.success(options.successMessage, {
      description: options.successDescription,
    });
    return true;
  } catch {
    toast.error(options.errorMessage);
    return false;
  }
}
