import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, PawPrint } from "lucide-react";

// An animal for adoption has up to five photos.
export const MAX_ADOPTION_PHOTOS = 5;

const arrowStyle = [
  "tw:absolute tw:top-1/2 tw:z-10 tw:hidden tw:size-9 tw:-translate-y-1/2 tw:place-items-center tw:rounded-full tw:border-0",
  "tw:bg-white/85 tw:text-ui-ink tw:shadow-sm tw:[@media(hover:hover)]:grid tw:focus-visible:grid tw:hover:bg-white",
  "tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-white tw:disabled:pointer-events-none tw:disabled:opacity-0",
].join(" ");

// The photo the carousel opens on: the one given, kept inside the photos there are.
export function carouselStartIndex(startIndex: number, count: number): number {
  const index = Number.isInteger(startIndex) ? startIndex : 0;
  return Math.min(Math.max(index, 0), Math.max(count - 1, 0));
}

interface AdoptionPhotoThumbProps {
  photo: string;
  fallbackClassName: string;
}

// The photo that was showing, small beside the name while the person fills in the interest form.
export function AdoptionPhotoThumb({ photo, fallbackClassName }: AdoptionPhotoThumbProps) {
  const frame = "tw:size-16 tw:shrink-0 tw:rounded-[var(--ui-radius-md)]";
  if (!photo) {
    return (
      <div className={`${frame} tw:grid tw:place-items-center tw:text-white ${fallbackClassName}`} aria-hidden="true">
        <PawPrint size={24} />
      </div>
    );
  }
  return <img src={photo} alt="" className={`${frame} tw:object-cover`} />;
}

interface AdoptionPhotoCarouselProps {
  photos: string[];
  startIndex: number;
  name: string;
  // The background of an animal without a photo.
  fallbackClassName: string;
  onIndexChange: (index: number) => void;
}

// The photos of an animal, one at a time: swiped on a phone, with arrows on a screen with a mouse, and dots that tell (and pick)
// which one is showing.
export function AdoptionPhotoCarousel({ photos, startIndex, name, fallbackClassName, onIndexChange }: AdoptionPhotoCarouselProps) {
  const shown = photos.slice(0, MAX_ADOPTION_PHOTOS);
  const first = carouselStartIndex(startIndex, shown.length);
  const [index, setIndex] = useState(first);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    // Only where it opens: afterwards the photo follows the person.
    if (track) track.scrollLeft = first * track.clientWidth;
  }, []);

  if (shown.length === 0) {
    return (
      <div className={`tw:grid tw:h-full tw:min-h-0 tw:flex-1 tw:place-items-center tw:text-white ${fallbackClassName}`}>
        <PawPrint size={54} aria-hidden="true" />
      </div>
    );
  }

  function showPhoto(next: number) {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function followScroll() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const next = Math.min(Math.round(track.scrollLeft / track.clientWidth), shown.length - 1);
    if (next === index) return;
    setIndex(next);
    onIndexChange(next);
  }

  function moveWithKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showPhoto(Math.min(Math.max(index + (event.key === "ArrowRight" ? 1 : -1), 0), shown.length - 1));
  }

  const several = shown.length > 1;
  return (
    <div className="tw:relative tw:h-full tw:min-h-0 tw:flex-1">
      <div
        ref={trackRef}
        className="tw:flex tw:h-full tw:snap-x tw:snap-mandatory tw:overflow-x-auto tw:[scrollbar-width:none] tw:[&::-webkit-scrollbar]:hidden tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-white"
        role="group"
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${name}`}
        tabIndex={several ? 0 : -1}
        onScroll={several ? followScroll : undefined}
        onKeyDown={several ? moveWithKeys : undefined}
      >
        {shown.map((photo, photoIndex) => (
          <img
            key={`${photoIndex}-${photo.slice(-24)}`}
            src={photo}
            alt={several ? `${name}, foto ${photoIndex + 1} de ${shown.length}` : name}
            loading={photoIndex === first ? "eager" : "lazy"}
            className="tw:h-full tw:w-full tw:shrink-0 tw:snap-center tw:object-cover"
          />
        ))}
      </div>
      {several && (
        <>
          <button type="button" className={`${arrowStyle} tw:start-2`} aria-label="Foto anterior" disabled={index === 0} onClick={() => showPhoto(index - 1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className={`${arrowStyle} tw:end-2`} aria-label="Próxima foto" disabled={index === shown.length - 1} onClick={() => showPhoto(index + 1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <div className="tw:absolute tw:inset-x-0 tw:bottom-1.5 tw:flex tw:justify-center tw:gap-0.5">
            {shown.map((photo, photoIndex) => (
              <button
                key={`dot-${photoIndex}-${photo.slice(-24)}`}
                type="button"
                className="tw:group tw:grid tw:size-6 tw:place-items-center tw:border-0 tw:bg-transparent tw:p-0"
                aria-label={`Foto ${photoIndex + 1} de ${shown.length}`}
                aria-current={photoIndex === index || undefined}
                onClick={() => showPhoto(photoIndex)}
              >
                <span aria-hidden="true" className="tw:size-2 tw:rounded-full tw:bg-white/55 tw:shadow-sm tw:group-aria-[current=true]:bg-white" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
