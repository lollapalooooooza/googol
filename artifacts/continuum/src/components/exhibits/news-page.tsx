import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import type { VideoTopic } from "@/lib/jensen-clips";
import "./news-page.css";

const SRC = {
  nvidia: { label: "NVIDIA, company statement, 8 Nov 2026", url: "https://nvidianews.nvidia.com/news/a-message-to-our-company" },
  bbc: { label: "BBC News, updated 12 Nov 2026", url: "https://www.bbc.co.uk/news/articles/ckgel338xql3o" },
  reuters: { label: "Reuters, 12 Nov 2026", url: "https://www.reuters.com/technology/former-nvidia-ceo-huang-had-relationship-with-second-employee-sources-say-2026-11-12/" },
  latest: { label: "Reuters, latest reporting, 13–14 Nov 2026", url: "https://www.reuters.com/world/china/ex-nvidia-ceo-misled-top-lawyer-affair-with-chinese-businesswoman-sources-say-2026-11-14/" },
};
type Key = keyof typeof SRC;

function Cite({ k }: { k: Key }) {
  return <a href={SRC[k].url} target="_blank" rel="noreferrer" className="np-cite" data-testid={`link-cite-${k}`}>{k === "nvidia" ? "NVIDIA" : k === "bbc" ? "BBC" : "Reuters"}</a>;
}

function Block({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section className="np-section" data-testid={`section-${id}`}>
      <h2 className="np-h2" data-video-topic={id === "timeline" ? "overview" : id === "confirmed" ? "apology leadership" : id === "alleged" ? "allegations" : "family"}>{title}</h2>
      {children}
    </section>
  );
}

function TimelineItem({ date, title, topic, extraTopic, children }: { date: string; title: string; topic: VideoTopic; extraTopic?: VideoTopic; children: ReactNode }) {
  return (
    <li className="np-timeline-item" data-video-topic={[topic, extraTopic].filter(Boolean).join(" ")} data-testid={`timeline-${topic}`}>
      <span className="np-timeline-date">{date}</span>
      <div><h3>{title}</h3><p>{children}</p></div>
    </li>
  );
}

