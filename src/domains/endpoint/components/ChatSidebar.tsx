import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { ChatFunction } from "@/foundation/types/chat-types";
import { useTranslation } from "react-i18next";
import { FunctionsManager } from "./FunctionsManager";

interface ChatSidebarProps {
  systemMessage: string;
  onSystemMessageChange: (message: string) => void;
  functions: ChatFunction[];
  onFunctionsChange: (functions: ChatFunction[]) => void;
  children: React.ReactNode; // Model selector and settings
}

export function ChatSidebar({
  systemMessage,
  onSystemMessageChange,
  functions,
  onFunctionsChange,
  children,
}: ChatSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-80 bg-card">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-6 max-w-80">
          {/* System Message Section */}
          <div className="space-y-2">
            <Label>{t("components.playground.chat.systemMessage")}</Label>
            <Textarea
              placeholder={t(
                "components.playground.chat.systemMessagePlaceholder",
              )}
              value={systemMessage}
              onChange={(e) => onSystemMessageChange(e.target.value)}
              className="min-h-[100px] resize-none"
            />
          </div>

          {/* Settings Section */}
          <div className="space-y-2">
            <Label>{t("components.playground.chat.modelParameters")}</Label>
            <div className="space-y-4">{children}</div>
          </div>

          {/* Functions Section */}
          <div className="space-y-2">
            <FunctionsManager
              functions={functions}
              onFunctionsChange={onFunctionsChange}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
