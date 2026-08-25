import React from 'react';
export function Skeleton({width='100%',height=16,round,style}){
  return <span className="dday-skeleton" style={{display:'block',width,height,borderRadius:round?'var(--radius-pill)':'var(--radius-sm)',...style}}></span>;
}
