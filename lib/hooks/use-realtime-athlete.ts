"use client";

/**
 * Custom hook for subscribing to athlete updates via polling.
 *
 * Polls /api/athlete/{shareCode} at regular intervals to get the latest data.
 * Replaces the previous Supabase Realtime implementation.
 *
 * See: docs/design/US-004-design.md §7
 */

import { useEffect, useRef, useState } from "react";

import type { AthletePublic } from "@/lib/types/athlete-public";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

interface UseRealtimeAthleteOptions {
  shareCode: string;
  initialData: AthletePublic;
  onInjuriesChanged?: () => void;
}

interface UseRealtimeAthleteReturn {
  athlete: AthletePublic;
  connectionStatus: ConnectionStatus;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useRealtimeAthlete({
  shareCode,
  initialData,
  onInjuriesChanged,
}: UseRealtimeAthleteOptions): UseRealtimeAthleteReturn {
  const [athlete, setAthlete] = useState<AthletePublic>(initialData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const onInjuriesChangedRef = useRef(onInjuriesChanged);

  useEffect(() => {
    onInjuriesChangedRef.current = onInjuriesChanged;
  }, [onInjuriesChanged]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetch(`/api/athlete/${shareCode}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then((json: { data?: AthletePublic }) => {
          if (json.data) {
            setAthlete(json.data);
            setConnectionStatus("connected");
            onInjuriesChangedRef.current?.();
          }
        })
        .catch(() => {
          setConnectionStatus("disconnected");
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [shareCode]);

  return { athlete, connectionStatus };
}
