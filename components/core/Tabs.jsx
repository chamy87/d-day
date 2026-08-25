import React from 'react';
export function Tabs({items=[],value,onChange,size='md',style}){
  return <div role="tablist" style={{display:'inline-flex',gap:2,background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:'var(--radius-sm)',padding:2,...style}}>
    {items.map(it=>{const v=typeof it==='string'?it:it.value,l=typeof it==='string'?it:it.label,on=v===value;
      return <button key={v} role="tab" aria-selected={on} onClick={()=>onChange&&onChange(v)} style={{height:size==='sm'?24:30,padding:size==='sm'?'0 10px':'0 14px',border:'none',borderRadius:4,cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:600,fontSize:size==='sm'?'var(--text-xs)':'var(--text-sm)',letterSpacing:'.03em',textTransform:'uppercase',background:on?'var(--surface-raised)':'transparent',color:on?'var(--accent)':'var(--text-muted)',boxShadow:on?'0 1px 4px rgba(0,0,0,.4)':'none',transition:'all var(--dur-fast)'}}>{l}</button>;})}
  </div>;
}
