export interface WorldGeniePreset {
  id: string;
  ariaLabel: string;
  imageUrl: string;
  worldPrompt: string;
}

export type MarsGeniePreset = WorldGeniePreset;

export interface WorldPresetGroup {
  theme: "eiffel" | "mars";
  ariaLabel: string;
  pageTitle: string;
  presets: readonly WorldGeniePreset[];
}

export interface WorldContextFields {
  pageTitle?: string;
  selectedText?: string;
  imageAlt?: string;
  sourceLabel?: string;
  customPrompt?: string;
  presetId?: string;
}

const basePrefix =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : "";

export const MARS_GENIE_PRESETS: readonly WorldGeniePreset[] = [
  {
    id: "jezero-crater",
    ariaLabel: "Jezero Crater Delta world",
    imageUrl: `${basePrefix}/mars-worlds/jezero-crater.jpg`,
    worldPrompt:
      "Continuous first-person Mars science rover masthead POV rolling steadily forward across iron-oxide regolith and layered sedimentary delta cliffs in Jezero Crater under a pale salmon Martian sky. Twin front wheels kick up fine rust dust trails over scattered basalt rocks, crisp gravel crunch and mechanical suspension articulation foley, no camera cuts, continuous forward propulsion.",
  },
  {
    id: "valles-marineris",
    ariaLabel: "Valles Marineris Rim world",
    imageUrl: `${basePrefix}/mars-worlds/valles-marineris.jpg`,
    worldPrompt:
      "Continuous first-person pressurized Mars exploration skimmer POV gliding smoothly forward along the towering rust-red sandstone rim of Valles Marineris canyon in late afternoon sunlight. Vast deep chasm veiled in golden atmospheric dust haze drops away below, crisp rushing thin Martian wind against the airframe foley, no camera cuts, steady forward propulsion.",
  },
  {
    id: "arcadia-outpost",
    ariaLabel: "Arcadia Planitia Outpost world",
    imageUrl: `${basePrefix}/mars-worlds/arcadia-outpost.jpg`,
    worldPrompt:
      "Continuous first-person Mars expedition rover POV advancing smoothly across flat dark basalt plains in Arcadia Planitia toward dust-coated geodesic white research domes, solar array wings, and a deep-space telemetry dish. Firm packed red soil crunches beneath tires with subtle wind grit foley, no camera cuts, steady forward travel.",
  },
  {
    id: "olympus-lava-tube",
    ariaLabel: "Olympus Mons Lava Tube world",
    imageUrl: `${basePrefix}/mars-worlds/olympus-lava-tube.jpg`,
    worldPrompt:
      "Continuous first-person Mars cave exploration rover POV driving forward into a massive dark volcanic basalt lava tube cavern beneath Olympus Mons. Twin bright LED floodlights cut through suspended Martian dust motes toward a warm circular skylight shaft ahead, crisp crunch of volcanic scree under wheels and hollow cavern echo foley, no camera cuts, steady forward motion.",
  },
] as const;

export const EIFFEL_GENIE_PRESETS: readonly WorldGeniePreset[] = [
  {
    id: "champ-de-mars-1889",
    ariaLabel: "1889 Exposition Universelle Esplanade world",
    imageUrl: `${basePrefix}/eiffel-worlds/champ-de-mars-1889.jpg`,
    worldPrompt:
      "Continuous first-person walking POV strolling smoothly down the sunlit gravel Champ-de-Mars promenade in Paris during the 1889 Exposition Universelle toward the soaring newly painted Venetian-red Great Arch of the Eiffel Tower. French tricolor flags flutter from dark cast-iron gas lamps while Belle Epoque visitors in top hats and parasols stroll beneath leafy chestnut trees, crisp gravel footsteps and festive distant brass music foley, no camera cuts, steady forward motion.",
  },
  {
    id: "summit-breeze-sunset",
    ariaLabel: "300m Eiffel Summit Golden Hour Panorama world",
    imageUrl: `${basePrefix}/eiffel-worlds/summit-breeze-sunset.jpg`,
    worldPrompt:
      "Continuous first-person walking POV moving smoothly along the open-air iron latticework observation gallery high atop the Eiffel Tower at golden hour sunset. Warm bronze riveted girders frame a sweeping panoramic vista of Haussmannian Paris rooftops, the glittering amber Seine River, and glowing orange-violet clouds, crisp high-altitude breeze whistling gently through iron trusses foley, no camera cuts, steady promenade motion.",
  },
  {
    id: "iron-construction-1888",
    ariaLabel: "1888 Ironworkers Scaffolding & Creeper Cranes world",
    imageUrl: `${basePrefix}/eiffel-worlds/iron-construction-1888.jpg`,
    worldPrompt:
      "Continuous first-person walking POV advancing carefully along elevated timber scaffolding catwalks high inside the rising half-built puddled-iron latticework of the Eiffel Tower in summer 1888. Steam-powered creeper cranes hoist heavy riveted girders through sunlit morning haze while ironworkers hammer glowing hot rivets at portable coal forges above misty 19th-century Paris, rhythmic metallic hammer clangs and creaking timber boards foley, no camera cuts, steady forward motion.",
  },
  {
    id: "seine-night-sparkle",
    ariaLabel: "Midnight Seine Riverboat & Golden Sparkle world",
    imageUrl: `${basePrefix}/eiffel-worlds/seine-night-sparkle.jpg`,
    worldPrompt:
      "Continuous first-person riverboat bow POV gliding smoothly down the dark reflective Seine River at midnight toward the towering Eiffel Tower illuminated in warm champagne gold floodlights with thousands of glittering white sparkle lights and a bright rotating summit beacon sweeping across the deep navy Paris sky. Golden reflections shimmer across gentle river wakes with soft lapping water and distant Parisian night ambiance foley, no camera cuts, steady forward glide.",
  },
] as const;

