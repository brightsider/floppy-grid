import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { showOptions } from './api/queries';
import { ShowEpisodes } from './ShowEpisodes';
import { ErrorState, Poster } from './components/Shared';

export { EpisodeRow } from './components/EpisodeRow';

export function Show() {
  const {source='',id=''}=useParams();
  const location=useLocation();
  const navigate=useNavigate();
  const query=useQuery(showOptions(source,id));
  const back=()=>{if(location.state?.fromHome && window.history.state?.idx>0) void navigate(-1); else void navigate('/',{replace:true});};
  return <main>
    <header className="detail-header"><button className="back" onClick={back}>‹ Back</button><Link to="/" className="quiet-link">Up next</Link></header>
    {query.isPending && <div className="detail-skeleton" role="status">Loading show…</div>}
    {query.isError && <ErrorState error={query.error} retry={()=>void query.refetch()}/>}
    {query.data && <><div className="show-intro"><Poster image={query.data.image} title={query.data.title || 'TV show'}/><div><p className="eyebrow">YOUR EPISODES</p><h1>{query.data.title || 'Untitled show'}</h1><p className="show-hint">One tap to mark watched.</p></div></div>
    <ShowEpisodes key={`${source}/${id}/${location.key}`} source={source} id={id} seasons={query.data.related.seasons || []}/>
    {!query.data.related.seasons?.length && <div className="notice"><h2>No seasons yet</h2><p>Floppy has no season metadata for this show.</p></div>}
    </>}
  </main>;
}
