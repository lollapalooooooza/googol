import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Globe2,
  Loader2,
  Mic,
  ScanSearch,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { MarkdownContent } from "./markdown-content";

export interface Gemini4Answer {
  prompt: string;
  answer: string;
  model: "gemini-4-argon" | "gemini-4-hydrogen";
  modelLabel: string;
  reason: string;
}

const BAR_COUNT = 22;

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read audio recording."));
    reader.readAsDataURL(blob);
  });
}

export function CommandDock({
  cmd,
  setCmd,
  onSubmitPrompt,
  drawing,
  onToggleSelect,
  helpOpen,
  setHelpOpen,
  helpEntries,
  cmdMsg,
  aiLoading,
  aiAnswer,
  aiError,
  onDismissAi,
  onLaunchGenieFromPrompt,
  centered = false,
  worldActive = false,
}: {
  cmd: string;
  setCmd: (value: string) => void;
  onSubmitPrompt: (rawText: string) => void;
  drawing: boolean;
  onToggleSelect: () => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  helpEntries: [string, string][];
  cmdMsg: string | null;
  aiLoading: boolean;
  aiAnswer: Gemini4Answer | null;
  aiError: string | null;
  onDismissAi: () => void;
  onLaunchGenieFromPrompt?: (prompt: string) => void;
  centered?: boolean;
  worldActive?: boolean;
}) {
  const [audioMode, setAudioMode] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 0.22 + (i % 4) * 0.08),
  );

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const micLiveRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!centered || audioMode) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [centered, audioMode]);

  const teardownAudio = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    micLiveRef.current = false;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => teardownAudio, [teardownAudio]);

  // Elapsed recording timer
  useEffect(() => {
    if (!audioMode || transcribing) return;
    setElapsedSec(0);
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [audioMode, transcribing]);

  const startWaveformLoop = useCallback(() => {
    let tick = 0;
    const step = () => {
      tick += 0.14;
      const analyser = analyserRef.current;
      if (analyser && micLiveRef.current) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        const stride = Math.max(1, Math.floor(bins.length / BAR_COUNT));
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const val = (bins[Math.min(bins.length - 1, i * stride)] ?? 0) / 255;
          next.push(Math.max(0.14, Math.min(1, val * 1.35 + 0.12)));
        }
        setLevels(next);
      } else {
        // Gentle reactive ambient bar pulse when mic stream isn't active (e.g. muted/headless)
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const centerWeight = 1 - Math.abs(i - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
          const wave =
            0.22 +
            0.52 *
              centerWeight *
              Math.abs(Math.sin(tick + i * 0.42) * Math.cos(tick * 0.65 - i * 0.21));
          next.push(Math.max(0.14, Math.min(0.95, wave)));
        }
        setLevels(next);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const startAudioDetection = async () => {
    setAudioNotice(null);
    setAudioMode(true);
    setTranscribing(false);
    chunksRef.current = [];
    startWaveformLoop();

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setAudioNotice("Microphone unavailable in this browser");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        micLiveRef.current = true;
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.start(200);
      recorderRef.current = recorder;
    } catch {
      setAudioNotice("Microphone permission not granted");
    }
  };

  const stopAudioDetection = () => {
    teardownAudio();
    chunksRef.current = [];
    setTranscribing(false);
    setAudioNotice(null);
    setAudioMode(false);
  };

  const sendAudioDetection = async () => {
    if (transcribing) return;
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      teardownAudio();
      setAudioMode(false);
      setAudioNotice("No microphone audio captured.");
      return;
    }

    setTranscribing(true);
    setAudioNotice(null);

    try {
      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        };
        recorder.stop();
      });

      teardownAudio();

      if (blob.size < 250) {
        setAudioMode(false);
        setTranscribing(false);
        setAudioNotice("Recording too short — try speaking a little longer.");
        return;
      }

      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType: blob.type || "audio/webm",
        }),
      });
      const data = (await res.json()) as { transcript?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Audio transcription failed.");
      }

      const transcript = (data.transcript ?? "").trim();
      setAudioMode(false);
      setTranscribing(false);

      if (!transcript) {
        setAudioNotice("No speech detected in audio.");
        return;
      }

      setCmd("");
      onSubmitPrompt(transcript);
    } catch (err) {
      teardownAudio();
      setAudioMode(false);
      setTranscribing(false);
      setAudioNotice(err instanceof Error ? err.message : "Voice transcription failed.");
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const raw = cmd.trim();
    if (!raw || aiLoading) return;
    setCmd("");
    if (worldActive) inputRef.current?.blur();
    onSubmitPrompt(raw);
  };

  const statusLine = audioNotice || cmdMsg;

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      {/* Centered Homescreen googol logo positioned cleanly above the centered prompt box */}
      <AnimatePresence>
        {centered && (
          <motion.div
            key="homescreen-logo"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -26, scale: 0.94 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-x-0 top-[calc(46%-96px)] flex justify-center select-none"
            data-testid="homescreen-logo"
          >
            <h1
              aria-label="googol"
              className="font-sans text-[62px] sm:text-[76px] font-medium tracking-[-0.045em] leading-none drop-shadow-[0_2px_10px_rgba(30,40,70,0.06)]"
            >
              <span className="text-[#4285F4]">g</span>
              <span className="text-[#EA4335]">o</span>
              <span className="text-[#FBBC05]">o</span>
              <span className="text-[#4285F4]">g</span>
              <span className="text-[#34A853]">o</span>
              <span className="text-[#EA4335]">l</span>
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
        className={
          centered
            ? "pointer-events-auto absolute inset-x-0 top-[46%] mx-auto w-[min(92vw,540px)]"
            : "pointer-events-auto absolute inset-x-0 bottom-[14px] mx-auto w-[min(92vw,max(340px,31vw))]"
        }
        data-testid="command-dock"
        data-mode={audioMode ? "audio" : "text"}
        data-position={centered ? "center" : "bottom"}
      >
      {/* Floating Gemini 4 Response Card (Argon / Hydrogen) */}
      <AnimatePresence>
        {(aiLoading || aiAnswer || aiError) && (
          <motion.div
            key="ai-response-panel"
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            data-testid="panel-ai-response"
            data-model={aiAnswer?.model ?? (aiLoading ? "loading" : "error")}
            className="absolute bottom-full left-0 right-0 mb-2.5 overflow-hidden rounded-[16px] border border-[#e3e6ed] bg-white/96 text-[#1d1f24] shadow-[0_18px_46px_-18px_rgba(20,30,60,0.34)] backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#eceff4] px-3.5 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {aiLoading ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[#2f6fe0]" />
                ) : (
                  <Sparkles className="size-3.5 shrink-0 text-[#2f6fe0]" />
                )}
                <span
                  data-testid="badge-ai-model"
                  className={`inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold tracking-[0.04em] uppercase ${
                    aiAnswer?.model === "gemini-4-argon"
                      ? "bg-[#1a1c22] text-[#f4efe6]"
                      : aiAnswer?.model === "gemini-4-hydrogen"
                        ? "bg-[#e8f0fe] text-[#1a56c4]"
                        : "bg-[#f1f3f6] text-[#4b515c]"
                  }`}
                >
                  {aiLoading
                    ? "Routing Gemini 4…"
                    : aiAnswer
                      ? aiAnswer.modelLabel
                      : "Gemini 4"}
                </span>
                {aiAnswer && (
                  <span className="truncate text-[11px] text-[#7b818c]">
                    {aiAnswer.reason}
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss AI answer"
                data-testid="button-ai-dismiss"
                onClick={onDismissAi}
                className="grid size-6 shrink-0 place-items-center rounded-full text-[#7b818c] hover:bg-[#f1f3f6] hover:text-[#1d1f24]"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="max-h-[260px] overflow-y-auto px-3.5 py-3 text-[13px] leading-[1.6] text-[#24272d]">
              {aiLoading ? (
                <div className="space-y-2 py-1">
                  <div className="h-2.5 w-3/4 animate-pulse rounded bg-[#e8ecf2]" />
                  <div className="h-2.5 w-11/12 animate-pulse rounded bg-[#eef1f6]" />
                  <div className="h-2.5 w-2/3 animate-pulse rounded bg-[#eef1f6]" />
                </div>
              ) : aiError ? (
                <p className="text-[12.5px] text-[#b42318]" data-testid="text-ai-error">
                  {aiError}
                </p>
              ) : aiAnswer ? (
                <>
                  <MarkdownContent content={aiAnswer.answer} testid="text-ai-answer" />
                  {onLaunchGenieFromPrompt && (
                    <div className="mt-3 flex items-center justify-end border-t border-[#eff1f5] pt-2.5">
                      <button
                        type="button"
                        onClick={() => onLaunchGenieFromPrompt(aiAnswer.prompt)}
                        data-testid="button-ai-launch-genie"
                        className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[#d8dde6] bg-[#f8f9fb] px-3 text-[11.5px] font-medium text-[#1f2430] transition hover:bg-[#eef1f7]"
                      >
                        <Globe2 className="size-3.5 text-[#2f6fe0]" />
                        Explore in Genie 4 World
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Commands Popover */}
      <AnimatePresence>
        {helpOpen && !aiAnswer && !aiLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-[#e3e5ea] bg-white/95 p-3 shadow-[0_12px_32px_-14px_rgba(30,40,70,.35)] backdrop-blur"
            data-testid="panel-command"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#80868b]">
                Gemini 4 &amp; Browser Commands
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setHelpOpen(false)}
                className="text-[#80868b] hover:text-[#1d1f24]"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <ul className="space-y-1">
              {helpEntries.map(([c, d]) => (
                <li key={c} className="flex gap-2 text-[12.5px]">
                  <code className="shrink-0 font-mono text-[#1d1f24]">{c}</code>
                  <span className="truncate text-[#6b7280]">— {d}</span>
                </li>
              ))}
              <li className="pt-1 text-[11.5px] text-[#5f6368]">
                Ask any question directly to route automatically between Gemini 4 Argon &amp; Hydrogen (or prefix{" "}
                <code className="font-mono">@argon</code> / <code className="font-mono">@hydrogen</code>).
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morphing Bottom Bar: Standard Prompt Bar <-> Dark Minimalist Audio Detection Bar (Figure 1 inspired) */}
      <motion.div
        layout
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className={`relative overflow-hidden transition-colors duration-300 ${
          audioMode
            ? "rounded-[4px] border border-white/12 bg-[#17181a]/96 shadow-[0_14px_38px_rgba(0,0,0,0.4)]"
            : "rounded-full bg-white shadow-[0_6px_20px_-8px_rgba(30,40,70,.28),0_0_0_1px_rgba(30,40,70,.06)]"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {audioMode ? (
            <motion.div
              key="audio-bar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              data-testid="bar-audio-detection"
              className="flex h-[42px] items-center gap-3 px-3 text-[#f3efe8]"
            >
              {/* Left live recording dot + clock */}
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`size-2 rounded-full ${
                    transcribing ? "bg-[#9eb8ff] animate-pulse" : "bg-[#ef5350] animate-pulse"
                  }`}
                />
                <span
                  data-testid="text-audio-timer"
                  className="min-w-[34px] font-serif text-[12.5px] tabular-nums tracking-[0.04em] text-[#e7e3da]"
                >
                  {transcribing ? "…" : formatElapsed(elapsedSec)}
                </span>
              </div>

              <span className="h-4 w-px shrink-0 bg-white/15" aria-hidden="true" />

              {/* Center reactive audio spectrum bars */}
              <div
                className="flex h-6 flex-1 items-center justify-between gap-[3px] px-1"
                aria-label="Live audio input level"
                data-testid="audio-waveform"
              >
                {levels.map((lvl, idx) => (
                  <span
                    key={idx}
                    className="w-[2px] rounded-full bg-[#f3efe8]/85 transition-[height] duration-75"
                    style={{
                      height: `${Math.round(4 + lvl * 18)}px`,
                      opacity: transcribing ? 0.35 : 0.45 + lvl * 0.55,
                    }}
                  />
                ))}
              </div>

              <span className="h-4 w-px shrink-0 bg-white/15" aria-hidden="true" />

              {/* Right Stop + Send buttons (echoing Figure 1 crisp bordered controls) */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={stopAudioDetection}
                  disabled={transcribing}
                  aria-label="Stop audio recording"
                  title="Stop recording"
                  data-testid="button-voice-stop"
                  className="grid size-[28px] place-items-center rounded-[2px] border border-white/25 bg-white/5 text-[#e7e3da] transition hover:bg-white/15 disabled:opacity-40"
                >
                  <Square className="size-3 fill-current" />
                </button>
                <button
                  type="button"
                  onClick={() => void sendAudioDetection()}
                  disabled={transcribing}
                  aria-label="Send recorded audio"
                  title="Transcribe and send"
                  data-testid="button-voice-send"
                  className="inline-flex h-[28px] items-center gap-1 rounded-[2px] border border-white/30 bg-white px-2.5 text-[11.5px] font-medium tracking-[0.03em] text-[#17181a] transition hover:bg-[#ebe7df] disabled:opacity-50"
                >
                  {transcribing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <ArrowUp className="size-3.5" />
                  )}
                  <span>{transcribing ? "Sending" : "Send"}</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="text-bar"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onSubmit={handleFormSubmit}
              className={`flex items-center gap-1.5 pr-1.5 transition-[height] duration-300 ${
                centered ? "h-[46px] pl-4" : worldActive ? "h-[38px] pl-2" : "h-[38px] pl-4"
              }`}
            >
              {!centered && worldActive && (
                <span
                  data-testid="badge-world-steer"
                  className="inline-flex h-[24px] shrink-0 items-center gap-1 rounded-full bg-[#eef4ff] px-2 text-[11px] font-medium text-[#1f54c4]"
                >
                  <Globe2 className="size-3" />
                  <span>Live World</span>
                </span>
              )}
              <input
                ref={inputRef}
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                placeholder={
                  worldActive ? "type to change this world in real time…" : "ask googol anything"
                }
                aria-label="Command"
                data-testid="input-command"
                autoFocus={centered}
                className={`min-w-0 flex-1 bg-transparent text-[#1d1f24] outline-none placeholder:text-[#9aa0a6] ${
                  centered ? "text-[15px]" : "text-[13.5px]"
                }`}
              />
              {!centered && cmd.trim().length > 0 && (
                <button
                  type="submit"
                  disabled={aiLoading}
                  aria-label="Submit prompt"
                  title={worldActive ? "Steer Genie 4 world" : "Ask Gemini 4"}
                  data-testid="button-command-submit"
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-45 ${
                    worldActive
                      ? "bg-[#2563eb] hover:bg-[#1d4ed8]"
                      : "bg-[#1d1f24] hover:bg-[#313640]"
                  }`}
                >
                  {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-3.5" />}
                </button>
              )}
              {/* Microphone icon button (dictate) */}
              <button
                type="button"
                onClick={() => void startAudioDetection()}
                aria-label="Start voice input"
                title="Voice input (audio detection)"
                data-testid="button-voice-record"
                className={`grid shrink-0 place-items-center rounded-full text-[#5f6368] transition hover:bg-[#f0f2f5] hover:text-[#1d1f24] ${
                  centered ? "size-8" : "size-7"
                }`}
              >
                <Mic className="size-4" />
              </button>
              {/* Homescreen send button positioned cleanly to the RIGHT of dictate */}
              {centered && (
                <button
                  type="submit"
                  disabled={aiLoading || cmd.trim().length === 0}
                  aria-label="Submit prompt"
                  title="Search with googol"
                  data-testid="button-command-submit"
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
                    cmd.trim().length > 0
                      ? "bg-[#1d1f24] text-white hover:bg-[#313640] cursor-pointer"
                      : "bg-[#eef0f4] text-[#9aa0a6] cursor-default"
                  } disabled:opacity-75`}
                >
                  {aiLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUp className="size-4" />}
                </button>
              )}
              {/* Region select button (shown once browser is open and not inside Genie 4 world) */}
              {!centered && !worldActive && (
                <button
                  type="button"
                  onClick={onToggleSelect}
                  aria-pressed={drawing}
                  aria-label="Select a region"
                  title="Select a region"
                  data-testid="button-select-region"
                  className={`grid size-7 shrink-0 place-items-center rounded-full transition ${
                    drawing ? "bg-[#2f6fe0] text-white" : "text-[#5f6368] hover:bg-[#f0f2f5]"
                  }`}
                >
                  <ScanSearch className="size-4" />
                </button>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {statusLine && !helpOpen && !aiAnswer && !aiLoading && !aiError && (
          <motion.div
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute -top-7 left-0 right-0 flex justify-center"
          >
            <p
              className="rounded-full border border-black/6 bg-white/90 px-3 py-0.5 text-[11px] text-[#4b515c] shadow-sm backdrop-blur-sm"
              data-testid="status-command"
            >
              {statusLine}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
