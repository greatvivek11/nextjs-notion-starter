#!/usr/bin/env python3

import argparse
import json
import re
import time
import wave
from pathlib import Path

import whisperx


def normalize_text(text: str) -> str:
    return " ".join((text or "").strip().split())


def split_transcript_segments(text: str) -> list[str]:
    segments = []
    blocks = re.split(r"\n{2,}", text or "")

    for block in blocks:
        normalized_block = block.strip()
        if not normalized_block:
            continue

        sentences = re.split(r"(?<=[.!?])\s+", normalized_block)
        for sentence in sentences:
            normalized_sentence = normalize_text(sentence)
            if normalized_sentence:
                segments.append(normalized_sentence)

    return segments


def get_audio_duration(audio_path: Path) -> float:
    with wave.open(str(audio_path), "rb") as wav_file:
        frame_rate = wav_file.getframerate()
        frame_count = wav_file.getnframes()
        if frame_rate <= 0:
            raise RuntimeError("Audio file has an invalid sample rate.")
        return frame_count / frame_rate


def build_alignment_input(segments: list[str], audio_duration: float):
    total_units = sum(max(len(segment), 1) for segment in segments)
    current_time = 0.0
    alignment_input = []

    for index, segment in enumerate(segments):
        relative_units = max(len(segment), 1)
        segment_duration = audio_duration * (relative_units / total_units)
        segment_end = (
            audio_duration
            if index == len(segments) - 1
            else min(audio_duration, current_time + segment_duration)
        )

        alignment_input.append(
            {
                "text": segment,
                "start": current_time,
                "end": segment_end,
            }
        )
        current_time = segment_end

    return alignment_input


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--transcript-file", required=True)
    parser.add_argument("--input-audio-file", required=True)
    parser.add_argument("--output-alignment-file", required=True)
    parser.add_argument("--segments-file", default="")
    parser.add_argument("--alignment-language", default="en")
    parser.add_argument("--align-model-name", default="")
    parser.add_argument("--whisper-device", default="cpu")
    args = parser.parse_args()

    raw_transcript = Path(args.transcript_file).read_text(encoding="utf-8")
    transcript_segments = split_transcript_segments(raw_transcript)
    if not transcript_segments:
        raise RuntimeError("Cannot align an empty transcript.")

    input_audio = Path(args.input_audio_file)
    output_alignment = Path(args.output_alignment_file)
    output_alignment.parent.mkdir(parents=True, exist_ok=True)

    started_at = time.perf_counter()
    audio = whisperx.load_audio(str(input_audio))
    audio_duration = get_audio_duration(input_audio)

    load_kwargs = {
        "language_code": args.alignment_language,
        "device": args.whisper_device,
    }
    if args.align_model_name:
        load_kwargs["model_name"] = args.align_model_name

    align_model, metadata = whisperx.load_align_model(**load_kwargs)
    if args.segments_file:
        provided_segments = json.loads(
            Path(args.segments_file).read_text(encoding="utf-8")
        )
        alignment_input = [
            {
                "text": normalize_text(segment["text"]),
                "start": float(segment["start"]),
                "end": float(segment["end"]),
            }
            for segment in provided_segments
            if normalize_text(segment.get("text", ""))
        ]
    else:
        alignment_input = build_alignment_input(transcript_segments, audio_duration)

    result = whisperx.align(
        alignment_input,
        align_model,
        metadata,
        audio,
        args.whisper_device,
        return_char_alignments=False,
    )

    words = []
    for segment in result.get("segments", []):
        for word in segment.get("words", []):
            start = word.get("start")
            end = word.get("end")
            # Normalize removes embedded newlines WhisperX sometimes leaves in tokens
            text = normalize_text(word.get("word", ""))

            if text and isinstance(start, (float, int)) and isinstance(
                end, (float, int)
            ):
                words.append(
                    {
                        "index": len(words),
                        "text": text,
                        "start": float(start),
                        "end": float(end),
                    }
                )

    if not words:
        raise RuntimeError("WhisperX did not return aligned word timings.")

    output_alignment.write_text(
        json.dumps({"words": words}, indent=2), encoding="utf-8"
    )
    print(
        f"[Kokoro] WhisperX alignment completed in {time.perf_counter() - started_at:.2f}s with {len(words)} words."
    )
    print("[Kokoro] Alignment file written successfully.")


if __name__ == "__main__":
    main()
