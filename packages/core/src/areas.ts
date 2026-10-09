// Kerala districts and the zones (towns and city neighbourhoods) customers can pick when browser
// location is unavailable, and that partners pick when creating a shop. Searches run by distance
// from the zone centre, so shops just across a district border still show up.
//
// Coordinates are town or neighbourhood centres from OpenStreetMap (Nominatim), checked against
// each district; where OSM only had an administrative boundary, the town centre, bus stand or a
// central landmark was used instead. Names are proper nouns, so they live here, not in i18n.

export type Zone = { readonly id: string; readonly name: string; readonly lat: number; readonly lng: number };
export type District = { readonly id: string; readonly name: string; readonly zones: readonly Zone[] };

export const KERALA_DISTRICTS = [
  {
    id: "thiruvananthapuram",
    name: "Thiruvananthapuram",
    zones: [
      { id: "thampanoor", name: "Thampanoor", lat: 8.4877, lng: 76.9524 },
      { id: "pattom", name: "Pattom", lat: 8.5186, lng: 76.9424 },
      { id: "kowdiar", name: "Kowdiar", lat: 8.5223, lng: 76.9605 },
      { id: "vazhuthacaud", name: "Vazhuthacaud", lat: 8.5017, lng: 76.9596 },
      { id: "kesavadasapuram", name: "Kesavadasapuram", lat: 8.5297, lng: 76.9384 },
      { id: "kazhakkoottam", name: "Kazhakkoottam", lat: 8.5660, lng: 76.8738 },
      { id: "sreekaryam", name: "Sreekaryam", lat: 8.5489, lng: 76.9172 },
      { id: "peroorkada", name: "Peroorkada", lat: 8.5354, lng: 76.9662 },
      { id: "karamana", name: "Karamana", lat: 8.4817, lng: 76.9663 },
      { id: "kovalam", name: "Kovalam", lat: 8.3903, lng: 76.9785 },
      { id: "neyyattinkara", name: "Neyyattinkara", lat: 8.3974, lng: 77.0880 },
      { id: "nedumangad", name: "Nedumangad", lat: 8.6052, lng: 77.0030 },
      { id: "attingal", name: "Attingal", lat: 8.6986, lng: 76.8134 },
      { id: "varkala", name: "Varkala", lat: 8.7340, lng: 76.7253 },
    ],
  },
  {
    id: "kollam",
    name: "Kollam",
    zones: [
      { id: "chinnakada", name: "Chinnakada", lat: 8.8876, lng: 76.5896 },
      { id: "kadappakada", name: "Kadappakada", lat: 8.8919, lng: 76.6021 },
      { id: "kottiyam", name: "Kottiyam", lat: 8.8661, lng: 76.6709 },
      { id: "chathannoor", name: "Chathannoor", lat: 8.8641, lng: 76.7142 },
      { id: "paravur", name: "Paravur", lat: 8.8099, lng: 76.6715 },
      { id: "kundara", name: "Kundara", lat: 8.9606, lng: 76.6802 },
      { id: "chavara", name: "Chavara", lat: 8.9754, lng: 76.5350 },
      { id: "karunagappally", name: "Karunagappally", lat: 9.0518, lng: 76.5361 },
      { id: "sasthamcotta", name: "Sasthamcotta", lat: 9.0440, lng: 76.6258 },
      { id: "kottarakkara", name: "Kottarakkara", lat: 9.0055, lng: 76.7832 },
      { id: "punalur", name: "Punalur", lat: 9.0175, lng: 76.9265 },
      { id: "anchal", name: "Anchal", lat: 8.9293, lng: 76.9065 },
    ],
  },
  {
    id: "pathanamthitta",
    name: "Pathanamthitta",
    zones: [
      { id: "pathanamthitta", name: "Pathanamthitta", lat: 9.2655, lng: 76.7872 },
      { id: "thiruvalla", name: "Thiruvalla", lat: 9.3867, lng: 76.5763 },
      { id: "adoor", name: "Adoor", lat: 9.1530, lng: 76.7356 },
      { id: "pandalam", name: "Pandalam", lat: 9.2251, lng: 76.6781 },
      { id: "kozhencherry", name: "Kozhencherry", lat: 9.3396, lng: 76.7106 },
      { id: "ranni", name: "Ranni", lat: 9.3851, lng: 76.7789 },
      { id: "konni", name: "Konni", lat: 9.2267, lng: 76.8499 },
      { id: "mallappally", name: "Mallappally", lat: 9.4460, lng: 76.6553 },
    ],
  },
  {
    id: "alappuzha",
    name: "Alappuzha",
    zones: [
      { id: "alappuzha", name: "Alappuzha", lat: 9.4923, lng: 76.3291 },
      { id: "aroor", name: "Aroor", lat: 9.8783, lng: 76.3039 },
      { id: "cherthala", name: "Cherthala", lat: 9.6862, lng: 76.3426 },
      { id: "ambalappuzha", name: "Ambalappuzha", lat: 9.3833, lng: 76.3678 },
      { id: "haripad", name: "Haripad", lat: 9.2845, lng: 76.4563 },
      { id: "kayamkulam", name: "Kayamkulam", lat: 9.1724, lng: 76.5001 },
      { id: "mavelikkara", name: "Mavelikkara", lat: 9.2505, lng: 76.5402 },
      { id: "chengannur", name: "Chengannur", lat: 9.3179, lng: 76.6139 },
    ],
  },
  {
    id: "kottayam",
    name: "Kottayam",
    zones: [
      { id: "kottayam", name: "Kottayam", lat: 9.5916, lng: 76.5222 },
      { id: "nagampadam", name: "Nagampadam", lat: 9.5973, lng: 76.5274 },
      { id: "ettumanoor", name: "Ettumanoor", lat: 9.6705, lng: 76.5578 },
      { id: "kumarakom", name: "Kumarakom", lat: 9.5961, lng: 76.4305 },
      { id: "changanassery", name: "Changanassery", lat: 9.4465, lng: 76.5403 },
      { id: "pala", name: "Pala", lat: 9.7131, lng: 76.6831 },
      { id: "erattupetta", name: "Erattupetta", lat: 9.6880, lng: 76.7798 },
      { id: "kanjirappally", name: "Kanjirappally", lat: 9.5583, lng: 76.7914 },
      { id: "vaikom", name: "Vaikom", lat: 9.7498, lng: 76.3926 },
    ],
  },
  {
    id: "idukki",
    name: "Idukki",
    zones: [
      { id: "thodupuzha", name: "Thodupuzha", lat: 9.8977, lng: 76.7134 },
      { id: "painavu", name: "Painavu", lat: 9.8540, lng: 76.9446 },
      { id: "adimali", name: "Adimali", lat: 10.0144, lng: 76.9555 },
      { id: "munnar", name: "Munnar", lat: 10.0870, lng: 77.0601 },
      { id: "nedumkandam", name: "Nedumkandam", lat: 9.8404, lng: 77.1543 },
      { id: "kattappana", name: "Kattappana", lat: 9.7562, lng: 77.1141 },
      { id: "kumily", name: "Kumily", lat: 9.6068, lng: 77.1671 },
      { id: "vandiperiyar", name: "Vandiperiyar", lat: 9.5729, lng: 77.0919 },
    ],
  },
  {
    id: "ernakulam",
    name: "Ernakulam",
    zones: [
      { id: "ernakulam-south", name: "Ernakulam South", lat: 9.9647, lng: 76.2875 },
      { id: "kadavanthra", name: "Kadavanthra", lat: 9.9568, lng: 76.3021 },
      { id: "kaloor", name: "Kaloor", lat: 9.9951, lng: 76.2920 },
      { id: "palarivattom", name: "Palarivattom", lat: 10.0025, lng: 76.3062 },
      { id: "edappally", name: "Edappally", lat: 10.0252, lng: 76.3114 },
      { id: "vyttila", name: "Vyttila", lat: 9.9673, lng: 76.3175 },
      { id: "kakkanad", name: "Kakkanad", lat: 10.0166, lng: 76.3427 },
      { id: "fort-kochi", name: "Fort Kochi", lat: 9.9676, lng: 76.2422 },
      { id: "tripunithura", name: "Tripunithura", lat: 9.9440, lng: 76.3490 },
      { id: "kalamassery", name: "Kalamassery", lat: 10.0522, lng: 76.3199 },
      { id: "aluva", name: "Aluva", lat: 10.1078, lng: 76.3569 },
      { id: "angamaly", name: "Angamaly", lat: 10.1910, lng: 76.3874 },
      { id: "perumbavoor", name: "Perumbavoor", lat: 10.1148, lng: 76.4778 },
      { id: "north-paravur", name: "North Paravur", lat: 10.1484, lng: 76.2249 },
      { id: "muvattupuzha", name: "Muvattupuzha", lat: 9.9831, lng: 76.5782 },
      { id: "kothamangalam", name: "Kothamangalam", lat: 10.0640, lng: 76.6218 },
    ],
  },
  {
    id: "thrissur",
    name: "Thrissur",
    zones: [
      { id: "thrissur", name: "Thrissur", lat: 10.5272, lng: 76.2161 },
      { id: "ayyanthole", name: "Ayyanthole", lat: 10.5330, lng: 76.1886 },
      { id: "punkunnam", name: "Punkunnam", lat: 10.5344, lng: 76.2005 },
      { id: "ollur", name: "Ollur", lat: 10.4747, lng: 76.2403 },
      { id: "guruvayur", name: "Guruvayur", lat: 10.5950, lng: 76.0418 },
      { id: "chavakkad", name: "Chavakkad", lat: 10.5810, lng: 76.0233 },
      { id: "kunnamkulam", name: "Kunnamkulam", lat: 10.6508, lng: 76.0694 },
      { id: "wadakkanchery", name: "Wadakkanchery", lat: 10.6514, lng: 76.2396 },
      { id: "irinjalakuda", name: "Irinjalakuda", lat: 10.3454, lng: 76.2158 },
      { id: "chalakudy", name: "Chalakudy", lat: 10.3042, lng: 76.3371 },
      { id: "kodungallur", name: "Kodungallur", lat: 10.2277, lng: 76.1972 },
    ],
  },
  {
    id: "palakkad",
    name: "Palakkad",
    zones: [
      { id: "palakkad", name: "Palakkad", lat: 10.7682, lng: 76.6521 },
      { id: "olavakkode", name: "Olavakkode", lat: 10.7973, lng: 76.6390 },
      { id: "kanjikode", name: "Kanjikode", lat: 10.7983, lng: 76.7501 },
      { id: "chittur", name: "Chittur", lat: 10.7019, lng: 76.7372 },
      { id: "alathur", name: "Alathur", lat: 10.6459, lng: 76.5436 },
      { id: "ottapalam", name: "Ottapalam", lat: 10.7732, lng: 76.3772 },
      { id: "shoranur", name: "Shoranur", lat: 10.7637, lng: 76.2724 },
      { id: "pattambi", name: "Pattambi", lat: 10.8049, lng: 76.1780 },
      { id: "cherpulassery", name: "Cherpulassery", lat: 10.8775, lng: 76.3139 },
      { id: "mannarkkad", name: "Mannarkkad", lat: 10.9929, lng: 76.4569 },
    ],
  },
  {
    id: "malappuram",
    name: "Malappuram",
    zones: [
      { id: "malappuram", name: "Malappuram", lat: 11.0429, lng: 76.0808 },
      { id: "manjeri", name: "Manjeri", lat: 11.1202, lng: 76.1198 },
      { id: "kondotty", name: "Kondotty", lat: 11.1457, lng: 75.9644 },
      { id: "kottakkal", name: "Kottakkal", lat: 11.0005, lng: 76.0048 },
      { id: "tirur", name: "Tirur", lat: 10.9167, lng: 75.9240 },
      { id: "tirurangadi", name: "Tirurangadi", lat: 11.0422, lng: 75.9279 },
      { id: "valanchery", name: "Valanchery", lat: 10.8878, lng: 76.0732 },
      { id: "ponnani", name: "Ponnani", lat: 10.7801, lng: 75.9189 },
      { id: "perinthalmanna", name: "Perinthalmanna", lat: 10.9757, lng: 76.2263 },
      { id: "nilambur", name: "Nilambur", lat: 11.2865, lng: 76.2407 },
    ],
  },
  {
    id: "kozhikode",
    name: "Kozhikode",
    zones: [
      { id: "mananchira", name: "Mananchira", lat: 11.2543, lng: 75.7815 },
      { id: "nadakkavu", name: "Nadakkavu", lat: 11.2711, lng: 75.7763 },
      { id: "west-hill", name: "West Hill", lat: 11.2851, lng: 75.7676 },
      { id: "medical-college", name: "Medical College", lat: 11.2769, lng: 75.8358 },
      { id: "feroke", name: "Feroke", lat: 11.1825, lng: 75.8375 },
      { id: "ramanattukara", name: "Ramanattukara", lat: 11.1781, lng: 75.8656 },
      { id: "kunnamangalam", name: "Kunnamangalam", lat: 11.3047, lng: 75.8786 },
      { id: "mukkam", name: "Mukkam", lat: 11.3225, lng: 75.9949 },
      { id: "thamarassery", name: "Thamarassery", lat: 11.4178, lng: 75.9369 },
      { id: "koyilandy", name: "Koyilandy", lat: 11.4384, lng: 75.6969 },
      { id: "vadakara", name: "Vadakara", lat: 11.5985, lng: 75.5897 },
    ],
  },
  {
    id: "wayanad",
    name: "Wayanad",
    zones: [
      { id: "kalpetta", name: "Kalpetta", lat: 11.6103, lng: 76.0828 },
      { id: "vythiri", name: "Vythiri", lat: 11.5561, lng: 76.0389 },
      { id: "meppadi", name: "Meppadi", lat: 11.5529, lng: 76.1320 },
      { id: "sulthan-bathery", name: "Sulthan Bathery", lat: 11.6632, lng: 76.2596 },
      { id: "mananthavady", name: "Mananthavady", lat: 11.8010, lng: 76.0057 },
      { id: "panamaram", name: "Panamaram", lat: 11.7391, lng: 76.0731 },
      { id: "pulpally", name: "Pulpally", lat: 11.7933, lng: 76.1644 },
    ],
  },
  {
    id: "kannur",
    name: "Kannur",
    zones: [
      { id: "kannur", name: "Kannur", lat: 11.8764, lng: 75.3738 },
      { id: "thalassery", name: "Thalassery", lat: 11.7491, lng: 75.4932 },
      { id: "kuthuparamba", name: "Kuthuparamba", lat: 11.8298, lng: 75.5653 },
      { id: "panoor", name: "Panoor", lat: 11.7598, lng: 75.5778 },
      { id: "mattannur", name: "Mattannur", lat: 11.9308, lng: 75.5713 },
      { id: "iritty", name: "Iritty", lat: 11.9878, lng: 75.6769 },
      { id: "taliparamba", name: "Taliparamba", lat: 12.0374, lng: 75.3603 },
      { id: "payyanur", name: "Payyanur", lat: 12.1060, lng: 75.2073 },
    ],
  },
  {
    id: "kasaragod",
    name: "Kasaragod",
    zones: [
      { id: "kasaragod", name: "Kasaragod", lat: 12.5036, lng: 74.9907 },
      { id: "uppala", name: "Uppala", lat: 12.6852, lng: 74.9056 },
      { id: "manjeshwar", name: "Manjeshwar", lat: 12.7194, lng: 74.8861 },
      { id: "kanhangad", name: "Kanhangad", lat: 12.3136, lng: 75.0925 },
      { id: "nileshwaram", name: "Nileshwaram", lat: 12.2508, lng: 75.1282 },
      { id: "cheruvathur", name: "Cheruvathur", lat: 12.2164, lng: 75.1615 },
      { id: "trikaripur", name: "Trikaripur", lat: 12.1438, lng: 75.1774 },
    ],
  },
] as const satisfies readonly District[];

export type DistrictId = (typeof KERALA_DISTRICTS)[number]["id"];

export function findDistrict(id: string | null | undefined): District | undefined {
  return KERALA_DISTRICTS.find((district) => district.id === id);
}

export function findZone(
  districtId: string | null | undefined,
  zoneId: string | null | undefined,
): { district: District; zone: Zone } | undefined {
  const district = findDistrict(districtId);
  const zone = district?.zones.find((z) => z.id === zoneId);
  return district && zone ? { district, zone } : undefined;
}

/** Links from before districts existed used `?area=<id>` for Kochi (Ernakulam) neighbourhoods. */
export function findLegacyKochiArea(areaId: string | null | undefined) {
  return findZone("ernakulam", areaId);
}
