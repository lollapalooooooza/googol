export interface MarsGeniePreset {
  id: string;
  ariaLabel: string;
  imageUrl: string;
  worldPrompt: string;
}

const basePrefix =
  typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL.replace(/\/$/, "")
    : "";

export const MARS_GENIE_PRESETS: readonly MarsGeniePreset[] = [
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

const MARS_CONTEXT_RE =
  /\b(?:mars|martian|jezero|valles\s+marineris|olympus\s+mons|arcadia\s+planitia|perseverance|curiosity|red\s+planet|regolith|tharsis|phobos|deimos)\b|火星|毅力号|水手号峡谷|奥林匹斯|阿卡迪亚/i;

export function isMarsWorldContext(fields: {
  pageTitle?: string;
  selectedText?: string;
  imageAlt?: string;
  sourceLabel?: string;
  customPrompt?: string;
  presetId?: string;
}): boolean {
  if (fields.presetId && MARS_GENIE_PRESETS.some((p) => p.id === fields.presetId)) {
    return true;
  }
  const combined = [
    fields.pageTitle,
    fields.sourceLabel,
    fields.customPrompt,
    fields.imageAlt,
    fields.selectedText,
  ]
    .filter(Boolean)
    .join(" ");
  return MARS_CONTEXT_RE.test(combined);
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
