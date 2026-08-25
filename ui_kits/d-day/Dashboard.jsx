const DashDS=window.DDayFantasyDesignSystem_0ed541;
const STARTERS=[{n:'Joe Burrow',p:'QB',tm:'CIN vs PIT',pr:22.4},{n:'Bijan Robinson',p:'RB',tm:'ATL @ CAR',pr:19.8},{n:'James Cook',p:'RB',tm:'BUF vs NYJ',pr:15.1,risk:'Q · ankle'},{n:'Nico Collins',p:'WR',tm:'HOU @ IND',pr:16.6},{n:'Drake London',p:'WR',tm:'ATL @ CAR',pr:14.9},{n:'Trey McBride',p:'TE',tm:'ARI vs SEA',pr:12.3}];
const WAIVERS=[{n:'Tyjae Spears',p:'RB',tm:'TEN',note:'+41% rostered · lead-back window',faab:'$14'},{n:'Ricky Pearsall',p:'WR',tm:'SF',note:'Target share up 3 straight weeks',faab:'$8'},{n:'Tucker Kraft',p:'TE',tm:'GB',note:'TE1 snaps since Week 4',faab:'$5'}];
const NEWS=[{t:'Cook (ankle) limited Wednesday; game-time call',s:'FantasySP · 2h'},{t:'Robinson clears 100 scrimmage yards in 5 straight',s:'ESPN · 4h'},{t:'McBride sees season-high 11 targets',s:'ESPN · 1d'}];
function Dashboard({onDraft}){
  const {Card,Tabs,Tag,PositionBadge,Button,StatDelta}=DashDS;
  const [tab,setTab]=React.useState('START/SIT');
  return <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
    <header style={{display:'flex',alignItems:'center',gap:16,padding:'10px 16px',borderBottom:'1px solid var(--line-1)',background:'var(--surface-panel)'}}>
      <window.Wordmark size={20}/>
      <span style={{fontSize:13,color:'var(--text-muted)'}}>The Gridiron Gentlemen · Week 8</span>
      <span style={{flex:1}}></span>
      <Tabs items={['START/SIT','MATCHUP','WAIVERS','NEWS']} value={tab} onChange={setTab} size="sm"/>
      <Button variant="ghost" size="sm" onClick={onDraft}>← Draft room</Button>
    </header>
    <div style={{padding:14,flex:1,minHeight:0,overflowY:'auto'}}>
      {tab==='START/SIT'&&<div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14,alignItems:'start'}}>
        <Card title="Your starters — projected (half PPR)" pad={false}>
          {STARTERS.map(s=><div key={s.n} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderBottom:'1px solid var(--line-1)',minHeight:44}}>
            <PositionBadge pos={s.p} size="sm"/>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,display:'flex',gap:6,alignItems:'center'}}>{s.n}{s.risk&&<Tag tone="reach">{s.risk}</Tag>}</div><div style={{fontSize:11,color:'var(--text-faint)'}}>{s.tm}</div></div>
            <span style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:14}}>{s.pr.toFixed(1)}</span>
          </div>)}
        </Card>
        <Card title="Flags">
          <div style={{fontSize:13,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:10}}>
            <div><Tag tone="reach">RISK</Tag> Cook is a game-time call — <b style={{color:'var(--text-body)'}}>Tyjae Spears</b> projects within 1.2 pts.</div>
            <div><Tag tone="value">START</Tag> London draws the league's worst WR coverage. <StatDelta value={3} label="proj vs avg"/></div>
          </div>
        </Card>
      </div>}
      {tab==='MATCHUP'&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,alignItems:'start'}}>
        {[{t:'Your team',pts:'101.1',rows:STARTERS},{t:'BigDawgs',pts:'96.4',rows:STARTERS.slice().reverse()}].map((side,i)=>
        <Card key={i} title={side.t} pad={false} action={<span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:i===0?'var(--value)':'var(--text-muted)'}}>{side.pts}</span>}>
          {side.rows.map(s=><div key={s.n} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--line-1)'}}>
            <PositionBadge pos={s.p} size="sm"/><span style={{flex:1,fontSize:13,fontWeight:600}}>{s.n}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:13}}>{s.pr.toFixed(1)}</span>
          </div>)}
        </Card>)}
      </div>}
      {tab==='WAIVERS'&&<Card title="Waiver targets — trending ∩ unrostered" pad={false} style={{maxWidth:640}}>
        {WAIVERS.map(w=><div key={w.n} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderBottom:'1px solid var(--line-1)'}}>
          <PositionBadge pos={w.p} size="sm"/>
          <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{w.n} <span style={{color:'var(--text-faint)',fontWeight:400,fontSize:12}}>{w.tm}</span></div><div style={{fontSize:12,color:'var(--text-muted)'}}>{w.note}</div></div>
          <Tag tone="neutral">FAAB {w.faab}</Tag>
        </div>)}
      </Card>}
      {tab==='NEWS'&&<Card title="News — your players" pad={false} style={{maxWidth:640}}>
        {NEWS.map((n,i)=><div key={i} style={{padding:'10px 12px',borderBottom:'1px solid var(--line-1)'}}>
          <div style={{fontSize:14,fontWeight:600}}>{n.t}</div><div style={{fontSize:11,color:'var(--text-faint)',marginTop:2}}>{n.s}</div>
        </div>)}
      </Card>}
    </div>
    <footer style={{fontSize:11,color:'var(--text-faint)',padding:'8px 16px',borderTop:'1px solid var(--line-1)'}}>Data: Sleeper · nflverse (CC-BY) · FantasyFootballCalculator · FantasyCalc · Boris Chen</footer>
  </div>;
}
window.Dashboard=Dashboard;
