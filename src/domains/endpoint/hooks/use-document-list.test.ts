import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDocumentList } from "./use-document-list";

describe("useDocumentList", () => {
  const sampleDocs = [
    { id: 1, text: "First document" },
    { id: 2, text: "Second document" },
  ];

  it("initializes with provided documents", () => {
    const { result } = renderHook(() => useDocumentList(sampleDocs));
    expect(result.current.documents).toEqual(sampleDocs);
  });

  it("initializes with empty list by default", () => {
    const { result } = renderHook(() => useDocumentList());
    expect(result.current.documents).toEqual([]);
  });

  it("addDocument appends a new empty document with next id", () => {
    const { result } = renderHook(() => useDocumentList(sampleDocs));

    act(() => {
      result.current.addDocument();
    });

    expect(result.current.documents).toHaveLength(3);
    expect(result.current.documents[2]).toEqual({ id: 3, text: "" });
  });

  it("addDocument starts at id 1 when list is empty", () => {
    const { result } = renderHook(() => useDocumentList());

    act(() => {
      result.current.addDocument();
    });

    expect(result.current.documents).toEqual([{ id: 1, text: "" }]);
  });

  it("addDocument generates correct id after non-sequential removals", () => {
    const { result } = renderHook(() =>
      useDocumentList([
        { id: 1, text: "a" },
        { id: 5, text: "b" },
      ]),
    );

    act(() => {
      result.current.addDocument();
    });

    expect(result.current.documents[2].id).toBe(6);
  });

  it("updateDocument changes only the target document", () => {
    const { result } = renderHook(() => useDocumentList(sampleDocs));

    act(() => {
      result.current.updateDocument(1, "Updated text");
    });

    expect(result.current.documents[0].text).toBe("Updated text");
    expect(result.current.documents[1].text).toBe("Second document");
  });

  it("removeDocument removes the correct document", () => {
    const { result } = renderHook(() => useDocumentList(sampleDocs));

    act(() => {
      result.current.removeDocument(1);
    });

    expect(result.current.documents).toEqual([
      { id: 2, text: "Second document" },
    ]);
  });

  it("clearDocuments empties the list", () => {
    const { result } = renderHook(() => useDocumentList(sampleDocs));

    act(() => {
      result.current.clearDocuments();
    });

    expect(result.current.documents).toEqual([]);
  });
});
