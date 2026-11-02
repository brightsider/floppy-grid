import { useEffect,useRef } from 'react';
import type { RefObject } from 'react';
import { episodeScrollTarget } from '../lib/episodeScroll';
import type { EpisodeSection } from '../lib/episodeScroll';
/** One automatic move per route entry. User input cancels a delayed move. */
export function useEpisodeAutoScroll(root:RefObject<HTMLDivElement|null>,sections:EpisodeSection[],ready:boolean) {
  const finished=useRef(false);
  useEffect(()=>{
    const cancel=()=>{finished.current=true;};
    const key=(event:KeyboardEvent)=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))cancel();};
    window.addEventListener('wheel',cancel,{passive:true});
    window.addEventListener('touchstart',cancel,{passive:true});
    window.addEventListener('pointerdown',cancel,{passive:true});
    window.addEventListener('keydown',key);
    return ()=>{
      window.removeEventListener('wheel',cancel);
      window.removeEventListener('touchstart',cancel);
      window.removeEventListener('pointerdown',cancel);
      window.removeEventListener('keydown',key);
    };
  },[]);
  useEffect(()=>{
    if(!ready || finished.current) return;
    const frame=requestAnimationFrame(()=>{
      if(finished.current || !root.current) return;
      const target=episodeScrollTarget(sections);
      const element=root.current.querySelector(target==='end'?'[data-episodes-end]':`[data-season="${target.season}"][data-episode="${target.episode}"]`);
      if(element) {
        finished.current=true;
        element.scrollIntoView({behavior:'auto',block:target==='end'?'end':'start'});
      }
    });
    return ()=>cancelAnimationFrame(frame);
  },[ready,root,sections]);
}
