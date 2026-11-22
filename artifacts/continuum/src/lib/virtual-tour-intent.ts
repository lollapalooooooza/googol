export interface VirtualTourContext {
  isEiffel?: boolean;
  pageTitle?: string;
  rawInput?: string;
}

export interface VirtualTourSeed {
  pageTitle: string;
  sourceLabel: string;
  selectedText: string;
  imageAlt: string;
  customPrompt: string;
}

function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[a.length][b.length];
}

const STRONG_ENGLISH_PATTERNS: RegExp[] = [
  /\bvirtual\s+tour\b/i,
  /\bvr\s+tour\b/i,
  /\b3d\s+tour\b/i,
  /\bworld\s+tour\b/i,
  /\bguided\s+tour\b/i,
  /\bwalking\s+tour\b/i,
  /\binteractive\s+tour\b/i,
  /\bimmersive\s+tour\b/i,
  /\bfirst[\s-]?person\s+(?:tour|walk|view|explore)\b/i,
  /\b(?:take|give|start|open|begin|launch|show|do|go\s+on)\s+(?:me\s+)?(?:on\s+)?(?:a\s+|an\s+|the\s+)?(?:virtual\s+|vr\s+|3d\s+)?tour\b/i,
  /\b(?:walk|stroll|wander|roam|move)\s+(?:around|inside|through|under|beneath)\b/i,
  /\b(?:step|go|jump|dive|enter)\s+(?:inside|into)\s+(?:the\s+)?(?:scene|world|tower|paris|model|3d|exhibit|picture|photo)\b/i,
  /\b(?:enter|launch|open|start|switch\s+to)\s+(?:the\s+)?(?:world\s+mod(?:el|al|e)|genie\s*(?:4\s*)?world|interactive\s+world)\b/i,
  /\b(?:explore|visit)\s+(?:in\s+person|the\s+world|inside|around)\b/i,
  /\bimmerse\s+(?:me|myself)\b/i,
  /\bstreet\s*view\b/i,
];

const CHINESE_PATTERNS: RegExp[] = [
  /虚拟(?:游览|漫游|旅游|参观|导览|体验|之旅|看)/,
  /(?:实景|全景|沉浸式?|第一视角|3d)\s*(?:漫游|游览|参观|导览|体验)/i,
  /(?:带我|让我|想要?|可以|帮我|开启|进入|开始|切换(?:到|成)?).{0,6}(?:漫游|游览|逛逛|逛一逛|进去看看|走进去|身临其境|世界模型|世界模式)/,
  /身临其境/,
  /^(?:漫游|虚拟游览|虚拟漫游|进去看看|走进去看看|带我逛逛|逛一逛|游览铁塔|参观铁塔|进入世界|世界模型|世界模式)[!！。.?？]*$/,
  /(?:游览|参观|逛逛|走进|步入)(?:一下)?(?:埃菲尔)?铁塔/,
];

const INFO_QUESTION_GUARD =
  /^(?:what|when|who|why|how\s+(?:tall|high|old|long|many|much)|explain|tell\s+me\s+about|什么是|什么时候|多高|谁建的|介绍一下)\b/i;

function hasFuzzyVirtualTourTokens(normalized: string): boolean {
  const words = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2) return false;

  let virtualIdx = -1;
  let tourIdx = -1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length >= 5 && w.length <= 9 && damerauLevenshtein(w, "virtual") <= 2) {
      virtualIdx = i;
    }
    if (w.length >= 3 && w.length <= 6 && damerauLevenshtein(w, "tour") <= 1) {
      // Avoid matching common unrelated 3-4 letter words like "your", "four", "hour", "our", "for", "out"
      if (!/^(?:your|four|hour|pour|sour|our|for|out|too|top|two|to)$/.test(w)) {
        tourIdx = i;
      }
    }
  }

  return virtualIdx !== -1 && tourIdx !== -1 && Math.abs(tourIdx - virtualIdx) <= 3;
}

/**
 * Recognizes explicit and fuzzy natural-language intents to launch an interactive
 * Genie 4 virtual tour (via typed text or voice transcription, English or Chinese).
 */
export function isVirtualTourIntent(rawInput: string): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();

  // Explicit Chinese virtual tour / walkthrough phrases
  if (CHINESE_PATTERNS.some((re) => re.test(trimmed))) {
    return true;
  }

  // Explicit English virtual tour / walk-inside phrases
  if (STRONG_ENGLISH_PATTERNS.some((re) => re.test(lower))) {
    return true;
  }

  // Typo-tolerant "virtual tour" detection (e.g. "virtul tour", "vritual tor", "virutal tuor")
  if (hasFuzzyVirtualTourTokens(lower)) {
    return true;
  }

  // Short bare "tour" commands like "tour", "tour eiffel", "tour this" (not factual questions)
  if (
    !INFO_QUESTION_GUARD.test(lower) &&
    /^(?:please\s+)?(?:start\s+)?(?:a\s+)?tour(?:\s+(?:this|here|now|the\s+tower|eiffel(?:\s+tower)?|paris))?[.!?]*$/i.test(
      lower,
    )
  ) {
    return true;
  }

  return false;
}

export function buildVirtualTourRequest(context: VirtualTourContext): VirtualTourSeed {
  const raw = (context.rawInput ?? "").trim();
  if (context.isEiffel) {
    const extraHint =
      raw && !/^(?:virtual\s+tour|虚拟游览|虚拟漫游|漫游)$/i.test(raw)
        ? ` User request focus: ${raw}.`
        : "";
    return {
      pageTitle: "Eiffel Tower — 1889 Paris",
      sourceLabel: "Virtual Tour · Eiffel Tower (1889 Paris)",
      selectedText:
        "1889 Exposition Universelle on the Champ-de-Mars in Paris beneath the completed 300-meter riveted wrought-iron Eiffel Tower.",
      imageAlt: "1889 Eiffel Tower and Champ-de-Mars Exposition Universelle in Paris",
      customPrompt:
        "Immersive first-person photorealistic virtual tour walking along the sun-dappled gravel promenade of the 1889 Paris Exposition Universelle on the Champ-de-Mars directly toward and beneath the towering 300-meter riveted wrought-iron Eiffel Tower. Visitors in Belle Époque attire stroll past the Coutan fountain, manicured gardens, striped exhibition pavilions, and the sweeping 74-meter decorative iron arches rising overhead into a crisp Parisian sky." +
        extraHint,
    };
  }

  const subject = (context.pageTitle || "this scene").trim();
  return {
    pageTitle: subject,
    sourceLabel: `Virtual Tour · ${subject}`,
    selectedText: `Interactive first-person virtual tour of ${subject}.`,
    imageAlt: subject,
    customPrompt: `Immersive first-person photorealistic virtual tour exploring ${subject} up close with rich spatial depth, natural lighting, and navigable walkways.${raw ? ` Visitor request: ${raw}.` : ""}`,
  };
}
