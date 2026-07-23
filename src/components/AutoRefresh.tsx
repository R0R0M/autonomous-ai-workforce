"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently re-fetches server component data on an interval. */
export default function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
