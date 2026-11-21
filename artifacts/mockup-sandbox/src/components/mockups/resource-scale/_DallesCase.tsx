import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, CornerDownLeft, Droplets, ExternalLink, Info, LockKeyhole, Sparkles, X, Zap } from "lucide-react";
import { COMPARISON_BOUNDARY, DALLES, GOOGLE_ANNOUNCEMENT, GOOGLE_REPORT, REFERENCE_POOL_LITRES, US_GALLON_LITRES, dallesWater, type WaterMetric, type WaterPeriod } from "./_caseData";

const fmt = (n: number, digits = 1) => n.toLocaleString("en-US", { maximumFractionDigits: digits });

export function DallesCase() {
  const [resource, setResource] = useState<"water" | "electricity">("water");
  const [metric, setMetric] = useState<WaterMetric>("withdrawal");
  const [period, setPeriod] = useState<WaterPeriod>("annual");
  const [opened, setOpened] = useState(true);
  const [notes, setNotes] = useState(false);
  const [sources, setSources] = useState(false);
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLDetailsElement>(null);
  const passageRef = useRef<HTMLButtonElement>(null);
  const electricityRef = useRef<HTMLButtonElement>(null);
  const water = dallesWater(metric, period);
  const annual = period === "annual";
  const metricLabel = metric === "withdrawal" ? "Withdrawal" : "Net consumption";
  const open = (next: "water" | "electricity") => {
    setResource(next); setOpened(true); setNotes(false);
    window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 767px)").matches) panelRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }, 40);
  };
  const close = () => {
    setOpened(false);
    (resource === "water" ? passageRef : electricityRef).current?.focus();
  };
  const runCommand = (event: FormEvent) => {
    event.preventDefault();
    const text = command.trim().toLowerCase();
    if (!text) return;
    setCommand(""); setMessage("");
    if (text === "water" || text === "electricity" || text === "power") open(text === "water" ? "water" : "electricity");
    else if (text === "daily" || text === "annual") { setPeriod(text); open("water"); }
    else if (text === "withdrawal" || text === "consumption") { setMetric(text); open("water"); }
    else if (text === "sources") { setSources(true); open(resource); window.setTimeout(() => sourceRef.current?.scrollIntoView({ block: "center" }), 60); }
    else if (text === "notes") setNotes(true);
    else if (text === "close") close();
    else setMessage("Try water, withdrawal, consumption, daily, annual, electricity, sources, notes, or close. Local reading commands only, not an AI assistant.");
  };
  return <main className="rs-desk" data-testid="resource-scale-dalles">
    <div className="rs-tabs" role="tablist" aria-label="Reading tabs">
      <button className="rs-tab" role="tab" aria-selected={!notes} aria-controls="rs-dalles-tab" data-testid="tab-article" onClick={() => setNotes(false)}><BookOpen/>The Dalles · 2023 disclosures</button>
      <button className="rs-tab" role="tab" aria-selected={notes} aria-controls="rs-dalles-tab" data-testid="tab-notes" onClick={() => setNotes(true)}>Field notes</button>
      <span className="rs-wordmark">continuum</span>
    </div>
    <section className="rs-browser" aria-label="Continuum reading browser">
      <div className="rs-toolbar"><BookOpen aria-hidden="true"/><div className="rs-address"><LockKeyhole aria-hidden="true"/>{notes ? "continuum / field-notes / the-dalles" : "google / 2024-environmental-report / 2023-data"}</div><span>PRIMARY DISCLOSURE</span></div>
      <div className="rs-brandbar"><span className="rs-brand"><Sparkles strokeWidth={1.3}/>CONTINUUM</span><span className="rs-edition">A little more understanding.</span></div>
      <div id="rs-dalles-tab" role="tabpanel">
        {notes ? <section className="rs-notes">
          <div className="rs-kicker">Field notes · The Dalles only</div>
          <h1>Same location.<br/>Different measures.</h1>
          <p>Google’s July 2, 2024 disclosure covers the 2023 calendar year. These notes are authored by Continuum, not Google.</p>
          <div className="rs-note-grid">
            <div><h2>Withdrawal isn’t consumption.</h2><p>383.7 million gallons withdrawn − 81.3 million discharged = 302.4 million consumed. These are accounting categories, not the lower and upper ends of an estimate.</p><button data-testid="button-note-water" onClick={() => open("water")}>Explore water <ArrowUpRight size={12} style={{ display: "inline" }}/></button></div>
            <div><h2>Missing is not zero.</h2><p>No compatible location-specific electricity total was established. A PUE ratio measures overhead efficiency, not total electricity demand.</p><button data-testid="button-note-electricity" onClick={() => open("electricity")}>Inspect electricity <ArrowUpRight size={12} style={{ display: "inline" }}/></button></div>
          </div>
          <p>{COMPARISON_BOUNDARY.water}</p>
          <a href={`${GOOGLE_REPORT}#page=80`} target="_blank" rel="noreferrer" data-testid="link-notes-source">Read the primary water table <ExternalLink size={11} style={{ display: "inline" }}/></a>
        </section> : <div className={`rs-body ${!opened ? "rs-closed" : ""}`}>
          <article className="rs-reading" aria-labelledby="rs-dalles-title">
            <div className="rs-kicker"><span className="rs-dot"/>Environment / Operational disclosures</div>
            <h1 id="rs-dalles-title">What Google’s Oregon water figures actually measure</h1>
            <p className="rs-deck">An operating location, a defined year, and two distinct ways to count water.</p>
            <div className="rs-byline"><span className="rs-initials">G</span><span><strong>Primary source · Google 2024 Environmental Report</strong><br/><span>Published {DALLES.disclosureDate} · data year 2023</span></span></div>
            <div className="rs-summary-label"><BookOpen/>Factual reading summary · written by Continuum</div>
            <div className="rs-prose">
              <p>Google reports <button ref={passageRef} className="rs-highlight" aria-expanded={opened && resource === "water"} aria-controls="rs-dalles-explanation" data-testid="button-passage-water" onClick={() => { setMetric("withdrawal"); open("water"); }}>383.7 million US gallons withdrawn <ArrowUpRight/></button> at The Dalles, Oregon, during 2023. The table lists that withdrawal as potable water.</p>
              <p>It separately reports 81.3 million gallons discharged and <button className="rs-highlight" aria-expanded={opened && resource === "water" && metric === "consumption"} aria-controls="rs-dalles-explanation" data-testid="button-passage-consumption" onClick={() => { setMetric("consumption"); open("water"); }}>302.4 million gallons consumed <ArrowUpRight/></button>. Consumption means withdrawal minus discharge—not all water delivered to the site.</p>
              <p>The selected report does <button ref={electricityRef} className="rs-highlight" data-testid="button-passage-electricity" aria-expanded={opened && resource === "electricity"} aria-controls="rs-dalles-explanation" onClick={() => open("electricity")}>not establish an absolute electricity baseline <ArrowUpRight/></button> for this location.</p>
            </div>
            <div className="rs-margin-note"><Info/><span>Historical operational accounting, not a future build-out forecast or an AI-only footprint. The location aggregate is not one building. A third campus began construction in 2023; its future demand is not inferred here.</span></div>
            <a className="rs-source-link" href={`${GOOGLE_REPORT}#page=80`} target="_blank" rel="noreferrer" data-testid="link-original-report">Read Google’s water table · printed page 79 <ExternalLink/></a>
          </article>
          {opened && <aside ref={panelRef} tabIndex={-1} id="rs-dalles-explanation" className="rs-explanation" aria-label={`${resource} scale explanation`} data-testid="panel-explanation" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
            <div className="rs-panel-top"><div className="rs-kicker"><span className="rs-dot"/>Beyond the number · The Dalles</div><button className="rs-icon-button" aria-label="Close explanation and return to passage" data-testid="button-close-explanation" onClick={close}><X/></button></div>
            <div className="rs-resource-switch" role="group" aria-label="Choose a resource">
              <button aria-pressed={resource === "electricity"} data-testid="button-resource-electricity" onClick={() => setResource("electricity")}><Zap/>Electricity</button>
              <button aria-pressed={resource === "water"} data-testid="button-resource-water" onClick={() => setResource("water")}><Droplets/>Water</button>
            </div>
            <div className="rs-title-row"><h2>{resource === "water" ? "First, choose what to count." : "No defensible conversion."}</h2></div>
            <p className="rs-intro">{resource === "water" ? "A reported annual total, not a projection range. Only the selected accounting measure is converted below." : "An explicit gap is more useful than an invented number."}</p>
            {resource === "water" ? <section className="rs-quant" aria-label="Water volume comparison" data-testid="comparison-water">
              <div className="rs-resource-switch rs-metric-switch" role="group" aria-label="Water accounting measure">
                <button aria-pressed={metric === "withdrawal"} data-testid="button-metric-withdrawal" onClick={() => setMetric("withdrawal")}>Withdrawal</button>
                <button aria-pressed={metric === "consumption"} data-testid="button-metric-consumption" onClick={() => setMetric("consumption")}>Net consumption</button>
              </div>
              <p className="rs-caveat" data-testid="text-water-boundary"><strong>{metricLabel} · 2023 · direct operational water.</strong> {metric === "withdrawal" ? "Water entering the location’s accounting boundary; not net water consumed." : "Withdrawal minus discharge; not total water delivered. Some non-cooling discharge can be estimated under Google’s methodology."} Indirect electricity-generation water is outside this table.</p>
              <div className="rs-magnitude rs-dalles-magnitude">
                <div className="rs-number rs-water-number" data-testid="text-pool-value">≈{fmt(water.pools, annual ? 1 : 2)}<small>pool volumes / {annual ? "year" : "average day"}</small></div>
                <div className="rs-time-switch" role="group" aria-label="Water time basis"><button aria-pressed={annual} data-testid="button-period-annual" onClick={() => setPeriod("annual")}>Annual</button><button aria-pressed={!annual} data-testid="button-period-daily" onClick={() => setPeriod("daily")}>Daily</button></div>
              </div>
              <div className="rs-pool-label"><span>{metricLabel}, not an uncertainty bound</span><strong data-testid="text-water-gallons">{fmt(water.gallons / 1e6, annual ? 1 : 3)} million US gal / {annual ? "year" : "average day"}</strong></div>
              <div className={`rs-pools ${!annual ? "rs-daily" : ""}`} role="img" aria-label={`${water.pools.toFixed(6)} reference pool volumes of ${metricLabel.toLowerCase()}; each full icon equals ${water.poolsPerIcon} pool volumes; final icon fractionally filled.`}>
                {Array.from({ length: Math.ceil(water.pools / water.poolsPerIcon) }, (_, i) => <div className="rs-pool" key={i} aria-hidden="true"><span style={{ width: `${Math.min(1, water.pools / water.poolsPerIcon - i) * 100}%` } as CSSProperties}/></div>)}
              </div>
              <p className="rs-legend"><i style={{ background: "#82ada8" }} aria-hidden="true"/>1 full icon = {water.poolsPerIcon} reference pool volume{water.poolsPerIcon === 1 ? "" : "s"} · final fill is proportional</p>
              <p className="rs-caveat">One reference pool = 50 × 25 × 2 m = 2.5 million litres. {annual ? "Annual total for January–December 2023." : "Annual total ÷ 365: an annualized average, not measured use on a particular day or a seasonal maximum."} Source totals were rounded to 0.1 million gallons; conversion does not add measurement precision.</p>
              <div className="rs-limit" data-testid="text-water-accounting"><strong>Separate categories, not a range.</strong><br/>383.7 million gal withdrawal − 81.3 million gal discharge = 302.4 million gal net consumption. Do not add withdrawal and consumption or subtract replenishment credits.</div>
            </section> : <section className="rs-quant" aria-label="Electricity data unavailable" data-testid="comparison-electricity-unavailable">
              <div className="rs-missing"><Zap/><h3>Site electricity baseline unavailable</h3><p>{DALLES.electricity.explanation}</p></div>
              <p className="rs-caveat">MW is power (a rate); MWh is energy over time. A PUE ratio is neither. No household equivalent, zero-use claim, annual-energy estimate, or 100 + 30 illustration is carried over from Louisiana.</p>
            </section>}
            <p className="rs-caveat" data-testid="text-comparison-unavailable">{COMPARISON_BOUNDARY[resource]}</p>
            <details ref={sourceRef} className="rs-inspect" open={sources} onToggle={event => setSources(event.currentTarget.open)} data-testid="details-sources">
              <summary data-testid="button-inspect-sources">Sources, units & what this doesn’t tell us <ChevronDown/></summary>
              <div className="rs-inspect-body">
                <h3>01 · Dated primary disclosure & phase</h3>
                <p><a href={GOOGLE_ANNOUNCEMENT} target="_blank" rel="noreferrer" data-testid="link-source-google-date">Google’s publication announcement · July 2, 2024</a>. The <a href={GOOGLE_REPORT} target="_blank" rel="noreferrer" data-testid="link-source-google-report">2024 Environmental Report</a> covers January 1–December 31, 2023. Printed page 79 (PDF page 80), “Water use by data center location,” row “The Dalles, OR,” supplies all three water values. Printed pages 45 and 53 describe existing operations and a new campus under construction, not its future operating totals.</p>
                <h3>02 · Electricity baseline not established</h3>
                <p>Report energy totals are fleet-wide, while the location-specific PUE entries are ratios of total facility energy to IT energy. Neither provides a location-specific MW or MWh baseline. No absolute electricity comparison is offered.</p>
                <h3>03 · Accounting & arithmetic</h3>
                <p><a href={`${GOOGLE_REPORT}#page=74`} target="_blank" rel="noreferrer" data-testid="link-source-google-methodology">Printed page 73 (PDF page 74), “Water metrics”</a>: consumption = withdrawal − discharge; seawater excluded. Withdrawal uses metered/invoiced data where available; non-cooling domestic discharge can use 90% potable / 0% irrigation flow estimates where actual discharge is unavailable. These are company-reported operational accounts, not independently measured by Continuum.</p>
                <code>383,700,000 − 81,300,000 = 302,400,000 US gal<br/>1 US gal = {US_GALLON_LITRES} L<br/>Pool = 50 × 25 × 2 × 1,000 = {REFERENCE_POOL_LITRES.toLocaleString("en-US")} L<br/>{metricLabel}: {DALLES[metric].toLocaleString("en-US")} × {US_GALLON_LITRES} ÷ {REFERENCE_POOL_LITRES.toLocaleString("en-US")} = {fmt(dallesWater(metric, "annual").pools, 8)} pools/year<br/>Daily pools = annual pools ÷ 365 = {fmt(dallesWater(metric, "daily").pools, 8)}</code>
                <h3>04 · No like-for-like project ranking</h3>
                <p>{COMPARISON_BOUNDARY.water} Neither operational workload mix nor local watershed effects can be inferred from these totals. Water replenishment is not subtracted from withdrawal or consumption.</p>
              </div>
            </details>
          </aside>}
        </div>}
      </div>
      <footer className="rs-footer"><span><BookOpen/>Reading, with room to explore.</span><span>2023 operational accounts · disclosed July 2024 · not live measurements</span></footer>
    </section>
    <div className="rs-command-wrap">
      {message && <div className="rs-command-message" role="status" data-testid="status-command">{message}</div>}
      <form className="rs-command" onSubmit={runCommand}><Sparkles strokeWidth={1.3}/><input aria-label="Reading command" placeholder="Try “consumption”, “daily”, or “sources”…" value={command} onChange={event => setCommand(event.target.value)} data-testid="input-reading-command"/><button aria-label="Run reading command" data-testid="button-run-command"><CornerDownLeft/></button></form>
    </div>
  </main>;
}
