import { describe, expect, it } from "vitest";
import type { Document } from "./rerank-helpers";
import { processRerankResults } from "./rerank-helpers";

const docs: Document[] = [
  { id: 1, text: "Paris is the capital of France.", originalIndex: 0 },
  { id: 2, text: "The Eiffel Tower is in Paris.", originalIndex: 1 },
  { id: 3, text: "London is the capital of England.", originalIndex: 2 },
];

describe("processRerankResults", () => {
  it("sorts documents by relevance and attaches score", () => {
    const results = [
      { index: 1, relevance_score: 0.95 },
      { index: 0, relevance_score: 0.8 },
      { index: 2, relevance_score: 0.3 },
    ];

    const ranked = processRerankResults(results, docs);

    expect(ranked).toHaveLength(3);
    expect(ranked[0].score).toBe(0.95);
    expect(ranked[0].text).toBe("The Eiffel Tower is in Paris.");
    expect(ranked[0].newRank).toBe(1);

    expect(ranked[1].score).toBe(0.8);
    expect(ranked[1].newRank).toBe(2);

    expect(ranked[2].score).toBe(0.3);
    expect(ranked[2].newRank).toBe(3);
  });

  it("calculates positive rankChange when document moves up", () => {
    // doc at originalIndex 2 moves to newIndex 0 → rankChange = 2 - 0 = 2
    const results = [
      { index: 2, relevance_score: 0.99 },
      { index: 0, relevance_score: 0.5 },
      { index: 1, relevance_score: 0.1 },
    ];

    const ranked = processRerankResults(results, docs);
    expect(ranked[0].rankChange).toBe(2); // moved up
  });

  it("calculates negative rankChange when document moves down", () => {
    // doc at originalIndex 0 moves to newIndex 2 → rankChange = 0 - 2 = -2
    const results = [
      { index: 1, relevance_score: 0.9 },
      { index: 2, relevance_score: 0.8 },
      { index: 0, relevance_score: 0.1 },
    ];

    const ranked = processRerankResults(results, docs);
    expect(ranked[2].rankChange).toBe(-2); // moved down
  });

  it("calculates zero rankChange when position unchanged", () => {
    const results = [
      { index: 0, relevance_score: 0.9 },
      { index: 1, relevance_score: 0.8 },
      { index: 2, relevance_score: 0.7 },
    ];

    const ranked = processRerankResults(results, docs);
    expect(ranked[0].rankChange).toBe(0);
    expect(ranked[1].rankChange).toBe(0);
    expect(ranked[2].rankChange).toBe(0);
  });

  it("throws on invalid document index", () => {
    const results = [{ index: 99, relevance_score: 0.5 }];
    expect(() => processRerankResults(results, docs)).toThrow(
      "Invalid document index: 99",
    );
  });

  it("returns an empty array for empty results", () => {
    expect(processRerankResults([], docs)).toEqual([]);
  });
});
