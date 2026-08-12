export type Project = {
  id: string;
  workspace: string;
  name: string;
  description: string | null;
  status: "enabled" | "disabled";
  is_default: boolean;
  created_at: string;
  updated_at: string;
};
