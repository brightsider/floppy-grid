import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { feedOptions, queryClient } from './api/queries';
import { getFeed } from './api/client';
import { posterStatus } from './lib/status';
import { ErrorState, LoadingGrid, Poster } from './components/Shared';
export function CachedHome() {
  const feed=useQuery(feedOptions);
  const data=feed.data;
  const entries=(data?.entries || []).map(entry=>({...entry,status:posterStatus(entry.row.episodes_left,entry.next)})).filter(entry=>entry.status!==null);
  const refresh=async()=>{
    try {queryClient.setQueryData(['feed'],await getFeed(true));}
    catch {void feed.refetch();}
  };
  const busy=feed.isFetching || data?.refreshing;
  return <main className="home">
    <header className="app-header"><Link to="/" className="brand" aria-label="Floppy Grid home"><span className="brand-mark" aria-hidden="true">▦</span>floppy<span className="brand-light">grid</span></Link><button className={`icon-button ${busy?'refreshing':''}`} aria-label="Refresh shows" onClick={()=>void refresh()} disabled={busy}>↻</button></header>
    <div className="section-heading"><h1>Up next</h1><span>{data?.ready?`${entries.length} shows`:'Preparing your feed'}</span></div>
    {feed.isError && <ErrorState error={feed.error} retry={()=>void feed.refetch()}/>}
    {data?.error && <p className="inline-error" role="alert">{data.error} {data.ready?'Showing the last saved feed.':''} <button onClick={()=>void refresh()}>Retry</button></p>}
    {(feed.isPending || (data && !data.ready && !data.error)) && <LoadingGrid/>}
    <div className="grid">{entries.map(({row,status})=>{
      const item=row.item!;
      return <Link className="poster-card" key={`${item.source}/${item.media_id}`} to={`/show/${encodeURIComponent(item.source)}/${encodeURIComponent(item.media_id)}`} state={{fromHome:true}} aria-label={`${item.title}, ${status}`}>
        <Poster image={item.image} title={item.title}/><span className={`badge ${(row.episodes_left || 0)>0?'behind':''}`}>{status}</span>
      </Link>;
    })}</div>
    {data?.ready && !entries.length && !data.error && <div className="notice empty"><span aria-hidden="true">✓</span><h2>You’re all caught up</h2><p>No episodes to watch or confirmed upcoming episodes.</p></div>}
    {data?.updatedAt && <p className="footer-note">Updated {new Date(data.updatedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}{data.refreshing?' · Updating in background…':''}</p>}
    {!data?.ready && data?.refreshing && <p className="footer-note" role="status">Preparing the first feed. Future visits use the saved cache.</p>}
  </main>;
}
