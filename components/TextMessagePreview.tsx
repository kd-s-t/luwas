type TextPreview = {
  body: string;
  segments: number;
  chars: number;
};

/** Phone-frame SMS preview — shared by command templates and bootstrap kit. */
export function TextMessagePreview({ preview }: { preview: TextPreview }) {
  return (
    <div className="mx-auto w-full max-w-[248px]">
      <div className="relative rounded-[2rem] bg-[#1c1c1e] p-[10px] shadow-[0_18px_40px_rgba(15,42,28,0.22),0_2px_0_rgba(255,255,255,0.06)_inset]">
        <span
          aria-hidden
          className="absolute top-[88px] -left-[2px] h-8 w-[3px] rounded-l-sm bg-[#2c2c2e]"
        />
        <span
          aria-hidden
          className="absolute top-[132px] -left-[2px] h-12 w-[3px] rounded-l-sm bg-[#2c2c2e]"
        />
        <span
          aria-hidden
          className="absolute top-[110px] -right-[2px] h-16 w-[3px] rounded-r-sm bg-[#2c2c2e]"
        />

        <div className="relative overflow-hidden rounded-[1.45rem] bg-[#0b1410]">
          <div className="relative z-10 flex items-center justify-between px-4 pt-2.5 pb-1">
            <span className="text-[10px] font-semibold tracking-wide text-white/85">
              9:41
            </span>
            <div className="flex items-center gap-1 text-white/80">
              <span className="block h-[6px] w-3 rounded-[1px] bg-white/75" />
              <span className="block h-[8px] w-[14px] rounded-[2px] border border-white/70">
                <span className="ml-[1px] mt-[1px] block h-[4px] w-[9px] rounded-[1px] bg-white/80" />
              </span>
            </div>
          </div>

          <div
            aria-hidden
            className="absolute top-2 left-1/2 z-20 h-[22px] w-[96px] -translate-x-1/2 rounded-full bg-black"
          />

          <div className="border-b border-white/10 px-3 pt-3 pb-2.5 text-center">
            <p className="text-[10px] font-medium tracking-wide text-[#7dcea0] uppercase">
              Messages
            </p>
            <p className="mt-0.5 text-[13px] font-semibold text-white">
              LUWAS Alerts
            </p>
          </div>

          <div className="flex min-h-[280px] flex-col bg-gradient-to-b from-[#0f1f18] to-[#0b1410] px-3 pt-4 pb-5">
            <p className="mb-3 text-center text-[10px] text-white/35">Today</p>
            <div className="mr-auto max-w-[92%] rounded-[1.15rem] rounded-bl-md bg-[#24352c] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-white/95 shadow-sm">
              {preview.body}
            </div>
            <p className="mt-1.5 text-left font-mono text-[9px] text-white/35">
              {preview.chars} chars · {preview.segments} seg
            </p>
            <div className="mt-auto pt-6">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="flex-1 text-[11px] text-white/30">
                  Text Message
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1f8f55] text-[11px] font-bold text-white">
                  ↑
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center bg-[#0b1410] pb-2 pt-1">
            <span
              aria-hidden
              className="h-[4px] w-28 rounded-full bg-white/25"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
