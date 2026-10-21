import { Link } from 'react-router';
import type { Cluster } from '../types';
import { GpuObservationCard } from '@/foundation/components/GpuObservationCard';
import { observedDevices, parseTflops, TFLOPS_ANNOTATION } from '@/foundation/lib/accelerator-tflops';
import { reading, allocationColor, type AcceleratorSample, type GpuAllocation } from '@/foundation/lib/accelerator-observations';
import { useTranslation } from '@/foundation/lib/i18n';
export function ClusterTopology({cluster,samples,allocations}:{cluster:Cluster;samples:AcceleratorSample[];allocations:GpuAllocation[]}) {
 const {t}=useTranslation();const devices=observedDevices(cluster.status?.resource_info);
 const overrides=parseTflops(cluster.metadata.annotations?.[TFLOPS_ANNOTATION]);
 const hardware=(node:string,uuid:string)=>Object.assign({},...['hardware','nvidia','npu','hcu'].map(kind=>reading(samples,`neutree_node_accelerator_${kind}_info`,node,uuid)?.labels ?? {})) as Record<string,string>;
 const known=(s?:string)=>s && s!=='unknown' && s!=='-1' ? s : '—';
 if(!devices.length)return <p className="p-4 text-sm text-muted-foreground">{t('observations.noTopology')}</p>;
 return <div className="space-y-4">{[...new Set(devices.map(d=>d.node))].map(node=>{
  const cards=devices.filter(d=>d.node===node);const groups=[...new Set(cards.map(d=>known(hardware(node,d.uuid).numa_node)))];
  const links=[...new Set(cards.flatMap(d=>{const h=hardware(node,d.uuid);return [h.nvlink==='1'?'NVLink':null,h.nvswitch==='1'?'NVSwitch':null,h.hccs_capable==='1'?'HCCS':null].filter((v):v is string=>!!v);}))];
  return <section key={node} className="rounded-lg border p-4"><h3 className="mb-3 break-all text-sm font-medium">{node}</h3>
   <div className="grid gap-3 lg:grid-cols-2">{groups.map(group=><div key={group} className="rounded-lg border bg-muted/30 p-3"><h4 className="mb-3 text-xs text-muted-foreground">{group==='—'?t('observations.unknownNuma'):`NUMA ${group}`}</h4>
    <div className="grid gap-3 sm:grid-cols-2">{cards.filter(d=>known(hardware(node,d.uuid).numa_node)===group).map(device=>{
     const h=hardware(node,device.uuid);const temp=reading(samples,'neutree_accelerator_temperature_celsius',node,device.uuid)?.value;const power=reading(samples,'neutree_accelerator_power_usage_watts',node,device.uuid)?.value;
     const assigned=allocations.filter(a=>a.node===node&&a.uuid===device.uuid);
     return <div key={device.uuid} className="min-w-0 space-y-2 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><GpuObservationCard device={device} samples={samples} allocations={allocations} tflopsOverrides={overrides} detailsTrigger={<span className="text-left">GPU {device.index} · {device.product}</span>}/><span className="text-xs tabular-nums text-muted-foreground">{temp?.toFixed(0) ?? '—'} °C · {power?.toFixed(0) ?? '—'} W</span></div>
      <div className="break-all rounded bg-muted px-2 py-1 font-mono text-xs">PCIe Gen{known(h.pcie_generation)} ×{known(h.pcie_width)} · {known(h.pcie_bus_id)}</div>
      <div className="flex flex-wrap gap-2">{assigned.map((a,i)=><Link key={`${a.endpoint}/${a.instance}/${a.vdevice}`} to={`/${encodeURIComponent(a.workspace)}/endpoints/show/${encodeURIComponent(a.endpoint)}`} className="inline-flex max-w-full items-center gap-1 text-xs hover:underline" title={a.replica||a.instance}><span className="h-2 w-2 shrink-0 rounded-full" style={{backgroundColor:allocationColor(a.endpoint,i)}}/><span className="truncate">{a.endpoint} · {a.replica||a.instance}</span></Link>)}</div>
     </div>;
    })}</div>
   </div>)}</div>
   {links.length>0 && <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">{links.join(' / ')} · {t('observations.interconnectEnabled')}</div>}
  </section>;
 })}</div>;
}
