export function buildEmbeddingCurlCommand(
  serviceUrl: string,
  modelName: string,
): string {
  return `curl ${serviceUrl}/v1/embeddings \\
  -H "Authorization: Bearer $ENDPOINT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "input": "Your text string goes here",
    "encoding_format": "float"
  }'`;
}
