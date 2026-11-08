// A plain heart in TOUCH red (or currentColor), standing in for their logo. Same shape as public/icon.svg.
export const HEART_PATH =
  "M256 448C256 448 64 320 64 184C64 120 112 72 176 72C212 72 240 92 256 120C272 92 300 72 336 72C400 72 448 120 448 184C448 320 256 448 256 448Z";

export function HeartLogo({ className = "h-8 w-8 text-brand" }: { className?: string }) {
  return (
    <svg viewBox="40 50 432 420" className={className} aria-hidden>
      <path d={HEART_PATH} fill="currentColor" />
    </svg>
  );
}
