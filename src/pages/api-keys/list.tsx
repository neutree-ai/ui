import { useCustomMutation, useInvalidate, useList } from "@refinedev/core";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CreateApiKeyForm } from "@/domains/api-key/components/CreateApiKeyForm";
import { ProjectPicker } from "@/domains/api-key/components/ProjectPicker";
import { rateSummary, useAllApiKeyUsage } from "@/domains/api-key/hooks/use-api-key-policy";
import type { ApiKey, ApiKeyProject } from "@/domains/api-key/types";
import { ListPage } from "@/foundation/components/ListPage";
import { ALL_WORKSPACES, useWorkspace } from "@/foundation/hooks/use-workspace";
import { formatTokenQuota } from "@/foundation/lib/token-quota";

export const ApiKeysList = () => {
  const { current: workspace } = useWorkspace();
  const scoped = workspace === ALL_WORKSPACES ? undefined : workspace;
  const [open, setOpen] = useState(false);
  const [presetProject, setPresetProject] = useState<string>();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState("");
  const invalidate = useInvalidate();
  const { mutateAsync } = useCustomMutation();
  const usage = useAllApiKeyUsage(scoped);
  const projectsQuery = useList<ApiKeyProject>({ resource: "api_key_projects", pagination: { mode: "off" }, filters: scoped ? [{ field: "workspace", operator: "eq", value: scoped }] : [] });
  const keysQuery = useList<ApiKey>({ resource: "api_keys", pagination: { mode: "off" }, meta: { workspace, workspaced: true } });
  const projects = projectsQuery.data?.data ?? [];
  const keys = keysQuery.data?.data ?? [];

  useEffect(() => { if (projects.length && expanded.size === 0 && !query) setExpanded(new Set([projects[0].id])); }, [projects.length]);
  const grouped = useMemo(() => projects.map((project) => {
    const all = keys.filter((k) => k.project_id === project.id);
    const q = query.trim().toLowerCase();
    const projectMatch = !q || project.name.toLowerCase().includes(q);
    const shown = projectMatch ? all : all.filter((k) => k.metadata.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q) || k.metadata.workspace?.toLowerCase().includes(q));
    return { project, all, shown, visible: projectMatch || shown.length > 0 };
  }).filter((g) => g.visible), [projects, keys, query]);

  useEffect(() => { if (query) setExpanded(new Set(grouped.map((g) => g.project.id))); }, [query]);
  const refresh = async () => { await Promise.all([invalidate({ resource: "api_key_projects", invalidates: ["list"] }), invalidate({ resource: "api_keys", invalidates: ["list"] })]); };
  const createKey = (project?: string) => { setPresetProject(project); setOpen(true); };
  const migrate = async () => { await mutateAsync({ url: "/rpc/move_api_keys_to_project", method: "post", values: { p_api_key_ids: [...selected], p_project_id: target } }); setSelected(new Set()); setMoveOpen(false); setExpanded((v) => new Set([...v, target])); await refresh(); };

  return <ListPage createButtonProps={{ onClick: () => createKey() }}>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Create API Key</DialogTitle><DialogDescription>Create a key in a Project.</DialogDescription></DialogHeader><CreateApiKeyForm initialProjectId={presetProject} onClose={() => setOpen(false)} /></DialogContent></Dialog>
    <Dialog open={moveOpen} onOpenChange={setMoveOpen}><DialogContent><DialogHeader><DialogTitle>Move API keys</DialogTitle><DialogDescription>{selected.size} selected. The operation is atomic.</DialogDescription></DialogHeader><ProjectPicker workspace={scoped ?? ""} value={target} onChange={setTarget} /><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setMoveOpen(false)}>Cancel</Button><Button disabled={!target || !selected.size} onClick={() => void migrate()}>Move</Button></div></DialogContent></Dialog>
    <div className="mb-4 flex items-center gap-3">
      <div className="relative max-w-md flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search Project, API key, description, or workspace" value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setExpanded(projects[0] ? new Set([projects[0].id]) : new Set()); }} /></div>
      {selected.size > 0 && <><span className="text-sm">{selected.size} selected</span><Button onClick={() => setMoveOpen(true)}>Move to Project</Button><Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button></>}
    </div>
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[minmax(240px,2fr)_100px_120px_140px_48px] gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground"><span>Project / description</span><span>API keys</span><span>Status</span><span>Current usage</span><span /></div>
      {(projectsQuery.isLoading || keysQuery.isLoading) && <div className="p-8 text-center text-muted-foreground">Loading...</div>}
      {!projectsQuery.isLoading && grouped.length === 0 && <div className="p-8 text-center text-muted-foreground">No matching Projects or API keys</div>}
      {grouped.map(({ project, all, shown }) => {
        const isOpen = expanded.has(project.id); const total = all.reduce((sum, k) => sum + (usage.get(k.id)?.used ?? 0), 0);
        return <div key={project.id} className="border-b last:border-b-0">
          <div className="grid grid-cols-[minmax(240px,2fr)_100px_120px_140px_48px] items-center gap-4 px-4 py-3">
            <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => setExpanded((old) => { const n=new Set(old); n.has(project.id)?n.delete(project.id):n.add(project.id); return n; })}>{isOpen?<ChevronDown className="h-4 w-4 shrink-0"/>:<ChevronRight className="h-4 w-4 shrink-0"/>}<span className="min-w-0"><strong className="block truncate">{project.name}</strong><span className="block truncate text-xs text-muted-foreground" title={project.description}>{project.description || "No description"}</span></span></button>
            <span>{all.length}</span><Badge variant={project.enabled?"outline":"secondary"}>{project.enabled?"Active":"Disabled"}</Badge><span className="tabular-nums">{formatTokenQuota(total)}</span>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{project.enabled&&<DropdownMenuItem onClick={()=>createKey(project.id)}><Plus className="mr-2 h-4 w-4"/>Create API key</DropdownMenuItem>}<DropdownMenuItem onClick={()=>void mutateAsync({url:"/rpc/update_api_key_project",method:"post",values:{p_project_id:project.id,p_enabled:!project.enabled}}).then(refresh)}>{project.enabled?"Disable":"Enable"}</DropdownMenuItem><DropdownMenuItem className="text-destructive" onClick={()=>void mutateAsync({url:"/rpc/delete_api_key_project",method:"post",values:{p_project_id:project.id}}).then(refresh)}>Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </div>
          {isOpen && <div className="border-t bg-muted/20 px-6 py-3">
            {shown.length===0?<div className="py-8 text-center text-sm text-muted-foreground">This Project has no API keys{project.enabled&&<div><Button variant="link" onClick={()=>createKey(project.id)}>Create API key</Button></div>}</div>:<div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="w-10"/><th className="py-2">API key / description</th><th>Workspace</th><th>Status</th><th>Usage</th><th>Rate limit</th><th>Models</th><th>Created</th></tr></thead><tbody>{shown.map((key)=>{const u=usage.get(key.id); const limits=key.spec.limits??{}; return <tr key={key.id} className="border-t"><td><Checkbox checked={selected.has(key.id)} onCheckedChange={(v)=>setSelected((old)=>{const n=new Set(old);v?n.add(key.id):n.delete(key.id);return n;})}/></td><td className="py-3"><strong>{key.metadata.name}</strong><div className="max-w-xs truncate text-xs text-muted-foreground" title={key.description}>{key.description||"No description"}</div></td><td>{key.metadata.workspace}</td><td><Badge variant={limits.disabled?"destructive":"outline"}>{limits.disabled?"Disabled":"Active"}</Badge></td><td className="tabular-nums">{u?`${formatTokenQuota(u.used)} / ${formatTokenQuota(u.token_limit)}`:"Unlimited"}</td><td>{rateSummary(limits).join(" · ")||"-"}</td><td>{limits.allowed_models?.map((m)=>m.model).join(", ")||"All"}</td><td>{new Date(key.metadata.creation_timestamp).toLocaleDateString()}</td></tr>})}</tbody></table></div>}
          </div>}
        </div>;
      })}
    </div>
  </ListPage>;
};
