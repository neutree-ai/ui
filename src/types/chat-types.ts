export interface ChatFunction {
  id: string;
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
}
