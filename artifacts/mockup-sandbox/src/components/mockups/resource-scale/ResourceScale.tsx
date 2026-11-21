import { useRef, useState, type FormEvent, type CSSProperties } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, CornerDownLeft, Droplets, ExternalLink, Info, LockKeyhole, Sparkles, X, Zap } from "lucide-react";
import "./_group.css";
import { DallesCase } from "./_DallesCase";
import { COMPARISON_BOUNDARY, DALLES, GOOGLE_ANNOUNCEMENT, GOOGLE_REPORT } from "./_caseData";

type Resource = "electricity" | "water";
type Period = "annual" | "daily";
const ARTICLE = "https://www.nola.com/news/environment/meta-louisiana-data-center-water-ai/article_d27dea17-d571-453c-b5a5-0deb571ea272.html";
const ENTERGY = "https://www.entergy.com/news/entergy-louisiana-power-meta-s-data-center-in-richland-parish";
const META = "https://datacenters.atmeta.com/2024/12/hello-louisiana";
const GALLON_LITRES = 3.785411784;
const POOL_LITRES = 50 * 25 * 2 * 1000;
const ANNUAL_GALLONS = [500e6, 600e6] as const;
const BASELINE = 100;
const ADDITION = 30;
const fmt = (n: number, digits = 1) => n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

function FacilityScene({ water }: { water: boolean }) {
  return <figure className="rs-scene">
    <svg viewBox="0 0 600 238" role="img" aria-label={water ? "Illustrative axonometric data-center campus connected to a water system. The pool comparison below carries the quantities." : "Illustrative data-center campus connected to an electrical grid and a lit neighborhood. Houses do not encode households powered."}>
      <defs>
        <linearGradient id="rs-ground" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e6ead9"/><stop offset="1" stopColor="#d9e2cc"/></linearGradient>
        <pattern id="rs-field" width="17" height="17" patternUnits="userSpaceOnUse" patternTransform="rotate(29)"><path d="M0 0V17" stroke="#c5d1b8" strokeWidth=".6"/></pattern>
        <pattern id="rs-roof" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="skewY(-24)"><path d="M0 0V10" stroke="#adbaab" strokeWidth=".7"/></pattern>
      </defs>
      <ellipse cx="292" cy="193" rx="235" ry="26" fill="#607752" opacity=".06"/>
      <path d="M25 151 291 31 580 155 325 235Z" fill="url(#rs-ground)" stroke="#cbd6be"/>
      <path d="M25 151 291 31 580 155 325 235Z" fill="url(#rs-field)"/>
      <path d="m30 152 295 129M164 88l294 126" stroke="#eaf0df" strokeWidth="11"/>
      <path d="m30 152 295 129M164 88l294 126" stroke="#c5cdbb" strokeWidth="1" strokeDasharray="4 5"/>
      <path d="m89 164 170 73M340 69l184 80" stroke="#b3c6a6" strokeWidth="3"/>
      {[{x:132,y:123},{x:203,y:91},{x:273,y:61}].map(({x,y},i) => <g key={i} transform={`translate(${x} ${y})`}>
        <path d="m0 8 95-42 101 44-95 43Z" fill="#82927f" opacity=".14" transform="translate(5 13)"/>
        <path d="m0 0 94-42 102 44-95 43Z" fill="#e3e8dd" stroke="#93a18f" strokeWidth=".7"/>
        <path d="m0 0 101 45v31L0 32Z" fill="#b4c1ac" stroke="#98aa91" strokeWidth=".6"/>
        <path d="m101 45 95-43v31l-95 43Z" fill="#90a68b" stroke="#82987b" strokeWidth=".6"/>
        <path d="m0 0 94-42 102 44-95 43Z" fill="url(#rs-roof)"/>
        {[0,1,2,3,4].map(j=><g key={j} transform={`translate(${22+j*14} ${1+j*6})`}><path d="m0 0 18-8 12 5-18 8Z" fill="#9aa997" stroke="#7e9279" strokeWidth=".5"/><path d="M0 0v5l12 5V5" fill="#7c9276"/></g>)}
        {[0,1,2,3,4,5,6,7].map(j=><path key={j} d={`M${9+j*11} ${16+j*4.8}v11`} stroke="#748a70" strokeWidth="3"/>)}
        <path d="m108 54 78-35" stroke={water?"#b6cdc0":"#e6ce8e"} strokeWidth="2" strokeDasharray="3 3"/>
      </g>)}
      <g fill="none" stroke={water?"#619b99":"#b78650"} strokeWidth="2">
        <path d="m358 167 47 20 73-33"/><path d="m405 187-6 21 81-36"/>
        <path d="m442 170 0-45 33-15"/>
      </g>
      <g transform="translate(439 104)" stroke="#728b76" fill="none" strokeWidth="1.3">
        <path d="m0 50 9-49 10 49M4 27h12M6 14h8M0 50 16 27 6 14M19 50 4 27 14 14M-8 12h35M-4 24h28"/>
        <path d="M-6 12q-25-5-45-23M25 12q20 6 39 1" stroke="#9cae8c"/>
      </g>
      {[{x:459,y:147},{x:494,y:161},{x:430,y:202},{x:468,y:187}].map(({x,y},i)=><g key={i} transform={`translate(${x} ${y})`}>
        <path d="m-3 9 15-13L30 6 15 20Z" fill="#96a78c" opacity=".17" transform="translate(3 9)"/>
        <path d="m0 0 13-6 14 6v17l-14 7L0 17Z" fill="#dce3cc" stroke="#9baa8d" strokeWidth=".7"/>
        <path d="m13 6 14-6v17l-14 7Z" fill="#aab89b"/>
        <path d="M-3 1 10-13 30-3 15 12Z" fill="#7f927a"/><path d="m10-13 5 25L-3 1Z" fill="#9bab90"/>
        <path d="M4 9v6l5 2v-6ZM18 12v6l5-2v-6Z" fill={water?"#c4d5ae":"#f0d08a"}/>
      </g>)}
      {[{x:72,y:156},{x:106,y:173},{x:533,y:167},{x:551,y:153},{x:366,y:60},{x:388,y:71},{x:78,y:126}].map(({x,y},i)=><g key={i} transform={`translate(${x} ${y})`}><path d="M0 0v14" stroke="#8f9e7b"/><ellipse cy="-1" rx="6" ry="11" fill={i%2?"#acbb91":"#bac69d"}/></g>)}
      <path d="m81 65 32 14 42-19M81 65v29M113 79v13" fill="none" stroke="#c0cbb2" strokeWidth=".7"/>
      <text x="38" y="55" fontFamily="DM Sans, sans-serif" fontSize="8" fill="#738566" letterSpacing="1.5">RICHLAND PARISH</text>
      <text x="38" y="68" fontFamily="DM Sans, sans-serif" fontSize="7" fill="#8b987e">LOUISIANA · PROJECT PHASE AS REPORTED DEC 2025</text>
      <g transform="translate(520 63)" stroke="#a5b29a" fill="none"><path d="M0 24V0m-4 5 4-5 4 5"/><text x="-2" y="-6" stroke="none" fill="#89977d" fontSize="7">N</text></g>
    </svg>
    <figcaption className="rs-scene-caption"><span>One campus. A much larger resource system.</span><span>Illustration, not a site plan or scale encoding</span></figcaption>
  </figure>;
}