export function NewsPage({ onNavigate }: { onNavigate: (title: string) => void }) {
  return (
    <div className="news-page h-full w-full overflow-y-auto" data-testid="news-page">
      <article className="np-article">
        <p className="np-kicker" data-testid="text-briefing-label">Technology <span aria-hidden>/</span> News &amp; context</p>
        <h1 className="np-h1" data-video-topic="overview" data-testid="text-briefing-title">Jensen Huang’s Marriage and the Reporting That Led to His Departure</h1>
        <p className="np-dek" data-video-topic="overview">From meeting Lori at university to a public apology and a board investigation: a timeline of the personal and professional story.</p>
        <div className="np-byline">
          <span>Compiled from <strong>NVIDIA, BBC and Reuters</strong></span>
          <span className="np-dot" aria-hidden />
          <time dateTime="2026-11-14">Updated 14 Nov 2026</time>
        </div>

        <p className="np-lede" data-video-topic="overview">
          Jensen Huang’s acknowledgement of marital infidelity has been followed by his departure as NVIDIA’s chief executive and questions about relationships reported by news organisations. His own statement confirms the admission; other details remain attributed reporting, not the conclusions of an investigation.<Cite k="nvidia" /><Cite k="bbc" />
        </p>

        <Block id="confirmed" title="What is confirmed">
          <p data-video-topic="apology">In a company statement, Huang said he had been unfaithful to his wife, apologised to his family, and said he supports an independent investigation commissioned by the board.<Cite k="nvidia" /></p>
          <p data-video-topic="leadership">The BBC reports that he has resigned and that Colette Kress has been named interim chief executive.<Cite k="bbc" /></p>
        </Block>

        <Block id="timeline" title="The relationship timeline">
          <ol className="np-timeline" data-testid="relationship-timeline">
            <TimelineItem topic="meeting" date="Early 1980s" title="A meeting at Oregon State">
              Huang met Lori Mills while they were studying electrical engineering. They were lab partners, according to the BBC.<Cite k="bbc" />
            </TimelineItem>
            <TimelineItem topic="marriage" date="1985" title="Marriage and family">
              The couple married in 1985 and have two children. This is the family background to Huang’s recent public apology.<Cite k="bbc" />
            </TimelineItem>
            <TimelineItem topic="philanthropy" date="2007" title="A shared philanthropic foundation">
              They established the Jen-Hsun and Lori Huang Foundation, which has supported engineering education at Oregon State and Stanford.<Cite k="bbc" />
            </TimelineItem>
            <TimelineItem topic="apology" date="8 Nov. 2026" title="A public admission">
              In NVIDIA’s published statement, Huang acknowledged being unfaithful, apologised to his wife and children, and said he supported an independent board investigation.<Cite k="nvidia" />
            </TimelineItem>
            <TimelineItem topic="investigation" date="10 Nov. 2026" title="An independent review">
              Independent directors hired Wachtell, Lipton, Rosen &amp; Katz to investigate, Reuters reports. The review followed reporting about his relationship with businesswoman Alice Huang.<Cite k="latest" />
            </TimelineItem>
            <TimelineItem topic="leadership" extraTopic="employees" date="12 Nov. 2026" title="A leadership change and further reporting">
              The BBC reported Huang’s resignation and Colette Kress’s appointment as interim chief executive. Separately, Reuters reported another employee relationship, citing two sources.<Cite k="bbc" /><Cite k="reuters" />
            </TimelineItem>
            <TimelineItem topic="allegations" date="13–14 Nov. 2026" title="Questions about earlier explanations">
              Reuters reported that Huang had described his interactions with Alice Huang to company leaders as ordinary customer dealings. Its report cited two people and October correspondence it reviewed. Representatives for Huang and NVIDIA declined comment; Alice Huang did not respond.<Cite k="latest" />
            </TimelineItem>
          </ol>
        </Block>

        <Block id="alleged" title="What remains alleged">
          <p data-video-topic="allegations">Reports of specific affairs are attributed to news reporting and are not established findings; the board investigation has not concluded.<Cite k="bbc" /></p>
          <p data-video-topic="employees">Reuters reports a relationship with a second employee, citing two anonymous sources. NVIDIA declined to comment and other parties did not respond.<Cite k="reuters" /></p>
          <p data-video-topic="allegations">Reported espionage allegations have been denied by China. An unresolved investigation is not a finding of wrongdoing or a conviction.<Cite k="bbc" /></p>
          <p data-video-topic="allegations">The start of Huang’s reported intimate relationship with Alice Huang remains unclear. Reuters says it verified photographs of them together as early as December 2023; those images do not establish when an affair began. The two share a surname but are not related.<Cite k="latest" /></p>
        </Block>

        <Block id="family" title="Family background">
          <p data-video-topic="family">Huang’s apology refers to the harm to his wife and children. It should not be read as an announcement about the future of their marriage; this article makes no claim about a separation or divorce.<Cite k="nvidia" /></p>
          <p>For his career and broader biography, see the{" "}
            <button onClick={() => onNavigate("Jensen Huang")} className="np-link" data-testid="link-wikipedia-jensen">Wikipedia article on Jensen Huang</button>.
          </p>
        </Block>

        <p className="np-note" data-testid="text-video-note">
          Drag over a timeline entry to watch its related scenes, or span several entries to queue their clips. Select other article text to play the full video from the beginning. Entries without a matching scene also play the full video. The user-supplied video is illustrative, not evidence: several caption ages and dates conflict with the sourced timeline above.
        </p>

        <footer className="np-sources">
          <p className="np-sources-label">Sources</p>
          <ol>
            {(Object.keys(SRC) as Key[]).map((k) => (
              <li key={k}><a href={SRC[k].url} target="_blank" rel="noreferrer" data-testid={`link-source-${k}`}>{SRC[k].label}<ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden /></a></li>
            ))}
          </ol>
        </footer>
      </article>
    </div>
  );
}
