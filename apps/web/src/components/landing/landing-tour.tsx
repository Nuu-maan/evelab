"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { IconPlay } from "@/components/icons";
import type { Theme } from "@/lib/theme";
import "@/app/landing-tour.css";

const CHAPTERS = ["Create", "Build", "Read the code", "Export"] as const;
const CHAPTER_NOTES = [
  "Name your agent and pick a model. The project is ready in seconds.",
  "Drag tools, subagents and channels onto your agent.",
  "Each piece is a file you can read and edit.",
  "Download a zip or push it to GitHub.",
] as const;

/* Where each chapter starts in the recordings, in seconds. The two themes were filmed separately. */
const STARTS: Record<Theme, readonly number[]> = {
  dark: [0, 13.9, 38.6, 48],
  light: [0, 13.9, 38.9, 49.6],
};

/** The theme the page is showing, following the toggle as it changes. */
function usePageTheme() {
  const [theme, setTheme] = useState<Theme>();
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/**
 * The landing page tour: a real recording of evelab, filmed in the app itself,
 * in the page's theme. It plays muted while in view, and the chapters below
 * double as its progress and a way to jump around.
 */
export function LandingTour() {
  const theme = usePageTheme();
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const resumeAt = useRef(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Reduced motion: the poster stands still until asked to play.
    const update = () => query.matches && setPlaying(false);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Plays only while wanted and on screen.
  useEffect(() => {
    const element = video.current;
    if (!element || !theme) return;
    if (playing && visible) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [playing, visible, theme]);

  // The chapter bars follow the playhead directly, without re-rendering each frame.
  useEffect(() => {
    if (!theme) return;
    const starts = STARTS[theme];
    let frame = 0;
    const tick = () => {
      const element = video.current;
      if (element) {
        const time = element.currentTime;
        const end = element.duration || starts[starts.length - 1] + 8;
        let current = 0;
        starts.forEach((start, index) => {
          const stop = starts[index + 1] ?? end;
          if (time >= start) current = index;
          const bar = bars.current[index];
          if (bar) bar.style.transform = `scaleX(${Math.min(1, Math.max(0, (time - start) / (stop - start)))})`;
        });
        setChapter((previous) => (previous === current ? previous : current));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [theme]);

  const seek = (index: number) => {
    const element = video.current;
    if (!element || !theme) return;
    element.currentTime = STARTS[theme][index];
    setPlaying(true);
  };

  return (
    <div className="tour">
      <div className="tour-viewport" ref={frame}>
        <video
          ref={video}
          className="tour-video"
          key={theme}
          src={theme ? `/tour/tour-${theme}.mp4` : undefined}
          poster={theme ? `/tour/tour-${theme}.jpg` : undefined}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="A recording of evelab: creating an agent, dragging a tool, a subagent and a channel onto it, reading the code each one wrote, and exporting the project"
          onLoadedMetadata={(event) => {
            // A theme switch swaps the film; carry on from the same moment.
            if (resumeAt.current) event.currentTarget.currentTime = resumeAt.current;
          }}
          onTimeUpdate={(event) => {
            resumeAt.current = event.currentTarget.currentTime;
          }}
        />

        <button type="button" className="tour-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause the tour" : "Play the tour"}>
          {playing ? (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
              <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
            </svg>
          ) : (
            <Icon icon={IconPlay} size={14} />
          )}
        </button>
      </div>

      {/* The chapters are the tour's table of contents: a progress line, a name and one plain sentence each. */}
      <div className="tour-controls">
        {CHAPTERS.map((label, index) => (
          <button key={label} type="button" className="tour-chapter" data-current={chapter === index || undefined} onClick={() => seek(index)}>
            <span className="tour-chapter-track" aria-hidden="true">
              <span
                className="tour-chapter-fill"
                ref={(element) => {
                  bars.current[index] = element;
                }}
              />
            </span>
            <span className="tour-chapter-title">{label}</span>
            <span className="tour-chapter-note">{CHAPTER_NOTES[index]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
