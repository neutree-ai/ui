import { useCustomMutation, useInvalidate, useList, useNavigation } from "@refinedev/core";
import { ChevronDown, ChevronRight, FolderInput, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiKey, Project } from "@/domains/api-key/types";
import { useDebouncedValue } from "@/foundation/hooks/use-debounced-value";
import { ALL_WORKSPACES } from "@/foundation/hooks/use-workspace";

const PAGE_SIZE = 10;

export function ApiKeyProjectGroups({ workspace }: { workspace: string }) {
  const { show } = useNavigation();
  const { mutateAsync } = useCustomMutation();
  const invalidate = useInvalidate();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase());
  const meta = { workspace, workspaced: true };
  const { data: projectData } = useList<Project>({ resource: "projects", pagination: { mode: "off" }, meta });
  const { data: keyData } = useList<ApiKey>({ resource: "api_keys", pagination: { mode: "off" }, meta });
  const projects = projectData?.data ?? [];
  const keys = keyData?.data ?? [];
  const grouped = useMemo(() => projects.map((project) => ({ project, keys: keys.filter((key) => key.project_id === project.id) })).filter(({ project, keys }) => {
    const matchesProject = [project.metadata.name, project.spec?.description].some((value) => value?.toLowerCase().includes(q));
    const matchesKey = keys.some((key) => [key.metadata.name, key.description, key.metadata.workspace].some((value) => value?.toLowerCase().includes(q)) && (state === "all" || (state === "disabled") === Boolean(key.spec?.limits?.disabled)));
    return (state === "all" || (state === "disabled") === Boolean(project.spec?.disabled) || matchesKey) && (!q || matchesProject || matchesKey);
  }), [keys, projects, q, state]);
  const pages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE));
  const visible = grouped.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const move = async () => { await mutateAsync({ url: "/rpc/move_api_keys", method: "post", values: { p_api_key_ids: [...selected], p_target_project_id: target } }); setSelected(new Set()); setTarget(""); setMoveOpen(false); invalidate({ resource: "api_keys", invalidates: ["list"] }); };
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search projects or API keys" /></div>
      <Select value={state} onValueChange={(value) => { setState(value); setPage(0); }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="enabled">Enabled</SelectItem><SelectItem value="disabled">Disabled</SelectItem></SelectContent></Select>
      <Button variant="outline" disabled={!selected.size} onClick={() => setMoveOpen(true)}><FolderInput className="mr-2 h-4 w-4" />Move ({selected.size})</Button>
    </div>
    <Table><TableHeader><TableRow><TableHead className="w-10" /><TableHead>Project / API key</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Workspace</TableHead></TableRow></TableHeader><TableBody>
      {visible.map(({ project, keys: projectKeys }, groupIndex) => { const open = expanded.has(project.id) || (!q && groupIndex === 0 && page === 0); return <>
        <TableRow key={project.id} className="bg-muted/40"><TableCell><button type="button" onClick={() => setExpanded((current) => { const next = new Set(current); next.has(project.id) ? next.delete(project.id) : next.add(project.id); return next; })}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></TableCell><TableCell className="font-semibold">{project.metadata.name} <span className="ml-2 text-xs font-normal text-muted-foreground">{projectKeys.length} keys</span></TableCell><TableCell>{project.spec?.description}</TableCell><TableCell>{project.spec?.disabled ? "Disabled" : "Enabled"}</TableCell><TableCell>{project.metadata.workspace}</TableCell></TableRow>
        {open && projectKeys.map((key) => <TableRow key={key.id}><TableCell><Checkbox checked={selected.has(key.id)} onCheckedChange={() => toggle(key.id)} /></TableCell><TableCell><button className="text-left hover:underline" onClick={() => show("api_keys", key.metadata.name, "push", { workspace: key.metadata.workspace })}>{key.metadata.name}</button></TableCell><TableCell>{key.description || "-"}</TableCell><TableCell>{key.spec?.limits?.disabled ? "Disabled" : "Enabled"}</TableCell><TableCell>{key.metadata.workspace}</TableCell></TableRow>)}
      </>; })}
    </TableBody></Table>
    <div className="flex items-center justify-end gap-2 text-sm"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><span>{page + 1} / {pages}</span><Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button></div>
    <Dialog open={moveOpen} onOpenChange={setMoveOpen}><DialogContent><DialogHeader><DialogTitle>Move API keys</DialogTitle></DialogHeader><Select value={target} onValueChange={setTarget}><SelectTrigger><SelectValue placeholder="Select target project" /></SelectTrigger><SelectContent>{projects.filter((project) => !project.spec?.disabled && project.id !== target).map((project) => <SelectItem key={project.id} value={project.id}>{project.metadata.name}{project.spec?.description ? ` - ${project.spec.description}` : ""}</SelectItem>)}</SelectContent></Select><DialogFooter><Button variant="secondary" onClick={() => setMoveOpen(false)}>Cancel</Button><Button disabled={!target} onClick={() => void move()}>Move</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
