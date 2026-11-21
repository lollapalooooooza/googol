export type LandmarkId = "overview" | "habitat" | "biodome" | "solar" | "rover1" | "rover2";

export interface OutpostZone {
  id: LandmarkId;
  name: string;
  shortLabel: string;
  coordinates: string;
  color: string;
  blurb: string;
  specs: string[];
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
  followRover?: boolean;
  source: { label: string; url: string };
}

export const OUTPOST_ZONES: Record<LandmarkId, OutpostZone> = {
  overview: {
    id: "overview",
    name: "Ares Sunset Outpost",
    shortLabel: "Outpost",
    coordinates: "18.38°N 77.58°E · Jezero Basin",
    color: "#e07a3f",
    blurb: "Pressurized surface research station bathed in late-afternoon Martian iron dust beneath a pale blue dust-scattered sunset.",
    specs: [
      "Atmosphere: 95.3% CO2 · 6.1 mbar surface pressure",
      "Blue sunset halo caused by fine ~1 µm suspended dust",
      "Twin pressurized domes linked by rover haulage tracks",
    ],
    cameraPos: [-1.4, 3.85, 19.6],
    cameraTarget: [-0.4, 1.85, -16.0],
    source: { label: "NASA: Blue Sunsets on Mars", url: "https://science.nasa.gov/mission/mars-2020-perseverance/" },
  },
  habitat: {
    id: "habitat",
    name: "Main Habitat Airlock",
    shortLabel: "Habitat",
    coordinates: "Sector E-01 · Crew Quarters",
    color: "#f59e0b",
    blurb: "Ribbed composite crew dome featuring a recessed pressurized airlock hatch, warm golden interior lighting, and external weather mast.",
    specs: [
      "Dual-seal circular hatch with pressure vestibule",
      "Elevated steel access steps anchored to regolith",
      "Roof anemometer & S-band relay dish mast",
    ],
    cameraPos: [3.2, 2.75, 13.8],
    cameraTarget: [10.4, 1.9, 5.4],
    source: { label: "NASA: Mars Surface Habitats", url: "https://www.nasa.gov/humans-in-space/humans-to-mars/" },
  },
  biodome: {
    id: "biodome",
    name: "Hydroponic Biodome",
    shortLabel: "Biodome",
    coordinates: "Sector N-02 · Life Support",
    color: "#52b768",
    blurb: "Geodesic glazed greenhouse sheltering full-spectrum grow-lit raised crop beds and closed-loop atmospheric oxygen regeneration.",
    specs: [
      "Faceted geodesic strut frame with UV-shielded glazing",
      "Tiered hydroponic leafy crop benches inside",
      "Side airlock vestibule & external cargo containers",
    ],
    cameraPos: [-8.8, 4.3, -12.6],
    cameraTarget: [-3.4, 2.0, -25.8],
    source: { label: "NASA: Growing Crops on Mars", url: "https://www.nasa.gov/missions/station/iss-research/growing-plants-in-space/" },
  },
  solar: {
    id: "solar",
    name: "Solar & Telemetry Array",
    shortLabel: "Solar Array",
    coordinates: "Sector NE-03 · Power Grid",
    color: "#38bdf8",
    blurb: "Dual-wing tilted photovoltaic panels paired with an atmospheric weather tower and directional uplink dish.",
    specs: [
      "West-tilted multi-junction solar cell wings",
      "Rotating 3-cup dust-wind anemometer tower",
      "Battery & power distribution crates on plinth",
    ],
    cameraPos: [13.4, 3.6, -13.8],
    cameraTarget: [5.4, 1.85, -24.2],
    source: { label: "NASA: Solar Power on Mars", url: "https://science.nasa.gov/mars/" },
  },
  rover1: {
    id: "rover1",
    name: "Scout Rover Alpha",
    shortLabel: "Scout Rover",
    coordinates: "Yard West · Recon Unit",
    color: "#d97706",
    blurb: "Six-wheeled rocker-bogie geological scout stationed along the basalt ridge, continuously scanning the horizon with stereo navcams.",
    specs: [
      "6-wheel articulated rocker-bogie suspension",
      "Pannable mast with stereo navigation cameras",
      "Gold Kapton thermal blanket & RTG radiator core",
    ],
    cameraPos: [-1.4, 2.4, 13.8],
    cameraTarget: [-6.4, 1.25, 9.2],
    source: { label: "NASA: Mars Rover Mobility", url: "https://science.nasa.gov/mission/msl-curiosity/" },
  },
  rover2: {
    id: "rover2",
    name: "Patrol Rover Bravo",
    shortLabel: "Patrol Rover",
    coordinates: "Active Haulage Track",
    color: "#fb923c",
    blurb: "Autonomous cargo & telemetry rover traversing the compacted regolith loop between the Habitat Airlock and Hydroponic Biodome.",
    specs: [
      "Follows closed spline loop across terrain slopes",
      "Real-time terrain pitch, roll & wheel spin",
      "High-gain dish & trailing iron-dust wake",
    ],
    cameraPos: [4.5, 3.4, 4.5],
    cameraTarget: [0, 1.1, 0],
    followRover: true,
    source: { label: "NASA: Autonomous Rover Driving", url: "https://science.nasa.gov/mission/mars-2020-perseverance/" },
  },
};

export const LANDMARK_ORDER: LandmarkId[] = ["overview", "habitat", "biodome", "solar", "rover1", "rover2"];

export const MARS_FACTS = [
  ["Radius", "3,389.5 km"],
  ["Sol length", "24h 39m"],
  ["Gravity", "3.72 m/s²"],
  ["Sunset", "Blue dust halo"],
] as const;

export const NASA_FACTS_URL = "https://science.nasa.gov/mars/facts/";
export const TEXTURE_SOURCE_URL = "https://science.nasa.gov/mars/";
