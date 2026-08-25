import React from 'react';
export function Switch({checked,onChange,label,disabled,style}){
  return <label style={{display:'inline-flex',alignItems:'center',gap:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.45:1,...style}}>
    <span role="switch" aria-checked={!!checked} tabIndex={0} onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();!disabled&&onChange&&onChange(!checked)}}} onClick={()=>!disabled&&onChange&&onChange(!checked)} style={{width:38,height:22,borderRadius:'var(--radius-pill)',background:checked?'var(--accent)':'var(--bg-3)',border:'1px solid '+(checked?'var(--accent)':'var(--border-strong)'),position:'relative',transition:'background var(--dur-fast) var(--ease-snap)',flexShrink:0}}>
      <span style={{position:'absolute',top:2,left:checked?18:2,width:16,height:16,borderRadius:'50%',background:checked?'var(--accent-ink)':'var(--fg-2)',transition:'left var(--dur-fast) var(--ease-snap)'}}></span>
    </span>
    {label&&<span style={{fontSize:'var(--text-sm)',color:'var(--text-body)'}}>{label}</span>}
  </label>;
}
