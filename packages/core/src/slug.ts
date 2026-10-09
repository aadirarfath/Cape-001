// Shop slugs (the /shops/<slug> part of the website URL). Owners never type one: the partner
// app derives it from the shop name and area, and adds a suffix if it is taken.

/** "Fade Theory, Edappally!" -> "fade-theory-edappally". Always matches shopSlugSchema. */
export function slugify(...parts: (string | null | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents split off by NFKD: "caf\u00e9" -> "cafe"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  // Names in Malayalam script (or very short names) leave too little to use.
  return slug.length >= 3 ? slug : `shop${slug ? `-${slug}` : ""}`.slice(0, 50);
}

/** slugify plus a short random suffix, for retrying after SLUG_TAKEN. */
export function slugWithSuffix(base: string, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `${base.slice(0, 55).replace(/-+$/, "")}-${suffix}`;
}
