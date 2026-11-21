import type { ReactNode } from "react";

export function ModelUnavailable({ topic, compact, actions }: { topic: string; compact: boolean; actions?: ReactNode }) {
  return (
    <div className="relative h-full w-full bg-[#f3eee2] p-[10%] text-[#3c372d]" data-testid="status-model-unavailable">
      {!compact && <div className="absolute right-[8%] top-[8%] flex gap-1">{actions}</div>}
      <div className="grid h-full place-content-center text-center">
        <h2 className={`font-cell ${compact ? "text-lg" : "text-3xl"}`}>{topic}</h2>
        <p className="mt-2 text-sm">No 3D model is available for this article yet.</p>
        {!compact && <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#6b6255]">Plant cell and Neuron have interactive models. Other articles remain readable without substituting an unrelated scene.</p>}
      </div>
    </div>
  );
}
