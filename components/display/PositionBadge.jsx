import React from 'react';
const POS={QB:'var(--pos-qb)',RB:'var(--pos-rb)',WR:'var(--pos-wr)',TE:'var(--pos-te)',K:'var(--pos-k)',DEF:'var(--pos-def)',FLEX:'var(--pos-flex)',SFLX:'var(--pos-flex)',BN:'var(--fg-3)'};
export function PositionBadge({pos='FLEX',size='md',style}){
  const c=POS[pos]||'var(--fg-3)';
  const s=size==='sm'?{fontSize:9,padding:'1px 5px'}:{fontSize:10,padding:'2px 7px'};
  return <span style={{fontFamily:'var(--font-mono)',fontWeight:700,letterSpacing:'.06em',color:c,background:'color-mix(in srgb,'+ (POS[pos]?c:'var(--fg-3)') +' 14%,transparent)',border:'1px solid color-mix(in srgb,'+c+' 40%,transparent)',borderRadius:4,display:'inline-block',lineHeight:1.5,...s,...style}}>{pos}</span>;
}
