import React from 'react';
export function Tag({tone='neutral',children,style}){
  const tones={neutral:{color:'var(--text-muted)',background:'var(--bg-3)',border:'1px solid var(--line-2)'},
    value:{color:'var(--value)',background:'var(--value-dim)',border:'1px solid rgba(61,220,151,.35)'},
    reach:{color:'var(--reach)',background:'var(--reach-dim)',border:'1px solid rgba(255,92,92,.35)'},
    accent:{color:'var(--accent)',background:'var(--accent-dim)',border:'1px solid rgba(255,180,61,.35)'},
    warn:{color:'var(--warn)',background:'rgba(255,210,61,.12)',border:'1px solid rgba(255,210,61,.3)'}};
  return <span style={{fontSize:'var(--text-xs)',fontWeight:600,padding:'2px 8px',borderRadius:'var(--radius-pill)',display:'inline-block',lineHeight:1.6,whiteSpace:'nowrap',...tones[tone],...style}}>{children}</span>;
}
