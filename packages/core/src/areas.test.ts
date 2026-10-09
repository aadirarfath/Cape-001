import { describe, expect, it } from "vitest";
import { KERALA_DISTRICTS, findDistrict, findLegacyKochiArea, findZone } from "./areas";

describe("KERALA_DISTRICTS", () => {
  it("lists all 14 districts once", () => {
    expect(KERALA_DISTRICTS).toHaveLength(14);
    expect(new Set(KERALA_DISTRICTS.map((d) => d.id)).size).toBe(14);
  });

  it("uses URL-safe ids that are unique within each district", () => {
    for (const district of KERALA_DISTRICTS) {
      expect(district.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(district.zones.length).toBeGreaterThan(0);
      const ids = district.zones.map((z) => z.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("places every zone inside Kerala", () => {
    for (const district of KERALA_DISTRICTS) {
      for (const zone of district.zones) {
        expect(zone.lat, `${district.id}/${zone.id}`).toBeGreaterThan(8.1);
        expect(zone.lat, `${district.id}/${zone.id}`).toBeLessThan(12.9);
        expect(zone.lng, `${district.id}/${zone.id}`).toBeGreaterThan(74.8);
        expect(zone.lng, `${district.id}/${zone.id}`).toBeLessThan(77.5);
      }
    }
  });
});

describe("findZone", () => {
  it("finds a zone within its district", () => {
    expect(findZone("thrissur", "guruvayur")?.zone.name).toBe("Guruvayur");
    expect(findDistrict("wayanad")?.name).toBe("Wayanad");
  });

  it("rejects unknown ids and zones from another district", () => {
    expect(findZone("thrissur", "kakkanad")).toBeUndefined();
    expect(findZone("nowhere", "kakkanad")).toBeUndefined();
    expect(findZone(undefined, undefined)).toBeUndefined();
  });

  it("keeps the old ?area= Kochi links working", () => {
    for (const id of ["edappally", "kakkanad", "fort-kochi", "kaloor", "vyttila", "aluva"]) {
      expect(findLegacyKochiArea(id)?.district.id).toBe("ernakulam");
    }
  });
});
