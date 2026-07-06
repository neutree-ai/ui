import { describe, expect, it } from "vitest";
import { type BatchDeleteRow, buildBatchDeleteVariables } from "./batch-delete";

const row = (name: string, workspace?: string): BatchDeleteRow => ({
  original: { metadata: { name, workspace } },
});

describe("buildBatchDeleteVariables", () => {
  it("threads each row's OWN workspace into its delete meta", () => {
    // The regression: workspaced rows selected from different workspaces must
    // each carry their own workspace, not a single shared (or missing) one.
    const vars = buildBatchDeleteVariables(
      [row("a", "ws1"), row("b", "ws2")],
      "clusters",
      false,
    );

    expect(vars).toHaveLength(2);
    expect(vars[0]).toMatchObject({
      resource: "clusters",
      id: "a",
      meta: { name: "a", workspace: "ws1" },
    });
    expect(vars[1]).toMatchObject({
      resource: "clusters",
      id: "b",
      meta: { name: "b", workspace: "ws2" },
    });
  });

  it("uses metadata.name as the delete id", () => {
    const [v] = buildBatchDeleteVariables([row("only")], "endpoints", false);
    expect(v.id).toBe("only");
  });

  it("merges forceDelete only when requested", () => {
    const [forced] = buildBatchDeleteVariables(
      [row("a", "ws1")],
      "clusters",
      true,
    );
    expect(forced.meta).toMatchObject({
      name: "a",
      workspace: "ws1",
      forceDelete: true,
    });

    const [plain] = buildBatchDeleteVariables(
      [row("a", "ws1")],
      "clusters",
      false,
    );
    expect(plain.meta).not.toHaveProperty("forceDelete");
  });

  it("suppresses per-row success notifications (one summary toast instead of N)", () => {
    const vars = buildBatchDeleteVariables(
      [row("a"), row("b")],
      "clusters",
      false,
    );
    expect(vars.every((v) => v.successNotification === false)).toBe(true);
  });

  it("does not mutate the source metadata when merging forceDelete", () => {
    const source = row("a", "ws1");
    buildBatchDeleteVariables([source], "clusters", true);
    expect(source.original.metadata).not.toHaveProperty("forceDelete");
  });

  it("skips rows without a name (nothing to key the delete on)", () => {
    const vars = buildBatchDeleteVariables(
      [
        { original: {} },
        { original: { metadata: { workspace: "ws1" } } },
        row("keep", "ws1"),
      ],
      "clusters",
      false,
    );
    expect(vars).toHaveLength(1);
    expect(vars[0].id).toBe("keep");
  });
});
