import { existsSync } from "node:fs";
import path from "node:path";
import { Router, type IRouter } from "express";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { buildFallbackWorldPrompt, selectGemini4Model } from "../lib/gemini-router";

const router: IRouter = Router();

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
]);

function ensureEnvLoaded() {
  if (process.env.GEMINI_API_KEY || process.env.API_KEY) return;
  if (typeof process.loadEnvFile !== "function") return;
  for (const candidate of [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ]) {
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        // Ignore
      }
      if (process.env.GEMINI_API_KEY || process.env.API_KEY) return;
    }
  }
}

function getServerAi(apiVersion?: "v1beta") {
  ensureEnvLoaded();
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const errObj = err as { status?: number; statusCode?: number; body?: string; message?: string } | null;
  const statusCode = errObj?.status ?? errObj?.statusCode;
  const bodyStr = typeof errObj?.body === "string" ? errObj.body : "";
  const raw = `${err instanceof Error ? err.message : String(err)} ${bodyStr}`.trim();

  if (/GEMINI_API_KEY is not configured/i.test(raw)) {
    return {
      status: 503,
      message: "Gemini API key is not configured. Please select a paid key in Settings > Secrets.",
    };
  }
  if (
    statusCode === 403 ||
    statusCode === 401 ||
    /403|PERMISSION_DENIED|API_KEY_INVALID|API key not valid|httpMeta/i.test(raw)
  ) {
    return {
      status: statusCode === 400 ? 400 : 403,
      message: "Gemini API authentication failed. Please verify your paid API key in Settings > Secrets.",
    };
  }
  if (statusCode === 429 || /429|RESOURCE_EXHAUSTED/i.test(raw)) {
    return {
      status: 429,
      message: "Gemini quota reached or paid tier required. Please check your paid API key in Settings > Secrets.",
    };
  }
  if (statusCode === 404 || /404|NOT_FOUND/i.test(raw)) {
    return {
      status: 404,
      message: "Requested Gemini model is unavailable for this API key. Please check Settings > Secrets.",
    };
  }
  return {
    status: 500,
    message: raw.replace(/\s+/g, " ").slice(0, 260),
  };
}

/**
 * POST /api/ai/prompt
 * Intelligently routes user prompts to Gemini 4 Argon (deep reasoning) or
 * Gemini 4 Hydrogen (fast contextual answers).
 */
