import React from 'react';
export function TierBreak({tier=1,note,style}){
  const c='var(--tier-'+Math.min(6,Math.max(1,tier))+')';
  return <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 12px',...style}}>
    <span style={{fontFamily:'var(--font-mono)',fontSize:10,fontWeight:700,letterSpacing:'.1em',color:c,whiteSpace:'nowrap'}}>TIER {tier}</span>
    <span style={{flex:1,height:1,background:'linear-gradient(90deg,'+c+' 0%,transparent 100%)',opacity:.6}}></span>
    {note&&<span style={{fontSize:'var(--text-xs)',color:'var(--text-faint)',whiteSpace:'nowrap'}}>{note}</span>}
  </div>;
}
