export function buildCurlCommand(
  serviceUrl: string,
  modelName: string,
): string {
  return `curl ${serviceUrl}/v1/chat/completions \\
  -H "Authorization: Bearer <your-neutree-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
}
