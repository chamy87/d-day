import React from 'react';
export function IconButton({label,size='md',active,disabled,children,style,...rest}){
  const d=size==='sm'?28:size==='lg'?44:36;
  const [hover,setHover]=React.useState(false);
  return <button aria-label={label} title={label} disabled={disabled} style={{width:d,height:d,display:'inline-flex',alignItems:'center',justifyContent:'center',background:active?'var(--accent-dim)':hover&&!disabled?'var(--bg-3)':'transparent',color:active?'var(--accent)':hover?'var(--text-body)':'var(--text-muted)',border:'1px solid '+(active?'rgba(255,180,61,.35)':'transparent'),borderRadius:'var(--radius-sm)',cursor:disabled?'not-allowed':'pointer',opacity:disabled?.45:1,transition:'all var(--dur-fast) var(--ease-snap)',...style}} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} {...rest}>{children}</button>;
}
