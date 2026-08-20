"use client";

interface TTSBarProps {
  state: "idle" | "playing" | "paused";
  currentText: string;
  progress: { current: number; total: number } | null;
  voice: string;
  onVoiceChange: (v: string) => void;
  rate: number;
  onRateChange: (r: number) => void;
  onTogglePlay: () => void;
  onStop: () => void;
}

const VOICE_OPTIONS = [
  { key: "xiaoxiao", label: "晓晓 · 温暖" },
  { key: "xiaochen", label: "晓晨 · 治愈" },
  { key: "xiaoyi", label: "晓伊 · 活泼" },
];

const RATE_OPTIONS = [
  { value: 0.8, label: "0.8x" },
  { value: 1, label: "1.0x" },
  { value: 1.2, label: "1.2x" },
];

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

export default function TTSBar({
  state,
  currentText,
  progress,
  voice,
  onVoiceChange,
  rate,
  onRateChange,
  onTogglePlay,
  onStop,
}: TTSBarProps) {
  const playing = state === "playing";
  const voiceOption = VOICE_OPTIONS.find((v) => v.key === voice) ?? VOICE_OPTIONS[0];
  const rateOption = RATE_OPTIONS.find((r) => r.value === rate) ?? RATE_OPTIONS[1];

  const cycleVoice = () => {
    const i = VOICE_OPTIONS.findIndex((v) => v.key === voice);
    onVoiceChange(VOICE_OPTIONS[(i + 1) % VOICE_OPTIONS.length].key);
  };
  const cycleRate = () => {
    const i = RATE_OPTIONS.findIndex((r) => r.value === rate);
    onRateChange(RATE_OPTIONS[(i + 1) % RATE_OPTIONS.length].value);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-paper-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5">
        {/* 播放/暂停 */}
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 shrink-0 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent-dark transition-colors"
          title={playing ? "暂停" : "播放"}
          aria-label={playing ? "暂停" : "播放"}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* 停止 */}
        <button
          onClick={onStop}
          className="w-10 h-10 shrink-0 rounded-full border border-paper-300 text-ink-muted flex items-center justify-center hover:text-ink hover:border-ink-muted transition-colors"
          title="停止朗读"
          aria-label="停止朗读"
        >
          <StopIcon />
        </button>

        {/* 朗读文本 + 进度 */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink font-sans truncate">
            {currentText || (playing ? "正在准备朗读…" : "已暂停")}
          </p>
          {progress && (
            <p className="text-[10px] text-ink-muted font-sans mt-0.5 tabular-nums">
              第 {progress.current} / {progress.total} 段
            </p>
          )}
        </div>

        {/* 声音切换 */}
        <button
          onClick={cycleVoice}
          className="shrink-0 px-2.5 h-8 rounded-lg border border-paper-200 text-xs text-ink-muted hover:border-accent-light hover:text-ink transition-colors font-sans"
          title="切换声音"
        >
          <span className="hidden sm:inline">{voiceOption.label}</span>
          <span className="sm:hidden">{voiceOption.label.split(" · ")[0]}</span>
        </button>

        {/* 语速切换 */}
        <button
          onClick={cycleRate}
          className="shrink-0 px-2.5 h-8 rounded-lg border border-paper-200 text-xs text-ink-muted hover:border-accent-light hover:text-ink transition-colors font-sans tabular-nums"
          title="切换语速"
        >
          {rateOption.label}
        </button>
      </div>
    </div>
  );
}
