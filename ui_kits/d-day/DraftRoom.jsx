const DraftDS=window.DDayFantasyDesignSystem_0ed541;
const BOARD=[
 {t:1,players:[{r:7,n:'Bijan Robinson',p:'RB',tm:'ATL',b:5,v:62,d:3},{r:8,n:'CeeDee Lamb',p:'WR',tm:'DAL',b:7,v:58,d:-2}]},
 {t:2,players:[{r:9,n:'Drake London',p:'WR',tm:'ATL',b:5,v:44,d:11,inj:'Q'},{r:10,n:'Josh Jacobs',p:'RB',tm:'GB',b:10,v:41,d:6},{r:11,n:'Jayden Daniels',p:'QB',tm:'WAS',b:12,v:39,d:14},{r:12,n:'Trey McBride',p:'TE',tm:'ARI',b:8,v:36,d:-4}]},
 {t:3,players:[{r:13,n:'DK Metcalf',p:'WR',tm:'PIT',b:5,v:28,d:2},{r:14,n:'Joe Burrow',p:'QB',tm:'CIN',b:10,v:27,d:8},{r:15,n:'James Cook',p:'RB',tm:'BUF',b:7,v:25,d:-6}]}
];
const TICKER=[{p:'3.04',t:'Team Riley',n:'Puka Nacua',pos:'WR'},{p:'3.03',t:'BigDawgs',n:'Jahmyr Gibbs',pos:'RB'},{p:'3.02',t:'Waiver Wire Warriors',n:'Amon-Ra St. Brown',pos:'WR'},{p:'3.01',t:'ChampsOnly',n:'Justin Jefferson',pos:'WR'}];
function DraftRoom({onDashboard}){
  const {Card,PlayerRow,TierBreak,Tabs,Switch,Tag,PositionBadge,Button,Toast}=DraftDS;
  const [pos,setPos]=React.useState('ALL');
  const [hide,setHide]=React.useState(true);
  const [drafted,setDrafted]=React.useState([]);
  const pick=n=>setDrafted(d=>[...d,n]);
  const rows=BOARD.map(g=>({...g,players:g.players.filter(pl=>(pos==='ALL'||pl.p===pos)&&!(hide&&drafted.includes(pl.n)))})).filter(g=>g.players.length);
  return <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
    <header style={{display:'flex',alignItems:'center',gap:16,padding:'10px 16px',borderBottom:'1px solid var(--line-1)',background:'var(--surface-panel)'}}>
      <window.Wordmark size={20}/>
      <span style={{fontSize:13,color:'var(--text-muted)'}}>The Gridiron Gentlemen</span>
      <span style={{flex:1}}></span>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--accent-dim)',border:'1px solid rgba(255,180,61,.4)',borderRadius:'var(--radius-pill)',padding:'4px 14px',animation:'dday-pulse 2s infinite'}}>
        <span style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--accent)'}}>On the clock</span>
        <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:18,color:'var(--accent)'}}>1:24</span>
        <span style={{fontSize:11,color:'var(--text-muted)'}}>pick 3.07 · you're up in 2</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onDashboard}>Dashboard →</Button>
    </header>
    <div style={{display:'flex',gap:14,padding:14,flex:1,minHeight:0,alignItems:'stretch'}}>
      <Card title="Best available" pad={false} style={{flex:1,display:'flex',flexDirection:'column',minWidth:0}} action={<div style={{display:'flex',gap:10,alignItems:'center'}}><Tabs size="sm" items={['ALL','QB','RB','WR','TE']} value={pos} onChange={setPos}/><Switch checked={hide} onChange={setHide} label="Hide drafted"/></div>}>
        <div style={{overflowY:'auto',flex:1}}>
          {rows.map(g=><React.Fragment key={g.t}><TierBreak tier={g.t} note={g.players.length+' left'}/>
            {g.players.map(pl=><PlayerRow key={pl.n} rank={pl.r} name={pl.n} pos={pl.p} team={pl.tm} bye={pl.b} vbd={pl.v} adpDelta={pl.d} injury={pl.inj} drafted={drafted.includes(pl.n)} onClick={()=>pick(pl.n)}/>)}
          </React.Fragment>)}
        </div>
      </Card>
      <div style={{width:320,display:'flex',flexDirection:'column',gap:14,flexShrink:0,minHeight:0,overflowY:'auto'}}>
        <Card title="Suggested pick" glow style={{flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}><PositionBadge pos="QB"/><span style={{fontWeight:700,fontSize:16}}>Jayden Daniels</span><Tag tone="value">VALUE +14</Tag></div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>Superflex league and your SFLX slot is empty — QBs thin out after this tier.</div>
        </Card>
        <Card title="My roster" pad={false} style={{flexShrink:0}}>
          {[['QB','Joe Burrow — CIN'],['RB','Bijan Robinson — ATL'],['RB',null],['WR','Nico Collins — HOU'],['WR',null],['TE',null],['FLEX',null],['SFLX',null]].map(([slot,who],i)=>
            <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderBottom:'1px solid var(--line-1)'}}>
              <PositionBadge pos={slot} size="sm"/>
              {who?<span style={{fontSize:13}}>{who}</span>:<span style={{fontSize:13,color:'var(--text-faint)'}}>Empty{(slot==='RB'||slot==='SFLX')&&<Tag tone="warn" style={{marginLeft:8}}>NEED</Tag>}</span>}
            </div>)}
        </Card>
        <Toast tone="warn" title="Scarcity" style={{flexShrink:0}}>Only 2 RBs left in Tier 2.</Toast>
      </div>
    </div>
    <footer style={{display:'flex',gap:10,alignItems:'center',padding:'8px 16px',borderTop:'1px solid var(--line-1)',background:'var(--surface-panel)',overflow:'hidden'}}>
      <span style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--text-faint)',flexShrink:0}}>Recent picks</span>
      {TICKER.map(t=><span key={t.p} style={{display:'inline-flex',gap:6,alignItems:'center',fontSize:12,color:'var(--text-muted)',whiteSpace:'nowrap'}}><span style={{fontFamily:'var(--font-mono)',color:'var(--text-faint)'}}>{t.p}</span><PositionBadge pos={t.pos} size="sm"/><b style={{color:'var(--text-body)',fontWeight:600}}>{t.n}</b><span style={{color:'var(--text-faint)'}}>{t.t}</span></span>)}
    </footer>
  </div>;
}
window.DraftRoom=DraftRoom;
