"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("light");
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      // private browsing — theme just won't persist
    }
    setLight(next);
  }

  return (
    <button
      onClick={toggle}
      className="btn-secondary px-2.5"
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle color theme"
    >
      {mounted ? (light ? "🌙" : "☀️") : "◐"}
    </button>
  );
}
