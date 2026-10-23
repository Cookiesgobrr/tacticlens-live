import {useEffect,useRef,useState} from "react";

/**
 * One-time, optional guided tour. Pure UI state: never changes the match
 * simulation, replay clock, event IDs, or Microsoft Foundry cache.
 *
 * URL controls: ?tour=off skips onboarding for judge-video automation;
 * ?tour=on forces the tour without changing the persisted preference.
 */
const TOUR_KEY="tacticlens.onboarding.v1";
const steps=[
  {
    target:".new-pitchwrap",title:"Watch the match",eyebrow:"01 / 04",
    message:"This is your live match studio. Switch between 3D and 2D, follow the ball, and use the camera controls to get closer to the action."
  },
  {
    target:".match-highlights",title:"Replay key moments",eyebrow:"02 / 04",
    message:"Goals, chances and defensive actions appear here. Turn on Full-match review to reveal every highlight, then select one to replay it."
  },
  {
    target:"#match-intelligence",title:"Meet Microsoft Foundry",eyebrow:"03 / 04",
    message:"Open a verified insight, then switch between Fan, Analyst, Club and Player views. Each story links back to the events that support it."
  },
  {
    target:".formation-diagrams",title:"Explore team formations",eyebrow:"04 / 04",
    message:"Open Team formations to compare both clubs' starting shapes, measured positioning and evidence-linked analysis."
  }
] as const;
type Highlight={left:number;top:number;width:number;height:number};
function startOpen(){
  const query=new URLSearchParams(location.search).get("tour");
  if(query==="off"||query==="0")return false;
  if(query==="on")return true;
  try{return localStorage.getItem(TOUR_KEY)!=="done";}catch{return true;}
}

export default function NewUserTour({restartToken}:{restartToken:number}){
  const [open,setOpen]=useState(startOpen);
  const [step,setStep]=useState(0);
  const [highlight,setHighlight]=useState<Highlight|null>(null);
  const nextButton=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!restartToken)return;
    setStep(0);setOpen(true);
  },[restartToken]);

  useEffect(()=>{
    if(!open)return;
    const target=document.querySelector<HTMLElement>(steps[step].target);
    if(!target){setHighlight(null);return;}
    target.scrollIntoView({behavior:"auto",block:"center",inline:"nearest"});
    const update=()=>{
      const b=target.getBoundingClientRect();
      const pad=7;
      setHighlight({
        left:Math.max(3,b.left-pad),top:Math.max(3,b.top-pad),
        width:Math.min(window.innerWidth-6,Math.max(0,b.right+pad)-Math.max(3,b.left-pad)),
        height:Math.min(window.innerHeight-6,Math.max(0,b.bottom+pad)-Math.max(3,b.top-pad))
      });
    };
    const frame=requestAnimationFrame(update);
    window.addEventListener("scroll",update,true);
    window.addEventListener("resize",update);
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(update):null;
    observer?.observe(target);
    nextButton.current?.focus();
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",update,true);window.removeEventListener("resize",update);observer?.disconnect();};
  },[open,step]);

  function finish(){
    try{localStorage.setItem(TOUR_KEY,"done");}catch{}
    setOpen(false);setHighlight(null);
  }
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();finish();}
      if(e.key==="ArrowRight"){e.preventDefault();if(step===steps.length-1)finish();else setStep(s=>s+1);}
      if(e.key==="ArrowLeft"){e.preventDefault();setStep(s=>Math.max(0,s-1));}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[open,step]);

  if(!open)return null;
  const vw=window.innerWidth,vh=window.innerHeight;
  const width=Math.min(360,vw-24);
  const below=highlight?highlight.top+highlight.height+16:0;
  const above=highlight?highlight.top-214:0;
  const top=highlight
    ? below+220<vh?below:above>=12?above:Math.max(12,vh-230)
    :Math.max(12,vh-240);
  const left=highlight?Math.max(12,Math.min(vw-width-12,highlight.left+Math.min(highlight.width/2,150)-40)):12;
  const details=steps[step];
  return <div className="tour-root" data-testid="first-visit-tour">
    <div className="tour-click-shield" aria-hidden="true"/>
    {highlight&&<div className="tour-spotlight" aria-hidden="true"
      style={{left:highlight.left,top:highlight.top,width:highlight.width,height:highlight.height}}/>}
    <section className="tour-dialog" role="dialog" aria-modal="true" aria-labelledby="tour-title"
      aria-describedby="tour-description" style={{top,left,width}}>
      <div className="tour-progress"><span>{details.eyebrow}</span><button type="button" onClick={finish}>Skip tour</button></div>
      <h2 id="tour-title">{details.title}</h2>
      <p id="tour-description">{details.message}</p>
      <div className="tour-footer">
        <div className="tour-steps" aria-label="Tour progress">{steps.map((_,i)=><span key={i} className={i===step?"active":""}/>)}</div>
        <div className="tour-actions">
          {step>0&&<button type="button" onClick={()=>setStep(s=>s-1)}>Back</button>}
          <button ref={nextButton} type="button" className="tour-next"
            onClick={()=>step===steps.length-1?finish():setStep(s=>s+1)}>
            {step===steps.length-1?"Finish tour":"Next →"}
          </button>
        </div>
      </div>
    </section>
  </div>;
}
