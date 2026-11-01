import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Home } from './Home';
import { queryClient } from './api/queries';
import type { TrackedMedia } from './api/types';
const watchedShow:TrackedMedia={status:1,episodes_left:0,total_episodes_left:0,tracked:true,end_date:null,item_id:'tmdb_tv_1',next_episode:null,item:{source:'tmdb',media_id:'1',title:'Finished show',image:'https://example.com/poster.jpg',release_datetime:null,season_number:null,episode_number:null}};
const render=()=>renderToStaticMarkup(<QueryClientProvider client={queryClient}><MemoryRouter><Home/></MemoryRouter></QueryClientProvider>);
beforeEach(()=>{
  queryClient.clear();
  queryClient.setQueryData(['library'],[watchedShow]);
});
afterEach(()=>{queryClient.clear();queryClient.setQueryDefaults(['upcoming'],{retryOnMount:true});});
describe('Home displays only confirmed eligible posters',()=>{
  it('does not show a watched candidate while its schedule is pending',()=>{
    const html=render();
    expect(html).not.toContain('poster-card');
    expect(html).not.toContain('···');
  });
  it('does not show a watched candidate after confirmed absence of upcoming episodes',()=>{
    queryClient.setQueryData(['upcoming','tmdb','1'],{next:null,lastAirDate:null,terminal:true});
    expect(render()).not.toContain('poster-card');
  });
  it('does not add an ineligible poster when schedule verification fails',()=>{
    queryClient.setQueryDefaults(['upcoming'],{retryOnMount:false});
    const query=queryClient.getQueryCache().build(queryClient,{queryKey:['upcoming','tmdb','1']});
    query.setState({status:'error',error:new Error('Floppy unavailable'),fetchStatus:'idle'});
    const html=render();
    expect(html).not.toContain('poster-card');
    expect(html).toContain('Some upcoming episodes couldn’t load.');
  });
  it('shows confirmed backlog immediately, without waiting for metadata',()=>{
    queryClient.setQueryData(['library'],[{...watchedShow,episodes_left:3}]);
    const html=render();
    expect(html).toContain('poster-card');
    expect(html).toContain('3 behind');
  });
  it('shows an actual upcoming episode after metadata arrives',()=>{
    queryClient.setQueryData(['upcoming','tmdb','1'],{next:{date:'2099-01-01'},lastAirDate:null,terminal:false});
    expect(render()).toContain('poster-card');
  });
});
