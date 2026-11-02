import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClientProvider } from '@tanstack/react-query';
import { EpisodeRow } from './Show';
import { queryClient } from './api/queries';
import type { TrackedMedia } from './api/types';
function render(number:number,optimisticWatched=false) {
  const episode={tracked:true,optimisticWatched,item:{episode_number:number,title:`Episode ${number}`,release_datetime:'2020-01-01'}} as TrackedMedia;
  const summary={progress:7,next_episode:{episode_number:8}} as TrackedMedia;
  return renderToStaticMarkup(<QueryClientProvider client={queryClient}><EpisodeRow episode={episode} source="tmdb" id="test" season={2} summary={summary}/></QueryClientProvider>);
}
describe('rewatching episode controls',()=>{
  it('renders the last old watched episode as actionable in the current pass',()=>{
    const html=render(8);
    expect(html).toContain('Mark Episode 8 watched');
    expect(html).toContain('○');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('✓');
  });
  it('keeps already rewatched episodes checked and disabled',()=>{
    const html=render(7);
    expect(html).toContain('Watched: Episode 7');
    expect(html).toContain('✓');
    expect(html).toContain('disabled');
  });
  it('checks an optimistic rewatch immediately',()=>{
    expect(render(8,true)).toContain('Watched: Episode 8');
  });
});
