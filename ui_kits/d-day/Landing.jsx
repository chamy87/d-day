const DS=window.DDayFantasyDesignSystem_0ed541;
function Wordmark({size=22}){
  return <span style={{fontFamily:'var(--font-display)',fontStretch:'125%',fontWeight:850,fontSize:size,letterSpacing:'-.02em',lineHeight:1}}><span style={{color:'var(--accent)'}}>D-</span>DAY</span>;
}
function Landing({onEnter}){
  const {Button,Input,Card,Tag,PositionBadge}=DS;
  const [id,setId]=React.useState('');
  const [found,setFound]=React.useState(false);
  const lookup=()=>{if(id.trim())setFound(true)};
  return <div style={{minHeight:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'48px 24px',gap:32}}>
    <div style={{textAlign:'center'}}>
      <Wordmark size={72}/>
      <div style={{fontSize:13,fontWeight:700,letterSpacing:'var(--track-caps)',textTransform:'uppercase',color:'var(--text-faint)',marginTop:10}}>Fantasy football draft assistant</div>
      <div style={{fontSize:15,color:'var(--text-muted)',marginTop:14,maxWidth:440}}>Paste your Sleeper league ID. No login, no setup — rankings tuned to your league's exact scoring and roster.</div>
    </div>
    <div style={{display:'flex',gap:10,alignItems:'flex-end',width:'100%',maxWidth:480}}>
      <Input label="Sleeper league ID" mono size="lg" placeholder="992093874321055744" value={id} onChange={e=>setId(e.target.value)} style={{flex:1}} onKeyDown={e=>e.key==='Enter'&&lookup()}/>
      <Button variant="primary" size="lg" onClick={lookup}>Find league</Button>
    </div>
    {found&&<Card title="League detected" style={{width:'100%',maxWidth:480}} action={<Tag tone="accent">DRAFTING</Tag>}>
      <div style={{fontFamily:'var(--font-display)',fontStretch:'125%',fontWeight:850,fontSize:20}}>The Gridiron Gentlemen</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
        <Tag>12 teams</Tag><Tag>Half PPR</Tag><Tag>Superflex</Tag><Tag>Snake · pick 3.07</Tag>
      </div>
      <div style={{display:'flex',gap:4,marginTop:12,flexWrap:'wrap'}}>
        {['QB','RB','RB','WR','WR','TE','FLEX','SFLX','K','DEF','BN','BN'].map((p,i)=><PositionBadge key={i} pos={p} size="sm"/>)}
      </div>
      <div style={{marginTop:16}}><Button variant="primary" style={{width:'100%'}} onClick={onEnter}>Enter draft room →</Button></div>
    </Card>}
    <div style={{fontSize:11,color:'var(--text-faint)',marginTop:'auto'}}>Data: Sleeper · nflverse · FantasyFootballCalculator · FantasyCalc · Boris Chen</div>
  </div>;
}
Object.assign(window,{Landing,Wordmark});
