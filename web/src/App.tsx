import {lazy, Suspense, useState} from "react";
import FootballMatch2D from "./FootballMatch2D";
const LegacyApp=lazy(()=>import("./LegacyApp"));
export default function App(){
  const [archive,setArchive]=useState(false);
  return archive?<Suspense fallback={<p className="new-loading">Loading archived evidence demo…</p>}><LegacyApp onBack={()=>setArchive(false)}/></Suspense>:<FootballMatch2D onLegacy={()=>setArchive(true)}/>;
}
