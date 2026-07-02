#!/usr/bin/env python3
"""
Pipeline transcriber — parameterized port of the validated spike run
(scripts/spike/mux_transcribe2.py: full-length 22:26 transcript, no
repetition loop, per-segment confidence captured).

Usage:
  python scripts/pipeline/transcribe.py --audio <in.m4a> --json-out <out.json>
      --txt-out <out.txt> [--device auto|cuda|cpu]

Transcription settings are fixed to the validated configuration: faster-whisper
large-v3, language=ar, vad_filter, dental initial_prompt, and
condition_on_previous_text=False — the last one prevents the repetition-loop
degeneration that killed the first full-length spike run at 10:53/22:26.

Device (--device, default "auto"): "cuda" runs large-v3 float16 on the GPU
(~11x realtime on the RTX 4070 vs ~1x realtime CPU, validated at quality
parity); "cpu" is the proven int8 path; "auto" tries CUDA and degrades to CPU
with a warning if CUDA init or its libraries fail — a missing GPU must never
crash the pipeline.

Writes:
  --json-out : JSON array of {id, start, end, text, avg_logprob,
               no_speech_prob, compression_ratio}
  --txt-out  : human-readable [HH:MM:SS -> HH:MM:SS] lines + summary footer
"""

import argparse
import json
import os
import sys
from pathlib import Path

os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Same mixed-script dental vocab seed validated in the spike runs.
INITIAL_PROMPT = (
    "محاضرة طب الأسنان: composite, root canal, occlusion, endodontics, "
    "الحشوة، العصب، التاج"
)


