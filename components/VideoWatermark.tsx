"use client";

interface VideoWatermarkProps {
  text: string;
}

export default function VideoWatermark({ text }: VideoWatermarkProps) {
  return (
    <div className="watermark-container absolute bottom-6 right-6 text-white text-xs opacity-60 pointer-events-none z-50 select-none font-mono bg-black/20 px-2 py-1 rounded">
      {text}
    </div>
  );
}
