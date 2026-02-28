import type { ChatFunction } from "@/foundation/types/chat-types";
import { useState } from "react";

export function useChatState() {
  const [systemMessage, setSystemMessage] = useState("");
  const [functions, setFunctions] = useState<ChatFunction[]>([]);

  return {
    systemMessage,
    functions,
    updateSystemMessage: setSystemMessage,
    updateFunctions: setFunctions,
  };
}