def hhmmss(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def dump_json(records: list, path: Path) -> None:
    path.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")


def _prepend_nvidia_dll_dirs() -> None:
    """GPU support on Windows: the nvidia-cublas-cu12 / nvidia-cudnn-cu12 pip
    wheels put their DLLs in site-packages/nvidia/*/bin, which ctranslate2
    cannot find on its own — it lazy-loads cuBLAS with a plain LoadLibrary(),
    which searches PATH but ignores os.add_dll_directory registrations.
    Prepend every wheel bin dir that exists; silently a no-op when the wheels
    aren't installed (CPU-only machines)."""
    import site

    candidates: list[str] = []
    try:
        candidates.extend(site.getsitepackages())
    except Exception:
        pass  # some embedded interpreters lack getsitepackages
    user_site = site.getusersitepackages()
    if user_site:
        candidates.append(user_site)

    dll_dirs = []
    for site_dir in candidates:
        for lib in ("cublas", "cudnn"):
            bin_dir = Path(site_dir) / "nvidia" / lib / "bin"
            if bin_dir.is_dir():
                dll_dirs.append(str(bin_dir))
    if dll_dirs:
        os.environ["PATH"] = os.pathsep.join(dll_dirs + [os.environ.get("PATH", "")])


def _probe_cuda(model) -> None:
    """Force one real encode. CUDA model *construction* succeeds even when
    cuBLAS/cuDNN DLLs are missing — the failure only surfaces at the first
    encode — so run one second of silence through the model (vad off so the
    encoder actually executes) before trusting the GPU with the real file."""
    import numpy as np

    segments, _info = model.transcribe(
        np.zeros(16000, dtype=np.float32), language="ar", vad_filter=False
    )
    next(segments, None)


def load_model(device: str):
    """Load large-v3 per --device; returns (model, device_label, compute_type).

    cuda -> float16 on GPU, raising if unusable; cpu -> the proven int8 path;
    auto -> cuda first, falling back to cpu on ANY failure (the pipeline must
    never die because a GPU is absent)."""
    from faster_whisper import WhisperModel

    if device in ("auto", "cuda"):
        _prepend_nvidia_dll_dirs()

    if device == "cpu":
        return WhisperModel("large-v3", device="cpu", compute_type="int8"), "cpu", "int8"

    if device == "cuda":
        model = WhisperModel("large-v3", device="cuda", compute_type="float16")
        _probe_cuda(model)
        return model, "cuda", "float16"

    try:
        model = WhisperModel("large-v3", device="cuda", compute_type="float16")
        _probe_cuda(model)
        return model, "cuda", "float16"
    except Exception as exc:
        print(f"[whisper] WARNING: CUDA unavailable ({exc}) — falling back to CPU int8")
        return WhisperModel("large-v3", device="cpu", compute_type="int8"), "cpu", "int8"


def main() -> None:
    parser = argparse.ArgumentParser(description="Transcribe one audio file (validated pipeline settings).")
    parser.add_argument("--audio", required=True, help="input audio file (m4a/wav; decoded by faster-whisper's bundled PyAV)")
    parser.add_argument("--json-out", required=True, help="output JSON path (segments + confidence)")
    parser.add_argument("--txt-out", required=True, help="output human-readable transcript path")
    parser.add_argument(
        "--device", choices=("auto", "cuda", "cpu"), default="auto",
        help="auto = try CUDA float16, fall back to CPU int8 (default); "
             "cuda = force GPU (error if unusable); cpu = force the proven CPU path",
    )
    args = parser.parse_args()

    audio = Path(args.audio)
    json_out = Path(args.json_out)
    txt_out = Path(args.txt_out)

    if not audio.exists() or audio.stat().st_size == 0:
        sys.exit(f"audio not found or empty: {audio}")
    json_out.parent.mkdir(parents=True, exist_ok=True)
    txt_out.parent.mkdir(parents=True, exist_ok=True)

    print(f"[whisper] loading large-v3 (device={args.device}) ...")
    model, device_label, compute_type = load_model(args.device)
    print(f"[whisper] running on {device_label} ({compute_type})")

    print(f"[whisper] transcribing {audio.name} "
          f"({audio.stat().st_size/1024/1024:.1f} MB) — language=ar, vad, "
          f"condition_on_previous_text=False ...")
    segments, info = model.transcribe(
        str(audio),
        language="ar",
        initial_prompt=INITIAL_PROMPT,
        vad_filter=True,
        condition_on_previous_text=False,
    )

    header = [
        "# pipeline transcript",
        f"# audio: {audio.name}",
        f"# model: large-v3 {compute_type} {device_label} | language=ar"
        f" | detected p={info.language_probability:.2f}",
        f"# initial_prompt: {INITIAL_PROMPT}",
        "",
    ]

    records: list = []
    # Stream the txt as segments arrive (partial progress survives a kill);
    # re-dump the JSON every 25 segments so confidence data survives too.
    with open(txt_out, "w", encoding="utf-8") as f:
        f.write("\n".join(header) + "\n")
        f.flush()
        for seg in segments:
            line = f"[{hhmmss(seg.start)} -> {hhmmss(seg.end)}] {seg.text.strip()}"
            print(line)
            f.write(line + "\n")
            f.flush()
            records.append({
                "id": seg.id,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
                "avg_logprob": round(seg.avg_logprob, 4),
                "no_speech_prob": round(seg.no_speech_prob, 4),
                "compression_ratio": round(seg.compression_ratio, 4),
            })
            if len(records) % 25 == 0:
                dump_json(records, json_out)

    dump_json(records, json_out)

    if records:
        summary = [
            f"# segments: {len(records)} | last end: {hhmmss(records[-1]['end'])}",
            f"# min avg_logprob: {min(r['avg_logprob'] for r in records):.4f}",
            f"# max no_speech_prob: {max(r['no_speech_prob'] for r in records):.4f}",
            f"# max compression_ratio: {max(r['compression_ratio'] for r in records):.4f}",
        ]
        with open(txt_out, "a", encoding="utf-8") as f:
            f.write("\n" + "\n".join(summary) + "\n")
        print("\n" + "\n".join(summary))

    print(f"\n[done] transcript -> {txt_out}")
    print(f"[done] json       -> {json_out}")


if __name__ == "__main__":
    main()
