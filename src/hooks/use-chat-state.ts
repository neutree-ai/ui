import { useState } from "react";
import type { ChatFunction } from "@/types/chat-types";

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