const EIFFEL_CONTEXT_RE =
  /\b(?:eiffel|effiel|tour\s+de\s+300|champ[- ]de[- ]mars|exposition\s+universelle|gustave\s+eiffel|trocadero|trocad[eé]ro|seine)\b|埃菲尔|铁塔|巴黎世博/i;

const MARS_CONTEXT_RE =
  /\b(?:mars|martian|jezero|valles\s+marineris|olympus\s+mons|arcadia\s+planitia|perseverance|curiosity|red\s+planet|regolith|tharsis|phobos|deimos)\b|火星|毅力号|水手号峡谷|奥林匹斯|阿卡迪亚/i;

function combineContext(fields: WorldContextFields): string {
  return [
    fields.pageTitle,
    fields.sourceLabel,
    fields.customPrompt,
    fields.imageAlt,
    fields.selectedText,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isEiffelWorldContext(fields: WorldContextFields): boolean {
  if (fields.presetId && EIFFEL_GENIE_PRESETS.some((p) => p.id === fields.presetId)) {
    return true;
  }
  if (fields.presetId && MARS_GENIE_PRESETS.some((p) => p.id === fields.presetId)) {
    return false;
  }
  return EIFFEL_CONTEXT_RE.test(combineContext(fields));
}

export function isMarsWorldContext(fields: WorldContextFields): boolean {
  if (fields.presetId && MARS_GENIE_PRESETS.some((p) => p.id === fields.presetId)) {
    return true;
  }
  if (isEiffelWorldContext(fields)) {
    return false;
  }
  // Strip "Champ-de-Mars" so Parisian park references never match planet Mars
  const cleaned = combineContext(fields).replace(/champ[- ]de[- ]mars/gi, " ");
  return MARS_CONTEXT_RE.test(cleaned);
}

export function resolveWorldPresetGroup(fields: WorldContextFields): WorldPresetGroup | null {
  if (isEiffelWorldContext(fields)) {
    return {
      theme: "eiffel",
      ariaLabel: "Related Eiffel Tower world models",
      pageTitle: "Eiffel Tower",
      presets: EIFFEL_GENIE_PRESETS,
    };
  }
  if (isMarsWorldContext(fields)) {
    return {
      theme: "mars",
      ariaLabel: "Related Mars world models",
      pageTitle: "Mars",
      presets: MARS_GENIE_PRESETS,
    };
  }
  return null;
}

const SEED_WIDTH = 640;
const SEED_HEIGHT = 360;
const MAX_RAW_JPEG_BYTES = 42_000;

export async function compressImageUrlToGenieJpeg(imageUrl: string): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load preset seed image"));
      el.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = SEED_WIDTH;
    canvas.height = SEED_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, SEED_WIDTH, SEED_HEIGHT);

    for (const quality of [0.68, 0.56, 0.44, 0.34, 0.25]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
      const rawBytes = Math.floor((base64.length * 3) / 4);
      if (rawBytes <= MAX_RAW_JPEG_BYTES) {
        return base64;
      }
    }

    return canvas.toDataURL("image/jpeg", 0.2).replace(/^data:image\/jpeg;base64,/, "");
  } catch {
    return null;
  }
}
