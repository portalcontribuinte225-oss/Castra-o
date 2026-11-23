import { useEffect, useState } from "react";

// Whether the media query matches now; it follows the changes (a window resized, a phone turned on its side).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener("change", update);
    update();
    return () => list.removeEventListener("change", update);
  }, [query]);

  return matches;
}
