import type { ReactNode } from "react";

export type TopicId = "plant-cell" | "neuron" | "bacteria" | "animal-cell";

function Frame({ children, label, vb = "0 0 400 300" }: { children: ReactNode; label: string; vb?: string }) {
  return (
    <svg viewBox={vb} role="img" aria-label={label} className="w-full h-auto block">
      {children}
    </svg>
  );
}

function Label({ x, y, tx, ty, text }: { x: number; y: number; tx: number; ty: number; text: string }) {
  return (
    <g fontFamily="Geist, sans-serif" fontSize="9" fill="#2f3b36">
      <line x1={x} y1={y} x2={tx} y2={ty} stroke="#2f3b36" strokeWidth=".6" opacity=".6" />
      <circle cx={x} cy={y} r="1.6" fill="#2f3b36" />
      <text x={tx + (tx > x ? 3 : -3)} y={ty + 3} textAnchor={tx > x ? "start" : "end"}>{text}</text>
    </g>
  );
}

export function PlantCellDiagram({ labels = true }: { labels?: boolean }) {
  return (
    <Frame label="Diagram of a plant cell with cell wall, vacuole, chloroplasts, nucleus and mitochondria">
      <defs>
        <radialGradient id="pc-cyto" cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="#eef3dc" />
          <stop offset="1" stopColor="#d4e2b8" />
        </radialGradient>
        <radialGradient id="pc-vac" cx="40%" cy="40%" r="70%">
          <stop offset="0" stopColor="#e7f1f4" />
          <stop offset="1" stopColor="#b9d6df" />
        </radialGradient>
        <radialGradient id="pc-nuc" cx="40%" cy="35%">
          <stop offset="0" stopColor="#e9c9b8" />
          <stop offset="1" stopColor="#c98d72" />
        </radialGradient>
      </defs>
      <rect x="62" y="38" width="276" height="224" rx="26" fill="#9bb86a" />
      <rect x="70" y="46" width="260" height="208" rx="20" fill="url(#pc-cyto)" stroke="#6f8f45" strokeWidth="1.2" />
      <path className="anim-drift" d="M150 90 C200 70 290 80 300 130 C310 190 260 220 200 214 C140 208 118 170 122 136 C125 110 135 96 150 90Z" fill="url(#pc-vac)" stroke="#7fa8b5" strokeWidth="1" />
      <g className="anim-pulse">
        <circle cx="108" cy="200" r="26" fill="url(#pc-nuc)" stroke="#a5654c" />
        <circle cx="112" cy="196" r="8" fill="#8e4f3a" opacity=".8" />
      </g>
      {[[96, 80, -20], [300, 210, 30], [250, 232, 10], [160, 236, -10], [312, 80, 60], [90, 132, 80]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <g className="anim-drift" style={{ animationDelay: `${i * 0.7}s` }}>
            <ellipse rx="17" ry="9" fill="#5f9446" stroke="#3f6b2e" />
            {[-9, -3, 3, 9].map((d) => <line key={d} x1={d} y1="-5" x2={d} y2="5" stroke="#2f5523" strokeWidth="1.4" />)}
          </g>
        </g>
      ))}
      {[[210, 238], [286, 168], [140, 72]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 40})`}>
          <ellipse rx="11" ry="6" fill="#e39c6d" stroke="#b5643c" />
          <path d="M-7 0 q2 -4 4 0 t4 0 t4 0" fill="none" stroke="#b5643c" strokeWidth=".9" />
        </g>
      ))}
      <path d="M140 250 q10 -8 20 0 q10 8 20 0" fill="none" stroke="#b07fa6" strokeWidth="2" />
      <path d="M140 244 q10 -8 20 0 q10 8 20 0" fill="none" stroke="#b07fa6" strokeWidth="2" />
      {labels && (
        <>
          <Label x={64} y={60} tx={30} ty={30} text="Cell wall" />
          <Label x={210} y={140} tx={370} ty={140} text="Vacuole" />
          <Label x={108} y={200} tx={30} ty={270} text="Nucleus" />
          <Label x={312} y={80} tx={370} ty={40} text="Chloroplast" />
          <Label x={286} y={168} tx={370} ty={190} text="Mitochondrion" />
          <Label x={160} y={247} tx={180} ty={290} text="Golgi apparatus" />
        </>
      )}
    </Frame>
  );
}

export function NeuronDiagram({ labels = true }: { labels?: boolean }) {
  const dendrites = [[-40, -50], [-60, -10], [-50, 35], [-15, 55], [10, -60], [-30, -70]];
  return (
    <Frame label="Diagram of a neuron with dendrites, soma, axon, myelin sheath and axon terminals">
      <g transform="translate(95 150)">
        {dendrites.map(([x, y], i) => (
          <path key={i} d={`M0 0 Q${x / 2} ${y / 2 + 6} ${x} ${y} M${x} ${y} l${x / 4} ${-8} M${x} ${y} l${-6} ${y / 4}`} stroke="#c0754f" strokeWidth={3 - i * 0.2} fill="none" strokeLinecap="round" />
        ))}
        <circle r="24" fill="#e7a681" stroke="#a9583a" strokeWidth="1.4" className="anim-pulse" />
        <circle r="9" cx="2" cy="-2" fill="#7d3e2a" />
      </g>
      <path d="M119 150 L330 150" stroke="#c0754f" strokeWidth="3" />
      <path d="M119 150 L330 150" stroke="#f5e5c8" strokeWidth="1.2" className="anim-flow" />
      {[140, 180, 220, 260, 300].map((x) => (
        <rect key={x} x={x} y="143" width="30" height="14" rx="7" fill="#f0e2b6" stroke="#b9a066" />
      ))}
      {[[-30], [-10], [12], [30]].map(([dy], i) => (
        <g key={i}>
          <path d={`M330 150 Q345 ${150 + dy / 2} 360 ${150 + dy}`} stroke="#c0754f" strokeWidth="2" fill="none" />
          <circle cx="362" cy={150 + dy} r="4.5" fill="#d9864f" className="anim-pulse" style={{ animationDelay: `${i * 0.4}s` }} />
        </g>
      ))}
      {labels && (
        <>
          <Label x={60} y={100} tx={30} ty={40} text="Dendrites" />
          <Label x={95} y={150} tx={80} ty={250} text="Soma" />
          <Label x={155} y={143} tx={170} ty={90} text="Myelin sheath" />
          <Label x={175} y={150} tx={210} ty={230} text="Node of Ranvier" />
          <Label x={300} y={150} tx={300} ty={60} text="Axon" />
          <Label x={362} y={180} tx={380} ty={260} text="Axon terminal" />
        </>
      )}
    </Frame>
  );
}

export function BacteriaDiagram({ labels = true }: { labels?: boolean }) {
  return (
    <Frame label="Diagram of a rod-shaped bacterium with capsule, cell wall, nucleoid, ribosomes, plasmid, pili and flagellum">
      <path d="M310 150 C340 130 350 175 375 150 S395 120 400 135" stroke="#7a6a3c" strokeWidth="2" fill="none" className="anim-flow" />
      <rect x="70" y="95" width="250" height="110" rx="55" fill="#e8dfc4" opacity=".7" />
      <rect x="80" y="104" width="230" height="92" rx="46" fill="#c9d7b0" stroke="#7d9a55" strokeWidth="3" />
      <rect x="86" y="110" width="218" height="80" rx="40" fill="#eef2df" stroke="#a5bb81" />
      <path className="anim-drift" d="M150 140 c20 -25 40 20 60 -5 s30 30 50 5 M160 160 c20 -15 30 18 55 2 s25 10 40 -6" stroke="#5b7fa0" strokeWidth="1.6" fill="none" />
      <circle cx="255" cy="172" r="9" fill="none" stroke="#c46d4c" strokeWidth="1.6" className="anim-spin" />
      {Array.from({ length: 22 }).map((_, i) => (
        <circle key={i} cx={105 + ((i * 37) % 190)} cy={122 + ((i * 23) % 58)} r="2" fill="#6c5a8f" />
      ))}
      {[[110, 100, -150], [140, 96, -110], [200, 95, -90], [250, 98, -70], [130, 204, 110], [200, 205, 90], [270, 200, 60]].map(([x, y, a], i) => (
        <line key={i} x1={x} y1={y} x2={x + Math.cos((a * Math.PI) / 180) * 18} y2={y + Math.sin((a * Math.PI) / 180) * 18} stroke="#7d9a55" strokeWidth="1.2" />
      ))}
      {labels && (
        <>
          <Label x={75} y={150} tx={30} ty={250} text="Capsule" />
          <Label x={82} y={130} tx={30} ty={60} text="Cell wall" />
          <Label x={180} y={140} tx={160} ty={40} text="Nucleoid (DNA)" />
          <Label x={255} y={172} tx={250} ty={260} text="Plasmid" />
          <Label x={140} y={96} tx={110} ty={30} text="Pili" />
          <Label x={380} y={150} tx={370} ty={90} text="Flagellum" />
          <Label x={155} y={168} tx={150} ty={270} text="Ribosomes" />
        </>
      )}
    </Frame>
  );
}

export function AnimalCellDiagram({ labels = true }: { labels?: boolean }) {
  return (
    <Frame label="Diagram of an animal cell with plasma membrane, nucleus, mitochondria, endoplasmic reticulum, Golgi apparatus and lysosomes">
      <defs>
        <radialGradient id="ac-cyto" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#fbeee6" />
          <stop offset="1" stopColor="#efcfc1" />
        </radialGradient>
      </defs>
      <path className="anim-drift" d="M90 140 C80 80 160 45 220 55 C290 62 330 100 325 155 C320 215 270 255 200 250 C130 246 98 200 90 140Z" fill="url(#ac-cyto)" stroke="#c28473" strokeWidth="2" />
      <g className="anim-pulse">
        <circle cx="200" cy="150" r="38" fill="#c9a3c4" stroke="#8b5e86" strokeWidth="1.4" />
        <circle cx="206" cy="146" r="12" fill="#6e4069" />
      </g>
      <path d="M160 118 q-12 32 0 64 M150 112 q-18 38 0 76 M140 108 q-22 42 0 84" stroke="#7aa7a1" strokeWidth="2" fill="none" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M250 ${100 + i * 7} q18 -6 36 0`} stroke="#d39a4b" strokeWidth="3" fill="none" strokeLinecap="round" />
      ))}
      {[[130, 210, 20], [270, 200, -30], [240, 85, 10], [125, 95, 60]].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse rx="14" ry="7" fill="#e3876a" stroke="#a9513a" />
          <path d="M-9 0 q2 -4 4 0 t4 0 t4 0 t4 0" fill="none" stroke="#a9513a" strokeWidth=".9" />
        </g>
      ))}
      {[[290, 160], [180, 220], [230, 225]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6" fill="#8fb39a" stroke="#567a61" className="anim-pulse" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
      <g transform="translate(250 150)" stroke="#6b6b8a" strokeWidth="2">
        <line x1="-5" y1="0" x2="5" y2="0" />
        <line x1="0" y1="-5" x2="0" y2="5" />
      </g>
      {labels && (
        <>
          <Label x={92} y={150} tx={30} ty={150} text="Plasma membrane" />
          <Label x={200} y={150} tx={200} ty={20} text="Nucleus" />
          <Label x={142} y={150} tx={40} ty={270} text="Rough ER" />
          <Label x={270} y={102} tx={370} ty={60} text="Golgi apparatus" />
          <Label x={270} y={200} tx={370} ty={250} text="Mitochondrion" />
          <Label x={290} y={160} tx={370} ty={165} text="Lysosome" />
          <Label x={250} y={150} tx={300} ty={290} text="Centrosome" />
        </>
      )}
    </Frame>
  );
}

export const DIAGRAMS: Record<TopicId, (p: { labels?: boolean }) => ReactNode> = {
  "plant-cell": PlantCellDiagram,
  neuron: NeuronDiagram,
  bacteria: BacteriaDiagram,
  "animal-cell": AnimalCellDiagram,
};
