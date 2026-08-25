import React from 'react';
export function Card({title,action,pad=true,glow,children,style}){
  return <div style={{background:'var(--surface-card)',border:'1px solid var(--border-card)',borderRadius:'var(--radius-lg)',boxShadow:glow?'var(--glow-accent)':'var(--shadow-card)',overflow:'hidden',...style}}>
    {title&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'10px 16px',borderBottom:'1px solid var(--line-1)'}}>
      <span style={{fontSize:'var(--text-xs)',fontWeight:700,letterSpacing:'var(--track-caps)',textTransform:'uppercase',color:'var(--text-faint)'}}>{title}</span>
      {action}
    </div>}
    <div style={{padding:pad?'var(--card-pad)':0}}>{children}</div>
  </div>;
}
