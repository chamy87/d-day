import React from 'react';
export function Select({label,options=[],value,onChange,size='md',style,...rest}){
  const [focus,setFocus]=React.useState(false);
  return <label style={{display:'flex',flexDirection:'column',gap:6,...style}}>
    {label&&<span style={{fontSize:'var(--text-xs)',fontWeight:700,letterSpacing:'var(--track-caps)',textTransform:'uppercase',color:'var(--text-faint)'}}>{label}</span>}
    <div style={{position:'relative'}}>
      <select value={value} onChange={onChange} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} style={{appearance:'none',WebkitAppearance:'none',width:'100%',height:size==='lg'?'var(--control-h-lg)':'var(--control-h)',background:'var(--bg-1)',border:'1px solid '+(focus?'var(--accent)':'var(--border-strong)'),borderRadius:'var(--radius-sm)',color:'var(--text-body)',padding:'0 32px 0 12px',fontSize:'var(--text-body-size)',fontFamily:'var(--font-body)',outline:'none',boxShadow:focus?'0 0 0 3px var(--accent-dim)':'none',cursor:'pointer'}} {...rest}>
        {options.map(o=>typeof o==='string'?<option key={o} value={o}>{o}</option>:<option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--text-faint)',pointerEvents:'none',fontSize:10}}>▼</span>
    </div>
  </label>;
}
