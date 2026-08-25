import React from 'react';
export function StatDelta({value=0,suffix='',label,style}){
  const up=value>0,flat=value===0;
  const c=flat?'var(--text-faint)':up?'var(--value)':'var(--reach)';
  return <span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-sm)',fontWeight:600,color:c,display:'inline-flex',alignItems:'baseline',gap:4,...style}}>
    <span>{flat?'·':up?'▲':'▼'}{Math.abs(value)}{suffix}</span>
    {label&&<span style={{fontSize:'var(--text-xs)',color:'var(--text-faint)',fontFamily:'var(--font-body)'}}>{label}</span>}
  </span>;
}
