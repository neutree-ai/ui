import { describe, expect, it } from "vitest";
import type { ServiceAccount } from "@/domains/service-account/types";
import { roleAssignmentName } from "./use-service-accounts";

describe("roleAssignmentName", () => {
  it("makes a valid resource name from the application and role", () => {
    const account = {
      id: "sa-1",
      metadata: { name: "Chat.Bot" },
      spec: {},
      team_id: 1,
    } as ServiceAccount;
    const name = roleAssignmentName(account, "model-invoker");
    expect(name).toMatch(/^app-chat-bot-model-invoker-[a-z0-9]+$/);
    expect(name.length).toBeLessThanOrEqual(63);
  });
});
