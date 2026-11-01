import { useState } from 'react';
import { Link } from 'react-router-dom';
export function ErrorState({error,retry}:{error:Error;retry?:()=>void}) {
  return <div className="notice" role="alert"><h2>Couldn’t connect</h2><p>{error.message}</p>{retry && <button onClick={retry}>Try again</button>}</div>;
}
export function Poster({image,title}:{image:string|null;title:string}) {
  const [failed,setFailed]=useState(false);
  return <div className="poster-art">{image && !failed ? <img src={image} alt={title} loading="lazy" onError={()=>setFailed(true)}/> : <span className="poster-fallback"><span aria-hidden="true">▦</span>{title}</span>}</div>;
}
export function LoadingGrid() {
  return <div className="grid" aria-label="Loading shows" role="status">{Array.from({length:12},(_,i)=><div className="skeleton" key={i}/>)}</div>;
}
export function HomeLink() { return <Link className="back" to="/" replace>‹ Home</Link>; }
