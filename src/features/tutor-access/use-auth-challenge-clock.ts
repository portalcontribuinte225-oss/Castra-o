import { useEffect, useRef, useState } from "react";
import type { AuthChallenge } from "./auth-types";

export function challengeWindow(challenge: AuthChallenge | null, startedAt: number, now: number) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const serverNow = Date.parse(challenge?.serverNow || "");
  function secondsUntil(timestamp: string | undefined, fallback: number) {
    const deadline = Date.parse(timestamp || "");
    const initial = Number.isFinite(serverNow) && Number.isFinite(deadline) ? Math.ceil((deadline - serverNow) / 1000) : fallback;
    return Math.max(0, initial - elapsed);
  }
  return challenge ? { retryIn: secondsUntil(challenge.retryAt, challenge.retryAfter), expiresIn: secondsUntil(challenge.expiresAt, challenge.expiresIn) } : { retryIn: 0, expiresIn: 0 };
}

export function useAuthChallengeClock(challenge: AuthChallenge | null, retryUntil = 0) {
  const anchor = useRef({ id: challenge?.challengeId, startedAt: Date.now() });
  if (anchor.current.id !== challenge?.challengeId) anchor.current = { id: challenge?.challengeId, startedAt: Date.now() };
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!challenge && !retryUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge?.challengeId, retryUntil]);
  const currentTime = Math.max(now, anchor.current.startedAt);
  const window = challengeWindow(challenge, anchor.current.startedAt, currentTime);
  return { ...window, retryIn: Math.max(window.retryIn, Math.ceil((retryUntil - currentTime) / 1000), 0) };
}
