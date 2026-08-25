import React from 'react';
export function Toast({tone='neutral',title,children,style}){
  const c=tone==='value'?'var(--value)':tone==='reach'?'var(--reach)':tone==='accent'?'var(--accent)':'var(--fg-2)';
  return <div role="status" style={{display:'flex',gap:10,alignItems:'flex-start',background:'var(--surface-raised)',border:'1px solid var(--border-strong)',borderLeft:'1px solid var(--border-strong)',borderRadius:'var(--radius-md)',boxShadow:'var(--shadow-pop)',padding:'10px 14px',maxWidth:360,...style}}>
    <span style={{width:8,height:8,borderRadius:'50%',background:c,marginTop:5,flexShrink:0}}></span>
    <div style={{minWidth:0}}>
      {title&&<div style={{fontWeight:700,fontSize:'var(--text-sm)'}}>{title}</div>}
      <div style={{fontSize:'var(--text-sm)',color:'var(--text-muted)'}}>{children}</div>
    </div>
  </div>;
}
