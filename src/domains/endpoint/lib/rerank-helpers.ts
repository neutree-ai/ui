export type Document = {
  id: number;
  text: string;
  originalIndex: number;
};

export type RankedDocument = Document & {
  score: number;
  rankChange: number;
  newRank: number;
};

/**
 * Process raw rerank API results into ranked documents with score and rank change info.
 *
 * @param results - Array of { index, relevance_score } from the rerank API
 * @param documents - The original documents (order matters for rank-change calculation)
 * @returns Ranked documents sorted by relevance score (descending)
 * @throws When a result references an invalid document index
 */
export function processRerankResults(
  results: Array<{ index: number; relevance_score: number }>,
  documents: Document[],
): RankedDocument[] {
  const docMap = new Map(documents.map((doc, idx) => [idx, doc]));

  return results.map((result, newIndex) => {
    const originalDoc = docMap.get(result.index);
    if (!originalDoc) {
      throw new Error(`Invalid document index: ${result.index}`);
    }

    const oldIndex = originalDoc.originalIndex;
    const rankChange = oldIndex - newIndex;

    return {
      ...originalDoc,
      score: result.relevance_score,
      newRank: newIndex + 1,
      rankChange,
    };
  });
}
