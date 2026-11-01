import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { libraryOptions, metadataTask, queryClient, seasonOptions, showOptions } from './api/queries';
import { active, findUpcoming, posterStatus } from './lib/status';
import { compareUpNext, isTerminal } from './lib/upNext';
import { ErrorState, LoadingGrid, Poster } from './components/Shared';

export function Home() {
  const library=useQuery(libraryOptions);
  const rows=(library.data || []).filter(active);
  const upcoming=useQueries({queries:rows.map(row=>({
    queryKey:['upcoming',row.item!.source,row.item!.media_id],
    enabled:row.episodes_left === null || row.episodes_left===0,
    queryFn:async()=>{
      const {source,media_id:id}=row.item!;
      const detail=await metadataTask(()=>queryClient.fetchQuery(showOptions(source,id)));
      if (isTerminal(detail.details.status)) return {next:null,lastAirDate:detail.details.last_air_date || null,terminal:true};
      const seasons=(detail.related.seasons || []).filter(s=>s.item?.season_number && s.status!==4);
      const data=await Promise.all(seasons.map(s=>metadataTask(()=>queryClient.fetchQuery(seasonOptions(source,id,s.item!.season_number!)))));
      const next=findUpcoming(data.flatMap(s=>s.related.episodes || [])) || {date:null};
      return {next,lastAirDate:detail.details.last_air_date || null,terminal:false};
    },
  }))});
  const cards=rows.map((row,i)=>({row,status:posterStatus(row.episodes_left,upcoming[i].data?.next || null),query:upcoming[i]}));
  const visible=cards.filter(c=>c.status || c.query.isPending || c.query.isError).sort((a,b)=>compareUpNext(
    {row:a.row,next:a.query.data?.next || null,lastAirDate:a.query.data?.lastAirDate || null},
    {row:b.row,next:b.query.data?.next || null,lastAirDate:b.query.data?.lastAirDate || null},
  ));
  const loading=upcoming.some(q=>q.isFetching);
  const refresh=()=>{void queryClient.invalidateQueries();};
  return <main className="home">
    <header className="app-header"><Link to="/" className="brand" aria-label="Floopy Grid home"><span className="brand-mark" aria-hidden="true">▦</span>floopy<span className="brand-light">grid</span></Link><button className={`icon-button ${library.isFetching || loading ? 'refreshing' : ''}`} aria-label="Refresh shows" onClick={refresh} disabled={library.isFetching || loading}>↻</button></header>
    <div className="section-heading"><h1>Up next</h1><span>{library.data ? `${visible.length} shows` : 'Your TV, in one place'}</span></div>
    {library.isError && <ErrorState error={library.error} retry={refresh}/>}
    {library.isPending ? <LoadingGrid/> : <>
      {upcoming.some(q=>q.isError) && <p className="inline-error" role="alert">Some upcoming episodes couldn’t load. <button onClick={refresh}>Retry</button></p>}
      <div className="grid">{visible.map(({row,status,query})=>{
        const item=row.item!;
        return <Link className="poster-card" key={`${item.source}/${item.media_id}`} to={`/show/${encodeURIComponent(item.source)}/${encodeURIComponent(item.media_id)}`} state={{fromHome:true}} aria-label={`${item.title}, ${status || (query.isError ? 'schedule unavailable' : 'checking schedule')}`}>
          <Poster image={item.image} title={item.title}/><span className={`badge ${row.episodes_left && row.episodes_left>0 ? 'behind' : ''}`}>{status || (query.isError ? 'Check schedule' : '···')}</span>
        </Link>;
      })}</div>
      {!visible.length && !library.isError && <div className="notice empty"><span aria-hidden="true">✓</span><h2>You’re all caught up</h2><p>No active shows with episodes to watch or a known upcoming episode. Manage your TV library in Floppy.</p><button onClick={refresh}>Refresh library</button></div>}
      {!!visible.length && <p className="footer-note">Your next episode, at a glance.</p>}
    </>}
  </main>;
}
