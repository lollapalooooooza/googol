import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GoogleGenAI } from "@google/genai";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Disc,
  Gamepad2,
  Maximize2,
  Mic,
  Minimize2,
  RotateCw,
  Send,
  Timer,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { mapKeyboardCodeToGenieAction, type GenieKeyInput } from "@/lib/region-extract";

export interface GenieWorldLaunchRequest {
  selectedText: string;
  imageAlt: string;
  referenceImageBase64: string | null;
  pageTitle: string;
  sourceLabel: string;
  customPrompt?: string;
}

type GenieStatus = "building" | "live" | "ended" | "error";

interface LiveGenieHandle {
  sendKey: (action: "key_down" | "key_up", input: GenieKeyInput) => Promise<void>;
  steerWorld: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export function GenieWorldViewer({
  request,
  onClose,
}: {
  request: GenieWorldLaunchRequest;
  onClose: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<LiveGenieHandle | null>(null);
  const pressedKeysRef = useRef<Set<GenieKeyInput>>(new Set());
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<GenieStatus>("building");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [worldPrompt, setWorldPrompt] = useState<string>("");
  const [remainingSec, setRemainingSec] = useState<number>(120);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const [muted, setMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [steerOpen, setSteerOpen] = useState<boolean>(false);
  const [steerInput, setSteerInput] = useState<string>("");
  const [steerFeedback, setSteerFeedback] = useState<string | null>(null);
  const [activeKeys, setActiveKeys] = useState<Record<string, boolean>>({});
  const [voiceHolding, setVoiceHolding] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [sessionSeed, setSessionSeed] = useState<number>(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);

  const flashFeedback = useCallback((msg: string) => {
    setSteerFeedback(msg);
    window.setTimeout(() => {
      setSteerFeedback((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  const stopSessionSafely = useCallback(async () => {
    const activeHandle = handleRef.current;
    handleRef.current = null;
    pressedKeysRef.current.clear();
    if (activeHandle) {
      try {
        await activeHandle.stop();
      } catch {
        // Ignore teardown errors during unmount
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    void stopSessionSafely();
    onClose();
  }, [onClose, stopSessionSafely]);

  // Boot real Genie 4 Live Interactions session via server ephemeral token + browser WebRTC
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const boot = async () => {
      setStatus("building");
      setErrorMsg(null);
      setRemainingSec(120);

      try {
        const res = await fetch("/api/genie/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedText: request.selectedText,
            pageTitle: request.pageTitle,
            imageAlt: request.imageAlt,
            customPrompt: request.customPrompt,
            hasReferenceImage: Boolean(request.referenceImageBase64),
          }),
        });
        const data = (await res.json()) as {
          interactionId?: string;
          authToken?: string;
          worldPrompt?: string;
          maxDurationSec?: number;
          error?: string;
        };

        if (!res.ok || !data.interactionId || !data.authToken || !data.worldPrompt) {
          throw new Error(data.error || "Failed to initialize Genie 4 world session.");
        }
        if (cancelled) return;

        setWorldPrompt(data.worldPrompt);
        setRemainingSec(data.maxDurationSec ?? 120);

        const videoEl = videoRef.current;
        if (!videoEl) {
          throw new Error("Video display surface unavailable.");
        }

        const clientAi = new GoogleGenAI({
          apiKey: data.authToken,
          apiVersion: "v1beta",
        });

        const session = await clientAi.interactions.connect(data.interactionId, {
          transport: "webrtc",
        });

        if (cancelled) {
          await session.complete().catch(() => session.detach());
          return;
        }

        session.transport.setVideoElement(videoEl);

        const endedPromise = (async () => {
          try {
            for await (const event of session.receive()) {
              if (cancelled || !mountedRef.current) break;
              if (event.event_type === "error") {
                const msg =
                  (event as { error?: { message?: string } }).error?.message ||
                  "Genie 4 encountered a streaming error.";
                setErrorMsg(msg);
                setStatus("error");
              } else if (event.event_type === "interaction.completed") {
                setStatus((prev) => (prev === "error" ? prev : "ended"));
              }
            }
          } catch (err) {
            if (!cancelled && mountedRef.current) {
              setErrorMsg(err instanceof Error ? err.message : String(err));
              setStatus("error");
            }
          }
        })();

        // Mandatory first world_setup event (strict protobuf JSON schema: no "type" field inside world_prompt or reference_image)
        const worldSetupPayload: Record<string, unknown> = {
          event_type: "world_setup",
          world_prompt: { text: data.worldPrompt },
        };
        if (request.referenceImageBase64 && request.referenceImageBase64.length * 0.75 < 45_000) {
          worldSetupPayload.reference_image = {
            mime_type: "image/jpeg",
            data: request.referenceImageBase64,
          };
        }
        await session.send(worldSetupPayload as never);

        let steerCooldownUntil = 0;
        const steerWorld = async (text: string) => {
          const clean = text.trim();
          if (!clean) return;
          if (Date.now() < steerCooldownUntil) return;
          steerCooldownUntil = Date.now() + 2000;
          for (let i = 0; i < 10; i++) {
            if (cancelled || !handleRef.current) break;
            await session.send(clean as never);
            await new Promise((r) => window.setTimeout(r, 150));
          }
        };

        const sendKey = async (action: "key_down" | "key_up", input: GenieKeyInput) => {
          await session.send({
            event_type: "user_action",
            action,
            input,
          } as never);
        };

        const stop = async () => {
          try {
            await session.complete();
            await endedPromise;
          } catch {
            session.detach();
          }
        };

        handleRef.current = { sendKey, steerWorld, stop };
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setErrorMsg(err instanceof Error ? err.message : "Unable to connect to Genie 4.");
          setStatus("error");
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      void stopSessionSafely();
    };
  }, [request, sessionSeed, stopSessionSafely]);

  // Countdown timer once the WebRTC video starts playing
  useEffect(() => {
    if (status !== "live") return;
    const timer = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          void stopSessionSafely();
          setStatus("ended");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, stopSessionSafely]);

  // Sync mute state with <video>
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // Track fullscreen changes
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const pressMoveKey = useCallback((key: GenieKeyInput) => {
    setActiveKeys((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    if (!pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.add(key);
      void handleRef.current?.sendKey("key_down", key).catch(() => {});
    }
  }, []);

  const releaseMoveKey = useCallback((key: GenieKeyInput) => {
    setActiveKeys((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    if (pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.delete(key);
      void handleRef.current?.sendKey("key_up", key).catch(() => {});
    }
  }, []);

  const triggerSpaceSteer = useCallback(() => {
    setActiveKeys((prev) => ({ ...prev, space: true }));
    flashFeedback("Leap / elevate perspective");
    void handleRef.current
      ?.steerWorld("The viewer leaps upward smoothly and glides forward with a wider aerial view.")
      .catch(() => {});
    window.setTimeout(() => {
      setActiveKeys((prev) => ({ ...prev, space: false }));
    }, 260);
  }, [flashFeedback]);

  // Hold-to-talk voice steering (Key V or pressing the bottom-center pill)
  const startVoiceSteer = useCallback(async () => {
    if (voiceHolding) return;
    setVoiceHolding(true);
    setActiveKeys((prev) => ({ ...prev, voice: true }));
    setVoiceStatus("Listening…");
    recorderChunksRef.current = [];

    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setVoiceStatus("Mic unavailable");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recorderChunksRef.current.push(ev.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      setVoiceStatus("Mic blocked");
    }
  }, [voiceHolding]);

  const stopVoiceSteer = useCallback(async () => {
    if (!voiceHolding) return;
    setVoiceHolding(false);
    setActiveKeys((prev) => ({ ...prev, voice: false }));

    const recorder = recorderRef.current;
    const stream = recorderStreamRef.current;
    recorderRef.current = null;
    recorderStreamRef.current = null;

    if (!recorder || recorder.state === "inactive") {
      stream?.getTracks().forEach((t) => t.stop());
      setVoiceStatus(null);
      return;
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(recorderChunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorder.stop();
    });
    stream?.getTracks().forEach((t) => t.stop());

    if (blob.size < 250) {
      setVoiceStatus(null);
      return;
    }

    setVoiceStatus("Steering…");
    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: blob.type || "audio/webm" }),
      });
      const data = (await res.json()) as { transcript?: string; error?: string };
      const text = data.transcript?.trim();
      if (res.ok && text) {
        flashFeedback(`Steering: “${text}”`);
        await handleRef.current?.steerWorld(text);
      } else {
        flashFeedback(data.error || "Could not transcribe voice steering.");
      }
    } catch {
      flashFeedback("Voice steering failed.");
    } finally {
      setVoiceStatus(null);
    }
  }, [flashFeedback, voiceHolding]);

  // Physical computer keyboard listeners (`WASD`, `Arrows`, `Space`, `V`, `Escape`)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
        return;
      }
      const mapped = mapKeyboardCodeToGenieAction(e.code);
      if (!mapped) return;
      e.preventDefault();
      if (e.repeat) return;
      if (mapped === "space") {
        triggerSpaceSteer();
      } else if (mapped === "voice") {
        void startVoiceSteer();
      } else {
        pressMoveKey(mapped);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = mapKeyboardCodeToGenieAction(e.code);
      if (!mapped) return;
      if (mapped === "voice") {
        void stopVoiceSteer();
      } else if (mapped !== "space") {
        releaseMoveKey(mapped);
      }
    };

    const onBlur = () => {
      for (const key of Array.from(pressedKeysRef.current)) {
        releaseMoveKey(key);
      }
      if (voiceHolding) {
        void stopVoiceSteer();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [handleClose, pressMoveKey, releaseMoveKey, startVoiceSteer, stopVoiceSteer, triggerSpaceSteer, voiceHolding]);

  const submitSteerText = async (e: FormEvent) => {
    e.preventDefault();
    const text = steerInput.trim();
    if (!text) return;
    setSteerInput("");
    flashFeedback(`Steering: “${text}”`);
    await handleRef.current?.steerWorld(text).catch(() => {});
  };

  const toggleFullscreen = async () => {
    const el = frameRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen may be disallowed in embedded iframes
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-[#f4f6fb]/75 p-4 backdrop-blur-[10px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Genie 4 interactive world — ${request.sourceLabel}`}
      data-testid="genie-world-overlay"
      data-status={status}
    >
      {/* Prismatic glowing rounded frame matching Figure 2 */}
      <motion.div
        ref={frameRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative h-full max-h-[860px] w-full max-w-[1380px] rounded-[24px] p-[2.5px] shadow-[0_0_46px_-6px_rgba(92,138,255,0.42),0_26px_70px_-24px_rgba(30,40,70,0.34)]"
        style={{
          background:
            "linear-gradient(125deg, #6fa3ff 0%, #8eb8ff 24%, #a8c5ff 46%, #8ce6a0 76%, #689cff 100%)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-white select-none">
          {/* Live Genie 4 WebRTC Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            onPlaying={() => setStatus("live")}
            onLoadedData={() => setStatus((prev) => (prev === "building" ? "live" : prev))}
            data-testid="genie-video-surface"
            className={`h-full w-full object-cover transition-opacity duration-700 ${
              status === "live" ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Figure 2 Luminous White-to-Pastel-Rainbow Aura Loading / Ended / Error Layer */}
          <AnimatePresence>
            {status !== "live" && (
              <motion.div
                key="genie-aura"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-white"
                data-testid="genie-loading-stage"
              >
                {/* Bottom dreamy pastel watercolor rainbow gradient matching Figure 2 */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-[-10%] -bottom-[14%] h-[68%] opacity-95 blur-[58px]"
                  style={{
                    background:
                      "radial-gradient(ellipse 36% 78% at 14% 88%, rgba(114, 152, 255, 0.72), transparent 70%), radial-gradient(ellipse 36% 82% at 39% 86%, rgba(255, 114, 138, 0.72), transparent 72%), radial-gradient(ellipse 32% 76% at 56% 88%, rgba(255, 206, 86, 0.74), transparent 70%), radial-gradient(ellipse 36% 78% at 75% 88%, rgba(92, 208, 128, 0.72), transparent 70%), radial-gradient(ellipse 34% 72% at 92% 84%, rgba(132, 178, 255, 0.65), transparent 70%)",
                  }}
                />

                <div className="relative z-10 max-w-lg px-6 text-center">
                  {status === "building" && (
                    <>
                      <p
                        className="text-[20px] font-normal tracking-[-0.01em] text-[#4c4f56]"
                        data-testid="text-genie-status"
                      >
                        Building your world...
                      </p>
                      <p className="mt-2 line-clamp-2 text-[12.5px] text-[#787d87]">
                        {request.sourceLabel}
                      </p>
                    </>
                  )}

                  {status === "ended" && (
                    <div className="rounded-2xl border border-black/8 bg-white/88 px-6 py-5 shadow-lg backdrop-blur-md">
                      <p className="text-[17px] font-medium text-[#1f2329]" data-testid="text-genie-status">
                        Genie 4 session completed
                      </p>
                      <p className="mt-1.5 text-[13px] text-[#5c626d]">
                        Sessions run up to 2 minutes per world. Start a fresh session or return to the browser.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSessionSeed((n) => n + 1)}
                          data-testid="button-genie-restart"
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1f2430] px-4 text-[13px] font-medium text-white hover:bg-[#313849]"
                        >
                          <RotateCw className="size-3.5" />
                          Rebuild world
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white px-4 text-[13px] font-medium text-[#2c3038] hover:bg-[#f4f5f7]"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {status === "error" && (
                    <div className="rounded-2xl border border-black/10 bg-white/92 px-6 py-5 shadow-lg backdrop-blur-md">
                      <p className="text-[16px] font-medium text-[#1f2329]" data-testid="text-genie-status">
                        Unable to stream Genie 4 world
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-[#5c626d]">
                        {errorMsg || "The live world connection ended unexpectedly."}
                      </p>
                      {worldPrompt && (
                        <p className="mt-3 rounded-xl bg-[#f5f6f9] p-3 text-left text-[11.5px] leading-relaxed text-[#4b515c]">
                          {worldPrompt}
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSessionSeed((n) => n + 1)}
                          data-testid="button-genie-retry"
                          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1f2430] px-4 text-[13px] font-medium text-white hover:bg-[#313849]"
                        >
                          <RotateCw className="size-3.5" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="inline-flex h-9 items-center rounded-full border border-black/12 bg-white px-4 text-[13px] font-medium text-[#2c3038] hover:bg-[#f4f5f7]"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top-right Countdown Timer Pill (matches Figure 2) + Close button */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
            <div
              data-testid="genie-timer"
              className="inline-flex h-[32px] items-center gap-1.5 rounded-full bg-[#3b3f4a]/80 px-3 text-[13px] font-medium tabular-nums text-white backdrop-blur-md shadow-sm"
            >
              <Timer className="size-3.5 opacity-90" />
              <span>{formatClock(remainingSec)}</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close Genie 4 world"
              data-testid="button-genie-close"
              className="grid size-[32px] place-items-center rounded-full bg-[#3b3f4a]/80 text-white backdrop-blur-md transition hover:bg-[#1f232c]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Subtle live steering feedback banner */}
          <AnimatePresence>
            {(steerFeedback || voiceStatus) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="pointer-events-none absolute left-1/2 bottom-[74px] z-20 -translate-x-1/2 rounded-full bg-[#202430]/85 px-4 py-1.5 text-[12.5px] text-white backdrop-blur-md shadow-lg"
                data-testid="genie-steer-toast"
              >
                {voiceStatus || steerFeedback}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optional Text Steering Popover toggled from bottom-right pill */}
          <AnimatePresence>
            {steerOpen && (
              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                onSubmit={submitSteerText}
                className="absolute bottom-[74px] right-4 z-30 flex w-[min(360px,calc(100%-32px))] items-center gap-1.5 rounded-full border border-white/15 bg-[#1e222e]/90 p-1.5 pl-4 text-white shadow-2xl backdrop-blur-md"
                data-testid="form-genie-steer"
              >
                <input
                  value={steerInput}
                  onChange={(e) => setSteerInput(e.target.value)}
                  placeholder="Steer the world (e.g. turn to sunset rain)..."
                  aria-label="Steer Genie 4 world"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/55"
                />
                <button
                  type="submit"
                  aria-label="Send steering prompt"
                  className="grid size-8 place-items-center rounded-full bg-white text-[#1b1f2a] hover:bg-white/90"
                >
                  <Send className="size-3.5" />
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom-left Keyboard Control HUD matching Figure 2 exact keycap geometry */}
          {hudVisible && (
            <div
              className="absolute bottom-4 left-4 z-20 flex items-end gap-3.5"
              data-testid="genie-keyboard-hud"
            >
              {/* WASD + SPACE cluster */}
              <div className="flex flex-col items-center gap-1.5">
                <KeyCap
                  label="W"
                  ariaLabel="Move forward (W)"
                  active={Boolean(activeKeys.key_w)}
                  testid="genie-key-w"
                  onDown={() => pressMoveKey("key_w")}
                  onUp={() => releaseMoveKey("key_w")}
                />
                <div className="flex items-center gap-1.5">
                  <KeyCap
                    label="A"
                    ariaLabel="Move left (A)"
                    active={Boolean(activeKeys.key_a)}
                    testid="genie-key-a"
                    onDown={() => pressMoveKey("key_a")}
                    onUp={() => releaseMoveKey("key_a")}
                  />
                  <KeyCap
                    label="S"
                    ariaLabel="Move backward (S)"
                    active={Boolean(activeKeys.key_s)}
                    testid="genie-key-s"
                    onDown={() => pressMoveKey("key_s")}
                    onUp={() => releaseMoveKey("key_s")}
                  />
                  <KeyCap
                    label="D"
                    ariaLabel="Move right (D)"
                    active={Boolean(activeKeys.key_d)}
                    testid="genie-key-d"
                    onDown={() => pressMoveKey("key_d")}
                    onUp={() => releaseMoveKey("key_d")}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Leap or elevate view (Space)"
                  data-testid="genie-key-space"
                  data-active={activeKeys.space ? "true" : "false"}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    triggerSpaceSteer();
                  }}
                  className={`flex h-[38px] w-[132px] items-center justify-center rounded-full border text-[13px] font-medium tracking-[0.06em] text-white backdrop-blur-md transition ${
                    activeKeys.space
                      ? "scale-[0.97] border-white bg-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.65)]"
                      : "border-white/15 bg-[#363d52]/80 hover:bg-[#414961]/90"
                  }`}
                >
                  SPACE
                </button>
              </div>

              {/* Arrow camera cluster aligned to bottom */}
              <div className="flex flex-col items-center gap-1.5">
                <KeyCap
                  label={<ArrowUp className="size-4" />}
                  ariaLabel="Look up (Arrow Up)"
                  active={Boolean(activeKeys.arrow_up)}
                  testid="genie-key-up"
                  onDown={() => pressMoveKey("arrow_up")}
                  onUp={() => releaseMoveKey("arrow_up")}
                />
                <div className="flex items-center gap-1.5">
                  <KeyCap
                    label={<ArrowLeft className="size-4" />}
                    ariaLabel="Look left (Arrow Left)"
                    active={Boolean(activeKeys.arrow_left)}
                    testid="genie-key-left"
                    onDown={() => pressMoveKey("arrow_left")}
                    onUp={() => releaseMoveKey("arrow_left")}
                  />
                  <KeyCap
                    label={<ArrowDown className="size-4" />}
                    ariaLabel="Look down (Arrow Down)"
                    active={Boolean(activeKeys.arrow_down)}
                    testid="genie-key-down"
                    onDown={() => pressMoveKey("arrow_down")}
                    onUp={() => releaseMoveKey("arrow_down")}
                  />
                  <KeyCap
                    label={<ArrowRight className="size-4" />}
                    ariaLabel="Look right (Arrow Right)"
                    active={Boolean(activeKeys.arrow_right)}
                    testid="genie-key-right"
                    onDown={() => pressMoveKey("arrow_right")}
                    onUp={() => releaseMoveKey("arrow_right")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom-center Hold-to-talk Pill matching Figure 2 */}
          <button
            type="button"
            data-testid="button-genie-talk"
            aria-label="Hold V or press to talk and steer the world"
            onPointerDown={(e) => {
              e.preventDefault();
              void startVoiceSteer();
            }}
            onPointerUp={() => void stopVoiceSteer()}
            onPointerLeave={() => {
              if (voiceHolding) void stopVoiceSteer();
            }}
            className={`absolute bottom-4 left-1/2 z-20 flex h-[40px] -translate-x-1/2 items-center gap-2 rounded-full border px-4 text-[13px] font-medium text-white backdrop-blur-md transition ${
              voiceHolding || activeKeys.voice
                ? "scale-[0.98] border-white/60 bg-[#1e2230]/95 shadow-[0_0_20px_rgba(120,165,255,0.5)]"
                : "border-white/12 bg-[#3a3634]/82 hover:bg-[#2c2a2a]/90"
            }`}
          >
            <Mic className={`size-4 ${voiceHolding ? "text-[#ff7b7b] animate-pulse" : "text-white/90"}`} />
            <span className="grid size-5 place-items-center rounded-full bg-white/18 text-[11px] font-semibold">
              V
            </span>
            <span>{voiceHolding ? "Release to send" : "Hold to talk"}</span>
          </button>

          {/* Bottom-right 4-icon Dark Control Pill matching Figure 2 */}
          <div
            className="absolute bottom-4 right-4 z-20 flex h-[44px] items-center gap-1 rounded-full border border-white/12 bg-[#232837]/86 px-2 text-white backdrop-blur-md shadow-lg"
            data-testid="genie-right-controls"
          >
            <button
              type="button"
              onClick={() => setHudVisible((v) => !v)}
              aria-label={hudVisible ? "Hide keyboard HUD" : "Show keyboard HUD"}
              aria-pressed={hudVisible}
              data-testid="button-genie-toggle-hud"
              className={`grid size-9 place-items-center rounded-full transition ${
                hudVisible ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Gamepad2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute world audio" : "Mute world audio"}
              aria-pressed={muted}
              data-testid="button-genie-mute"
              className="grid size-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => setSteerOpen((v) => !v)}
              aria-label="Steer world with text prompt"
              aria-pressed={steerOpen}
              data-testid="button-genie-steer-toggle"
              className={`grid size-9 place-items-center rounded-full transition ${
                steerOpen ? "bg-white/18 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Disc className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              data-testid="button-genie-fullscreen"
              className="grid size-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function KeyCap({
  label,
  ariaLabel,
  active,
  testid,
  onDown,
  onUp,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  active: boolean;
  testid: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testid}
      data-active={active ? "true" : "false"}
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={() => {
        if (active) onUp();
      }}
      onPointerCancel={onUp}
      className={`grid size-[40px] place-items-center rounded-full border text-[14px] font-medium text-white backdrop-blur-md transition ${
        active
          ? "scale-95 border-white bg-[#2563eb] shadow-[0_0_20px_rgba(37,99,235,0.68)]"
          : "border-white/15 bg-[#363d52]/80 hover:bg-[#414961]/90"
      }`}
    >
      {label}
    </button>
  );
}
