export function buildAnthropicCurlCommand(
  serviceUrl: string,
  modelName: string,
): string {
  return `curl ${serviceUrl}/anthropic/v1/messages \\
  -H "x-api-key: $ENDPOINT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
}
