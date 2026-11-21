export type Gemini4ModelId = "gemini-4-argon" | "gemini-4-hydrogen";

export interface ModelRoutingDecision {
  model: Gemini4ModelId;
  label: "Gemini 4 Argon" | "Gemini 4 Hydrogen";
  reason: string;
  cleanedPrompt: string;
}

const EXPLICIT_ARGON_RE = /^(?:@argon|\/argon)\s+/i;
const EXPLICIT_HYDROGEN_RE = /^(?:@hydrogen|\/hydrogen)\s+/i;

const DEEP_REASONING_RE =
  /\b(analy[sz]e|compare|comparison|contrast|architecture|prove|proof|derive|algorithm|debug|optimize|trade-?offs?|strategy|strategic|critique|evaluate|synthesize|explain\s+why|how\s+does\s+.+\s+work\s+in\s+detail|step[- ]by[- ]step|mathematical|physics|engineering|research|essay|code|refactor|design\s+system)\b|深度|深入|分析|对比|比较|推导|证明|原理|架构|策略|权衡|代码|算法|评估|为什么|详细解释|逐步/i;

const FAST_TASK_RE =
  /\b(define|definition|translate|tldr|tl;dr|summarize|summary|quick|brief|short|what\s+is|who\s+is|when\s+was|where\s+is|capital\s+of|convert|weather|hello|hi)\b|翻译|简短|总结|概述|什么是|谁是|在哪|快速|一句话/i;

/**
 * Intelligently routes a user prompt between `gemini-4-argon` (deep reasoning,
 * synthesis, engineering/scientific analysis, long multi-clause queries) and
 * `gemini-4-hydrogen` (fast lookup, concise Q&A, translation, short summaries).
 */
export function selectGemini4Model(
  rawPrompt: string,
  preferredModel?: "auto" | "argon" | "hydrogen",
): ModelRoutingDecision {
  const trimmed = rawPrompt.trim();

  if (preferredModel === "argon" || EXPLICIT_ARGON_RE.test(trimmed)) {
    return {
      model: "gemini-4-argon",
      label: "Gemini 4 Argon",
      reason: "Deep reasoning mode selected",
      cleanedPrompt: trimmed.replace(EXPLICIT_ARGON_RE, "").trim() || trimmed,
    };
  }

  if (preferredModel === "hydrogen" || EXPLICIT_HYDROGEN_RE.test(trimmed)) {
    return {
      model: "gemini-4-hydrogen",
      label: "Gemini 4 Hydrogen",
      reason: "Fast response mode selected",
      cleanedPrompt: trimmed.replace(EXPLICIT_HYDROGEN_RE, "").trim() || trimmed,
    };
  }

  if (/\bargon\b/i.test(trimmed) && !/\bhydrogen\b/i.test(trimmed)) {
    return {
      model: "gemini-4-argon",
      label: "Gemini 4 Argon",
      reason: "Requested Argon reasoning",
      cleanedPrompt: trimmed,
    };
  }

  if (/\bhydrogen\b/i.test(trimmed) && !/\bargon\b/i.test(trimmed)) {
    return {
      model: "gemini-4-hydrogen",
      label: "Gemini 4 Hydrogen",
      reason: "Requested Hydrogen speed",
      cleanedPrompt: trimmed,
    };
  }

  const hasDeepSignal = DEEP_REASONING_RE.test(trimmed);
  const hasFastSignal = FAST_TASK_RE.test(trimmed);
  const clauseCount = trimmed.split(/[?;；。？！\n]+/).filter((s) => s.trim().length > 0).length;
  const isComplexLength = trimmed.length >= 95 || clauseCount >= 3;

  if (hasDeepSignal || (isComplexLength && !hasFastSignal)) {
    return {
      model: "gemini-4-argon",
      label: "Gemini 4 Argon",
      reason: hasDeepSignal ? "Complex reasoning & analysis" : "Multi-part detailed query",
      cleanedPrompt: trimmed,
    };
  }

  return {
    model: "gemini-4-hydrogen",
    label: "Gemini 4 Hydrogen",
    reason: "Fast contextual answer",
    cleanedPrompt: trimmed,
  };
}

export function buildFallbackWorldPrompt(opts: {
  selectedText?: string;
  pageTitle?: string;
  imageAlt?: string;
}): string {
  const subject =
    opts.selectedText?.trim() ||
    opts.imageAlt?.trim() ||
    opts.pageTitle?.trim() ||
    "an atmospheric open landscape";
  const compactSubject = subject.slice(0, 260).replace(/\s+/g, " ");
  return `Continuous first-person exploration POV moving smoothly forward into a vivid, lifelike 3D environment inspired by: ${compactSubject}. Steady forward camera propulsion from frame zero with no cuts, realistic natural daylight, rich physical textures, spatial depth, and grounded ambient environmental Foley sounds matching footsteps and wind.`;
}
