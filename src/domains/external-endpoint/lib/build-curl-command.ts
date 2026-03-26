export function buildOpenAICurlCommand(
  serviceUrl: string,
  modelName: string,
): string {
  return `curl ${serviceUrl}/v1/chat/completions \\
  -H "Authorization: Bearer $ENDPOINT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
}