function PoolRow({ gallons, period, upper }: { gallons: number; period: Period; upper: boolean }) {
  const pools = gallons * GALLON_LITRES / POOL_LITRES / (period === "daily" ? 365 : 1);
  const unit = period === "daily" ? 1 : 25;
  const count = pools / unit;
  return <div className="rs-pool-row" data-testid={`comparison-${upper?"upper":"lower"}`}>
    <div className="rs-pool-label"><span>{upper?"Upper":"Lower"} estimate</span><strong>{fmt(pools, period === "daily" ? 2 : 1)} pool volumes / {period === "daily" ? "day" : "year"}</strong></div>
    <div className={`rs-pools ${period === "daily" ? "rs-daily" : ""}`} role="img" aria-label={`${pools.toFixed(6)} reference pool volumes; each full icon equals ${unit} pool volumes, last icon fractionally filled.`}>
      {Array.from({length:Math.ceil(count)},(_,i)=><div key={i} className="rs-pool" aria-hidden="true"><span style={{width:`${Math.min(1,count-i)*100}%`} as CSSProperties}/></div>)}
    </div>
  </div>;
}

export function ResourceScale() {
  const [caseId, setCaseId] = useState<"louisiana" | "dalles">(() =>
    new URLSearchParams(window.location.search).get("case") === "dalles" ? "dalles" : "louisiana",
  );
  return <div className="rs-workspace">
    <header className="rs-case-header">
      <div className="rs-case-heading">
        <div><span className="rs-kicker">Two documented projects · sandbox study</span><h2>Understand the boundary before the comparison.</h2></div>
        <label className="rs-case-choice">Choose a sourced case
          <select value={caseId} data-testid="select-resource-case" onChange={event => {
            const next = event.target.value === "dalles" ? "dalles" : "louisiana";
            setCaseId(next);
            const url = new URL(window.location.href);
            url.searchParams.set("case", next);
            window.history.replaceState(null, "", url);
          }}>
            <option value="louisiana">Meta · Richland Parish, Louisiana</option>
            <option value="dalles">{DALLES.name}</option>
          </select>
        </label>
      </div>
      <div className="rs-case-context" data-testid="text-case-context" role="status">
        {caseId === "louisiana" ? <>
          <p><strong>Phase & evidence.</strong> Planned campus; 2028 water projection reported December 21, 2025 by <a href={ARTICLE} target="_blank" rel="noreferrer" data-testid="link-case-nola">NOLA.com</a>. Primary scope checks: <a href={META} target="_blank" rel="noreferrer" data-testid="link-case-meta">Meta · December 4, 2024</a> and <a href={ENTERGY} target="_blank" rel="noreferrer" data-testid="link-case-entergy">Entergy · December 6, 2024</a>. Neither primary announcement establishes the article’s numerical water forecast.</p>
          <p><strong>Electricity baseline.</strong> Reported ≈30%; baseline year, denominator and MW/MWh basis unspecified. Normalized illustration only.</p>
          <p><strong>Water boundary.</strong> Projected direct site “use”; net consumption versus withdrawal unspecified. Excludes later expansion claims and indirect electricity-generation water.</p>
        </> : <>
          <p><strong>Phase & evidence.</strong> {DALLES.phase}. <a href={GOOGLE_ANNOUNCEMENT} target="_blank" rel="noreferrer" data-testid="link-case-google-date">Google disclosure · {DALLES.disclosureDate}</a>; <a href={`${GOOGLE_REPORT}#page=80`} target="_blank" rel="noreferrer" data-testid="link-case-google-water">water table · printed page 79</a>.</p>
          <p><strong>Electricity baseline.</strong> No compatible location-specific MW or annual MWh total in this disclosure. Missing is not zero; fleet energy and PUE are not substitutes.</p>
          <p><strong>Water boundary.</strong> {DALLES.reportingPeriod}; direct operational withdrawal and consumption reported separately. Net consumption = withdrawal − discharge. Indirect electricity-generation water excluded.</p>
        </>}
      </div>
      <details className="rs-compatibility" data-testid="details-case-compatibility"><summary data-testid="button-case-compatibility">Why these cases aren’t ranked against each other</summary><p>{COMPARISON_BOUNDARY.electricity}</p><p>{COMPARISON_BOUNDARY.water}</p></details>
    </header>
    {caseId === "louisiana" ? <LouisianaCase/> : <DallesCase/>}
  </div>;
}

