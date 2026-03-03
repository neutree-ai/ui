export function buildAnthropicCurlCommand(
  serviceUrl: string,
  modelName: string,
): string {
  return `curl ${serviceUrl}/anthropic/v1/messages \\
  -H "x-api-key: <your-neutree-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
}
