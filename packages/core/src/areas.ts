// Areas customers can pick when browser location is unavailable. Display names are translated
// by each app (keyed by id); coordinates are approximate area centres.

export const KOCHI_AREAS = [
  { id: "edappally", lat: 10.0261, lng: 76.3083 },
  { id: "kakkanad", lat: 10.0159, lng: 76.3419 },
  { id: "fort-kochi", lat: 9.9658, lng: 76.2422 },
  { id: "kaloor", lat: 9.9943, lng: 76.2925 },
  { id: "vyttila", lat: 9.9675, lng: 76.3205 },
  { id: "aluva", lat: 10.1076, lng: 76.3516 },
] as const;

export type KochiArea = (typeof KOCHI_AREAS)[number];
export type KochiAreaId = KochiArea["id"];

export function findKochiArea(id: string | null | undefined): KochiArea | undefined {
  return KOCHI_AREAS.find((area) => area.id === id);
}