function LouisianaCase() {
  const [resource, setResource] = useState<Resource>("electricity");
  const [period, setPeriod] = useState<Period>("annual");
  const [opened, setOpened] = useState(true);
  const [tab, setTab] = useState<"article" | "notes">("article");
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLDetailsElement>(null);
  const electricRef = useRef<HTMLButtonElement>(null);
  const waterRef = useRef<HTMLButtonElement>(null);
  const open = (next: Resource, reveal = false) => {
    setResource(next); setOpened(true); setTab("article");
    if (reveal) window.setTimeout(() => {
      panelRef.current?.focus({preventScroll:true});
      if(window.matchMedia("(max-width: 767px)").matches) panelRef.current?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
    },40);
  };
  const close = () => { setOpened(false); (resource === "electricity" ? electricRef : waterRef).current?.focus(); };
  const runCommand = (e: FormEvent) => {
    e.preventDefault(); const text = command.trim().toLowerCase(); if(!text) return;
    setCommand("");
    if(["electricity","power","water"].includes(text)) { open(text === "water" ? "water" : "electricity",true); setMessage(""); }
    else if(["annual","daily"].includes(text)) { setPeriod(text as Period); open("water",true); setMessage(""); }
    else if(text === "close") {close();setMessage("");}
    else if(text === "sources") {setSourcesOpen(true);open(resource);window.setTimeout(()=>sourceRef.current?.scrollIntoView({block:"center"}),40);setMessage("");}
    else if(text === "notes") {setTab("notes");setMessage("");}
    else {setMessage("Try electricity, water, daily, annual, sources, notes, or close. These are local reading commands, not an AI assistant.");}
  };
  const annual = period === "annual";
  const lower = ANNUAL_GALLONS[0]*GALLON_LITRES/POOL_LITRES/(annual?1:365);
  const upper = ANNUAL_GALLONS[1]*GALLON_LITRES/POOL_LITRES/(annual?1:365);

  return <main className="rs-desk" data-testid="resource-scale">
    <div className="rs-tabs" role="tablist" aria-label="Reading tabs">
      <button className="rs-tab" role="tab" aria-selected={tab === "article"} aria-controls="rs-reading-tab" onClick={()=>setTab("article")} data-testid="tab-article"><BookOpen/>Louisiana’s AI data center</button>
      <button className="rs-tab" role="tab" aria-selected={tab === "notes"} aria-controls="rs-reading-tab" onClick={()=>setTab("notes")} data-testid="tab-notes">Field notes <span style={{opacity:.5}}>02</span></button>
      <span className="rs-wordmark">continuum</span>
    </div>
    <section className="rs-browser" aria-label="Continuum reading browser">
      <div className="rs-toolbar"><BookOpen aria-hidden="true"/><div className="rs-address"><LockKeyhole aria-hidden="true"/>{tab === "article" ? "nola.com / news / environment / meta-louisiana-data-center" : "continuum / field-notes / resource-scale"}</div><span>READING VIEW</span></div>
      <div className="rs-brandbar"><span className="rs-brand"><Sparkles strokeWidth={1.3}/>CONTINUUM</span><span className="rs-edition">A little more understanding.</span></div>
      <div id="rs-reading-tab" role="tabpanel">
      {tab === "notes" ? <section className="rs-notes">
        <div className="rs-kicker">Your field notes · this reading</div>
        <h1>Keep the scale.<br/>Keep the caveats.</h1>
        <p>Two numbers worth understanding, drawn from the same December 2025 report. These notes are written by Continuum, not the publisher.</p>
        <div className="rs-note-grid"><div><h2>Relative, not absolute.</h2><p>The reported 30% electricity addition has an unspecified baseline. A normalized 100 + 30 comparison is honest; a count of powered homes would not be.</p><button data-testid="button-note-electricity" onClick={()=>open("electricity",true)}>Explore electricity <ArrowUpRight size={12} style={{display:"inline"}}/></button></div><div><h2>Volume, not verdict.</h2><p>The annual water range converts to {fmt(ANNUAL_GALLONS[0]*GALLON_LITRES/POOL_LITRES,1)}–{fmt(ANNUAL_GALLONS[1]*GALLON_LITRES/POOL_LITRES,1)} reference pool volumes. A volume analogy alone does not establish environmental harm.</p><button data-testid="button-note-water" onClick={()=>open("water",true)}>Explore water <ArrowUpRight size={12} style={{display:"inline"}}/></button></div></div>
        <a href={ARTICLE} target="_blank" rel="noreferrer" data-testid="link-notes-source">Return to the original reporting <ExternalLink size={11} style={{display:"inline"}}/></a>
      </section> : <div className={`rs-body ${!opened?"rs-closed":""}`}>
        <article className="rs-reading" aria-labelledby="rs-article-title">
          <div className="rs-kicker"><span className="rs-dot"/>Environment / Infrastructure</div>
          <h1 id="rs-article-title">Meta details water needs for Louisiana AI data center</h1>
          <p className="rs-deck">A closer look at the resources behind a new campus in Richland Parish.</p>
          <div className="rs-byline"><span className="rs-initials">JA</span><span><strong>Reporting by Josie Abugov · NOLA.com</strong><br/><span>December 21, 2025</span></span></div>
          <div className="rs-summary-label"><BookOpen/>Factual reading summary · written by Continuum</div>
          <div className="rs-prose">
            <p>Meta’s planned Louisiana AI data center brings large resource needs into focus. NOLA.com reports that the project would increase Entergy’s Louisiana electricity needs by approximately <button ref={electricRef} className="rs-highlight" aria-expanded={opened&&resource==="electricity"} aria-controls="rs-explanation" onClick={()=>open("electricity",true)} data-testid="button-passage-electricity">30% <ArrowUpRight/></button>.</p>
            <p>For operation projected in 2028, the campus is expected to use <button ref={waterRef} className="rs-highlight" aria-expanded={opened&&resource==="water"} aria-controls="rs-explanation" onClick={()=>open("water",true)} data-testid="button-passage-water">500–600 million US gallons of water a year <ArrowUpRight/></button>. The report rounds the average to about 1.5 million gallons a day.</p>
            <p>A separately registered maximum pumping rate exceeds 23 million gallons a day. That is a capacity ceiling, not the expected daily use.</p>
          </div>
          <div className="rs-margin-note"><Info/><span>These are reported projections, not measured use. This reading keeps to the project phase described in December 2025, not later expansions.</span></div>
          <a className="rs-source-link" href={ARTICLE} target="_blank" rel="noreferrer" data-testid="link-original-article">Read Josie Abugov’s original report <ExternalLink/></a>
        </article>
        {opened && <aside ref={panelRef} tabIndex={-1} className="rs-explanation" id="rs-explanation" aria-label={`${resource} scale explanation`} onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();close();}}} data-testid="panel-explanation">
          <div className="rs-panel-top"><div className="rs-kicker"><span className="rs-dot"/>Beyond the number</div><button className="rs-icon-button" aria-label="Close explanation and return to passage" data-testid="button-close-explanation" onClick={close}><X/></button></div>
          <div className="rs-resource-switch" role="group" aria-label="Choose a resource">
            <button aria-pressed={resource==="electricity"} data-testid="button-resource-electricity" onClick={()=>setResource("electricity")}><Zap/>Electricity</button>
            <button aria-pressed={resource==="water"} data-testid="button-resource-water" onClick={()=>setResource("water")}><Droplets/>Water</button>
          </div>
          <div className="rs-title-row"><h2>{resource==="electricity"?"What does 30% more look like?":"Making a large volume tangible."}</h2><span className="rs-step">{resource==="electricity"?"01":"02"} / 02</span></div>
          <p className="rs-intro">{resource==="electricity"?"Start with Entergy’s Louisiana electricity needs as reported. Then make the project’s additional share visible.":"A familiar volume, with a defined size. Both ends of the reported projection belong in the picture."}</p>
          <FacilityScene water={resource==="water"}/>
          {resource==="electricity" ? <section className="rs-quant" aria-label="Normalized electricity comparison" data-testid="comparison-electricity">
            <div className="rs-magnitude"><div className="rs-number">+{ADDITION}<small>on a baseline of {BASELINE}</small></div><p>Approximately 30% more electricity needs in Louisiana, as reported by NOLA.com.</p></div>
            <div className="rs-unit-grids">
              <div className="rs-grid-block"><div className="rs-units" role="img" aria-label="100 countable normalized baseline units">{Array.from({length:BASELINE},(_,i)=><span className="rs-unit" key={i} aria-hidden="true"/>)}</div><div className="rs-grid-caption"><strong>Reported baseline</strong><span>100 units</span></div></div>
              <span style={{alignSelf:"center",color:"#97a58a",fontSize:18}}>+</span>
              <div className="rs-grid-block rs-addition"><div className="rs-units" role="img" aria-label="30 countable additional normalized units">{Array.from({length:ADDITION},(_,i)=><span className="rs-unit" key={i} aria-hidden="true"/>)}</div><div className="rs-grid-caption"><strong>Project</strong><span>+30</span></div></div>
            </div>
            <p className="rs-legend"><i aria-hidden="true"/>1 square = 1% of the normalized baseline · 130 units in total</p>
            <p className="rs-caveat">A relative comparison, not a household count. The report does not specify the baseline year, MW or MWh basis, or precise denominator. No absolute electricity conversion is made.</p>
          </section> : <section className="rs-quant" aria-label="Water volume comparison" data-testid="comparison-water">
            <div className="rs-magnitude"><div className="rs-number rs-water-number" data-testid="text-pool-range">{annual?`${Math.floor(lower)}–${Math.ceil(upper)}`:`${fmt(lower,1)}–${fmt(upper,1)}`}<small>pool volumes / {annual?"year":"day"}</small></div>
              <div className="rs-time-switch" role="group" aria-label="Water time basis"><button aria-pressed={annual} data-testid="button-period-annual" onClick={()=>setPeriod("annual")}>Annual</button><button aria-pressed={!annual} data-testid="button-period-daily" onClick={()=>setPeriod("daily")}>Daily</button></div>
            </div>
            <PoolRow gallons={ANNUAL_GALLONS[0]} period={period} upper={false}/>
            <PoolRow gallons={ANNUAL_GALLONS[1]} period={period} upper/>
            <p className="rs-legend"><i style={{background:"#82ada8"}} aria-hidden="true"/>1 full icon = {annual?"25 reference pool volumes":"1 reference pool volume"} · last icon filled proportionally</p>
            <p className="rs-caveat">One reference pool = 50 × 25 × 2 m = 2.5 million litres. {annual?"The headline is an enclosing rounded range.":"Daily values are annual totals ÷ 365, not a uniform daily pattern; cooling is seasonal."} This is a volume analogy, not actual pools filled or a conclusion about environmental harm.</p>
            <div className="rs-limit"><strong>Separate capacity ceiling: &gt;23 million US gallons/day.</strong> Registered maximum pumping, not expected use or an uncertainty bound. {annual?"Expected site use: 500–600 million US gallons/year.":`Derived average: ${fmt(ANNUAL_GALLONS[0]/365/1e6,2)}–${fmt(ANNUAL_GALLONS[1]/365/1e6,2)} million US gallons/day; article rounded to ≈1.5 million.`}</div>
          </section>}
          <details ref={sourceRef} className="rs-inspect" open={sourcesOpen} onToggle={e=>setSourcesOpen(e.currentTarget.open)} data-testid="details-sources">
            <summary data-testid="button-inspect-sources">Sources, units & what this doesn’t tell us <ChevronDown/></summary>
            <div className="rs-inspect-body">
              <h3>01 · Reported claim & project boundary</h3>
              <p><a href={ARTICLE} target="_blank" rel="noreferrer" data-testid="link-source-nola">Josie Abugov, NOLA.com · December 21, 2025 <ExternalLink size={9} style={{display:"inline"}}/></a>. “Meta details water needs for Louisiana AI data center.” All passage summaries here are authored by Continuum, not quoted publisher paragraphs. Water is projected for 2028 operation. This study excludes later 5 GW expansion claims.</p>
              <h3>02 · Electricity: why no conversion to homes?</h3>
              <p>The reported ≈30% does not establish a baseline year, precise denominator, or whether the basis is power (MW, a rate) or energy (MWh, an amount over time). The 100 + 30 grid is normalized only. The homes in the scene are illustrative, never a powered-household count.</p>
              <p><a href={ENTERGY} target="_blank" rel="noreferrer" data-testid="link-source-entergy">Entergy Louisiana · December 6, 2024</a> describes three turbines totaling 2,260 MW of generation supporting the project and wider growth; that is not the facility’s load. <a href={META} target="_blank" rel="noreferrer" data-testid="link-source-meta">Meta · December 4, 2024</a> describes an initial 4-million-square-foot campus and 1,500 MW of new renewables; neither establishes the data center’s electricity demand.</p>
              <h3>03 · Reproducible water arithmetic</h3>
              <code>1 US gal = {GALLON_LITRES} L<br/>Reference pool = 50 × 25 × 2 × 1,000 = {POOL_LITRES.toLocaleString("en-US")} L<br/>Annual pools = annual US gal × {GALLON_LITRES} ÷ {POOL_LITRES.toLocaleString("en-US")}<br/>{ANNUAL_GALLONS.map(g=>fmt(g*GALLON_LITRES/POOL_LITRES,8)).join("–")} pools/year<br/>Daily pools = annual pools ÷ 365<br/>{ANNUAL_GALLONS.map(g=>fmt(g*GALLON_LITRES/POOL_LITRES/365,8)).join("–")} pools/day</code>
              <p>Annual icons group 25 pool volumes each; daily icons represent one each. Fill fraction = remaining pool volumes ÷ icon unit. Both lower and upper estimates are computed from the reported annual range, with no rounding before geometry.</p>
              <h3>04 · Boundaries & interpretation</h3>
              <p>Water figures cover direct site use only. The report does not establish net consumption versus withdrawal; water associated with electricity generation is excluded. The registered maximum pumping rate is a separate operational capacity, not typical use. The annual average does not describe seasonal cooling or day-to-day variation. A volume comparison alone cannot determine local environmental impact.</p>
            </div>
          </details>
        </aside>}
      </div>}
      </div>
      <footer className="rs-footer"><span><BookOpen/>Reading, with room to explore.</span><span>Source-grounded study · December 2025 project phase · Not live measurements</span></footer>
    </section>
    <div className="rs-command-wrap">
      {message&&<div className="rs-command-message" role="status" data-testid="status-command">{message}</div>}
      <form className="rs-command" onSubmit={runCommand}><Sparkles strokeWidth={1.3}/><input aria-label="Reading command" placeholder="Try “water”, “daily”, or “sources”…" value={command} onChange={e=>setCommand(e.target.value)} data-testid="input-reading-command"/><button aria-label="Run reading command" data-testid="button-run-command"><CornerDownLeft/></button></form>
    </div>
  </main>;
}
