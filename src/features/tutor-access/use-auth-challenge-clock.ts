import { useEffect, useState } from "react";
import type { AuthChallenge } from "./auth-types";

export function challengeWindow(challenge: AuthChallenge | null, startedAt: number, now: number) {
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  return { retryIn: challenge ? Math.max(0, challenge.retryAfter - elapsed) : 0, expiresIn: challenge ? Math.max(0, challenge.expiresIn - elapsed) : 0 };
}

export function useAuthChallengeClock(challenge: AuthChallenge | null) {
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(Date.now());
  useEffect(() => { setStartedAt(Date.now()); setNow(Date.now()); }, [challenge?.challengeId]);
  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [challenge?.challengeId]);
  return challengeWindow(challenge, startedAt, now);
}
