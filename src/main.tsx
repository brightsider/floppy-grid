import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queries';
import { Home } from './Home';
import { Show } from './Show';
import './styles.css';
function App() {
  // Refresh relative dates and release eligibility at local midnight and foreground.
  const [day,setDay]=useState(()=>new Date().toDateString());
  useEffect(()=>{
    const refresh=()=>{
      const next=new Date().toDateString();
      setDay(next);
      if(document.visibilityState==='visible') void queryClient.invalidateQueries();
    };
    const now=new Date();
    const timer=setTimeout(refresh,new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime()-now.getTime()+100);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);};
  },[day]);
  return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/show/:source/:id" element={<Show/>}/><Route path="*" element={<main><div className="notice"><h1>Page not found</h1><Link to="/">Return to your shows</Link></div></main>}/></Routes></BrowserRouter>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><App/></QueryClientProvider></React.StrictMode>);