router.post("/ai/prompt", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      prompt?: unknown;
      pageTitle?: unknown;
      pageUrl?: unknown;
      selectedContext?: unknown;
      preferredModel?: unknown;
    };

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }
    if (prompt.length > 4000) {
      res.status(400).json({ error: "Prompt is too long (max 4,000 characters)." });
      return;
    }

    const preferred =
      body.preferredModel === "argon" || body.preferredModel === "hydrogen"
        ? body.preferredModel
        : "auto";
    const decision = selectGemini4Model(prompt, preferred);

    const pageTitle = typeof body.pageTitle === "string" ? body.pageTitle.trim().slice(0, 200) : "";
    const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 300) : "";
    const selectedContext =
      typeof body.selectedContext === "string" ? body.selectedContext.trim().slice(0, 1200) : "";

    const contextLines = [
      pageTitle ? `Current tab: ${pageTitle}` : "",
      pageUrl ? `Current URL: ${pageUrl}` : "",
      selectedContext ? `Selected region context: ${selectedContext}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const contents = contextLines
      ? `${contextLines}\n\nUser request: ${decision.cleanedPrompt}`
      : decision.cleanedPrompt;

    const ai = getServerAi();
    const response = await ai.models.generateContent({
      model: decision.model,
      contents,
      config: {
        ...(decision.model === "gemini-4-hydrogen"
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        systemInstruction:
          decision.model === "gemini-4-argon"
            ? "You are an insightful research and engineering assistant embedded inside a browser. Respond in the same language as the user. Provide clear, structured, deeply reasoned answers (concise paragraphs or crisp bullet points, ~120–260 words unless asked for more)."
            : "You are a crisp, fast browser assistant. Respond in the same language as the user with a direct, accurate, well-structured answer in ~40–130 words.",
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      res.status(502).json({ error: "Model returned an empty response." });
      return;
    }

    res.json({
      answer,
      model: decision.model,
      modelLabel: decision.label,
      reason: decision.reason,
    });
  } catch (err) {
    const { status, message } = formatApiError(err);
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/ai/transcribe
 * Transcribes recorded voice audio from the bottom prompt bar or Genie 4
 * Hold-to-talk control using `gemini-3.5-transcribe`.
 */
router.post("/ai/transcribe", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      audioBase64?: unknown;
      mimeType?: unknown;
    };

    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const rawMime = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].trim().toLowerCase() : "audio/webm";
    const mimeType = ALLOWED_AUDIO_MIMES.has(rawMime) ? rawMime : "audio/webm";

    if (!audioBase64 || audioBase64.length < 32) {
      res.status(400).json({ error: "Audio recording is empty." });
      return;
    }
    if (audioBase64.length > 10 * 1024 * 1024) {
      res.status(413).json({ error: "Audio recording exceeds size limit." });
      return;
    }

    const ai = getServerAi();
    const interaction = await ai.interactions.create({
      model: "gemini-3.5-transcribe",
      input: [
        {
          type: "audio",
          data: audioBase64,
          mime_type: mimeType,
        },
        {
          type: "text",
          text: "Transcribe this spoken audio accurately in its original language. Return only the transcript text without extra commentary.",
        },
      ],
    });

    const transcript = (interaction.output_text ?? "").trim();
    res.json({ transcript });
  } catch (err) {
    const { status, message } = formatApiError(err);
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/genie/session
 * 1) Synthesizes an evocative first-person Genie 4 world prompt from the user's
 *    selected page text/image context via `gemini-4-hydrogen` (or uses exactWorldPrompt for curated presets).
 * 2) In parallel, creates a live `models/genie-4` interaction and mints a short-lived
 *    ephemeral auth token (`v1beta`) for browser WebRTC streaming.
 */
router.post("/genie/session", async (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      selectedText?: unknown;
      pageTitle?: unknown;
      imageAlt?: unknown;
      customPrompt?: unknown;
      exactWorldPrompt?: unknown;
      hasReferenceImage?: unknown;
    };

    const selectedText = typeof body.selectedText === "string" ? body.selectedText.trim().slice(0, 1200) : "";
    const pageTitle = typeof body.pageTitle === "string" ? body.pageTitle.trim().slice(0, 200) : "";
    const imageAlt = typeof body.imageAlt === "string" ? body.imageAlt.trim().slice(0, 300) : "";
    const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim().slice(0, 800) : "";
    const exactWorldPrompt =
      typeof body.exactWorldPrompt === "string" ? body.exactWorldPrompt.trim().slice(0, 1800) : "";
    const hasReferenceImage = Boolean(body.hasReferenceImage);

    const fallbackPrompt =
      exactWorldPrompt ||
      buildFallbackWorldPrompt({
        selectedText: customPrompt || selectedText,
        pageTitle,
        imageAlt,
      });

    const genieAi = getServerAi("v1beta");

    const createInteractionPromise = (async () => {
      const interaction = await genieAi.interactions.create({
        model: "models/genie-4",
        api_version: "v1beta",
      });
      const tokenResp = await genieAi.interactions.authTokens.create(interaction.id, {
        api_version: "v1beta",
      });
      return {
        interactionId: interaction.id,
        authToken: tokenResp.auth_token,
      };
    })();

    const enrichPromptPromise = exactWorldPrompt
      ? Promise.resolve(exactWorldPrompt)
      : (async (): Promise<string> => {
          const contextInput = [
            pageTitle ? `Page title: ${pageTitle}` : "",
            selectedText ? `Selected text: ${selectedText}` : "",
            imageAlt ? `Selected image description: ${imageAlt}` : "",
            customPrompt ? `User directive: ${customPrompt}` : "",
            hasReferenceImage ? "A 16:9 reference image from the selection is also attached." : "",
          ]
            .filter(Boolean)
            .join("\n");
          if (!contextInput) return fallbackPrompt;

          try {
            const promptAi = getServerAi();
            const synthPromise = promptAi.models
              .generateContent({
                model: "gemini-4-hydrogen",
                contents: contextInput,
                config: {
                  maxOutputTokens: 160,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                  systemInstruction:
                    "Write ONE concise English paragraph (55-85 words) describing an interactive, continuous first-person 3D world to explore in real time based on the provided context. Start with immediate forward motion from frame zero with no camera cuts, concrete architecture/terrain/lighting/atmosphere, and grounded physical contact Foley sounds (footsteps, wind, water, ambient environment). Never mention music, soundtrack, hum, or drone. Output only the world description text.",
                },
              })
              .then((synth) => synth.text?.trim() || fallbackPrompt)
              .catch(() => fallbackPrompt);

            const timeoutPromise = new Promise<string>((resolve) => {
              setTimeout(() => resolve(fallbackPrompt), 3500);
            });

            return await Promise.race([synthPromise, timeoutPromise]);
          } catch {
            return fallbackPrompt;
          }
        })();

    const [{ interactionId, authToken }, worldPrompt] = await Promise.all([
      createInteractionPromise,
      enrichPromptPromise,
    ]);

    res.json({
      interactionId,
      authToken,
      worldPrompt,
      maxDurationSec: 120,
    });
  } catch (err) {
    const { status, message } = formatApiError(err);
    res.status(status).json({ error: message });
  }
});

/**
 * POST /api/genie/steer
 * Converts multilingual / shorthand live steering text into a vivid English
 * physical scene modification directive for Genie 4 real-time world steering.
 */
router.post("/genie/steer", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { directive?: unknown; worldPrompt?: unknown };
    const directive = typeof body.directive === "string" ? body.directive.trim().slice(0, 500) : "";
    const currentWorld = typeof body.worldPrompt === "string" ? body.worldPrompt.trim().slice(0, 600) : "";
    if (!directive) {
      res.status(400).json({ error: "Steering directive is required." });
      return;
    }

    const ai = getServerAi();
    const synth = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: [
        currentWorld ? `Current world: ${currentWorld}` : "",
        `User live change request: ${directive}`,
      ]
        .filter(Boolean)
        .join("\n"),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          "Rewrite the user's live world-change request into ONE vivid, concrete English visual/physical directive (15-35 words) describing how the interactive first-person 3D environment immediately transforms ahead of the viewer. Never mention music or camera cuts. Output only the English directive.",
      },
    });

    res.json({
      englishDirective: synth.text?.trim() || directive,
    });
  } catch {
    const fallback = typeof req.body?.directive === "string" ? req.body.directive.trim() : "";
    res.json({ englishDirective: fallback });
  }
});

export default router;
