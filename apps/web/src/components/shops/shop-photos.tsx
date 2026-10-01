import { Scissors } from "lucide-react";

type Photo = { id: string; url: string; alt_text: string | null };

/**
 * Swipeable photo strip, or a placeholder until the shop uploads photos (via the partner app).
 * Plain <img>: photos are served directly by Supabase Storage's public bucket.
 */
export function ShopPhotos({
  name,
  photos,
  photoAlt,
  placeholderAlt,
}: {
  name: string;
  photos: Photo[];
  photoAlt: string;
  placeholderAlt: string;
}) {
  if (photos.length === 0) {
    return (
      <div
        role="img"
        aria-label={placeholderAlt}
        className="-mx-4 flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-muted to-secondary sm:mx-0 sm:rounded-xl"
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Scissors className="size-10" aria-hidden />
          <span className="text-4xl font-bold tracking-tight" aria-hidden>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {photos.map((photo, index) => (
        <li key={photo.id} className="w-[85%] shrink-0 snap-center sm:w-[70%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.alt_text ?? photoAlt}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            className="aspect-[4/3] w-full rounded-xl bg-muted object-cover"
          />
        </li>
      ))}
    </ul>
  );
}
