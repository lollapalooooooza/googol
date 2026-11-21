export type LandmarkId = "olympus" | "valles" | "jezero";

export interface Landmark {
  id: LandmarkId; name: string; lat: number; lonE: number; label: string; color: string;
  blurb: string; facts: string[]; source: { label: string; url: string };
}

export const LANDMARKS: Record<LandmarkId, Landmark> = {
  olympus: {
    id: "olympus", name: "Olympus Mons", lat: 18.65, lonE: 226.2, label: "18.65°N 226.2°E", color: "#b4532a",
    blurb: "A broad shield volcano in the Tharsis region and the tallest known volcano in the Solar System.",
    facts: ["Shield volcano built by fluid lava flows", "Summit caldera complex", "Marker shows a representative central coordinate"],
    source: { label: "Wikipedia: Olympus Mons", url: "https://en.wikipedia.org/wiki/Olympus_Mons" },
  },
  valles: {
    id: "valles", name: "Valles Marineris", lat: -13.9, lonE: 300.8, label: "13.9°S 300.8°E", color: "#2f7c7a",
    blurb: "A canyon system running along the Martian equator, east of the Tharsis volcanoes.",
    facts: ["Thousands of kilometres long", "Formed largely by crustal tectonics", "Marker is placed near the system's centre"],
    source: { label: "Wikipedia: Valles Marineris", url: "https://en.wikipedia.org/wiki/Valles_Marineris" },
  },
  jezero: {
    id: "jezero", name: "Jezero crater", lat: 18.38, lonE: 77.58, label: "18.38°N 77.58°E", color: "#c58a3a",
    blurb: "An impact crater that once held a lake; landing site of NASA's Perseverance rover in 2021.",
    facts: ["Preserved river delta deposits", "Perseverance landed February 2021", "Marker shows the crater's representative coordinate"],
    source: { label: "Wikipedia: Jezero (crater)", url: "https://en.wikipedia.org/wiki/Jezero_(crater)" },
  },
};
export const LANDMARK_ORDER: LandmarkId[] = ["olympus", "valles", "jezero"];

export const MARS_FACTS = [
  ["Radius", "3,389.5 km"], ["Day", "about 24.6 h"], ["Year", "687 Earth days"], ["Atmosphere", "thin, mostly CO2"],
] as const;
export const NASA_FACTS_URL = "https://science.nasa.gov/mars/facts/";
export const TEXTURE_SOURCE_URL = "https://www.solarsystemscope.com/textures/";

/**
 * Converts planetocentric latitude / east longitude to a point on Three's
 * default SphereGeometry, whose u=0 seam sits at -180° on an equirectangular map.
 * Vertex: x = -cos(phi) sin(theta), y = cos(theta), z = sin(phi) sin(theta), phi = u * 2PI.
 */
export function latLonToVec(lat: number, lonE: number, r = 1): [number, number, number] {
  const lon = ((lonE + 180) % 360 + 360) % 360 - 180;
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const la = (lat * Math.PI) / 180;
  return [-Math.cos(phi) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(phi) * Math.cos(la) * r];
}
