import React from 'react';
import {PositionBadge} from './PositionBadge.jsx';
import {StatDelta} from './StatDelta.jsx';
import {Tag} from './Tag.jsx';
export function PlayerRow({rank,name,pos='FLEX',team,bye,vbd,adpDelta,injury,drafted,onClick,trailing,style}){
  const [hover,setHover]=React.useState(false);
  return <div onClick={onClick} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',minHeight:44,cursor:onClick?'pointer':'default',background:hover&&onClick?'var(--surface-raised)':'transparent',borderBottom:'1px solid var(--line-1)',opacity:drafted?.35:1,textDecoration:drafted?'line-through':'none',transition:'background var(--dur-fast)',...style}}>
    {rank!=null&&<span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-xs)',color:'var(--text-faint)',width:24,textAlign:'right',flexShrink:0}}>{rank}</span>}
    <PositionBadge pos={pos} size="sm"/>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontWeight:600,fontSize:'var(--text-body-size)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</span>
        {injury&&<Tag tone="reach">{injury}</Tag>}
      </div>
      <span style={{fontSize:'var(--text-xs)',color:'var(--text-faint)'}}>{team}{bye!=null?' · BYE '+bye:''}</span>
    </div>
    {vbd!=null&&<span style={{fontFamily:'var(--font-mono)',fontSize:'var(--text-sm)',fontWeight:600,color:'var(--text-body)',flexShrink:0}}>{vbd>0?'+':''}{vbd}</span>}
    {adpDelta!=null&&<StatDelta value={adpDelta} style={{flexShrink:0}}/>}
    {trailing}
  </div>;
}
