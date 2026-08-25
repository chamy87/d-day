import React from 'react';
export function Button({variant='primary',size='md',disabled,icon,children,style,...rest}){
  const base={fontFamily:'var(--font-body)',fontWeight:600,letterSpacing:'.01em',border:'1px solid transparent',borderRadius:'var(--radius-sm)',cursor:disabled?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',gap:8,justifyContent:'center',transition:'background var(--dur-fast) var(--ease-snap),transform var(--dur-fast)',opacity:disabled?.45:1,height:size==='lg'?'var(--control-h-lg)':size==='sm'?28:'var(--control-h)',padding:size==='lg'?'0 20px':size==='sm'?'0 10px':'0 14px',fontSize:size==='sm'?'var(--text-sm)':'var(--text-body-size)'};
  const variants={
    primary:{background:'var(--accent)',color:'var(--accent-ink)'},
    secondary:{background:'var(--surface-raised)',color:'var(--text-body)',borderColor:'var(--border-strong)'},
    ghost:{background:'transparent',color:'var(--text-muted)'},
    danger:{background:'var(--reach-dim)',color:'var(--reach)',borderColor:'rgba(255,92,92,.35)'}
  };
  const [hover,setHover]=React.useState(false),[press,setPress]=React.useState(false);
  const hov=hover&&!disabled?(variant==='primary'?{background:'var(--accent-hover)'}:variant==='ghost'?{color:'var(--text-body)',background:'var(--bg-2)'}:{background:'var(--bg-3)',filter:'brightness(1.15)'}):{};
  const prs=press&&!disabled?{transform:'translateY(1px)',...(variant==='primary'?{background:'var(--accent-press)'}:{})}:{};
  return <button disabled={disabled} style={{...base,...variants[variant],...hov,...prs,...style}} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>{setHover(false);setPress(false)}} onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)} {...rest}>{icon}{children}</button>;
}
