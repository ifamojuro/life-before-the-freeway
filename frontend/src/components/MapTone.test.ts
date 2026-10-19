import { describe, expect, it } from "vitest";
import { toneTables } from "./MapTone";

const tone = { ink: "#000000", paper: "#ffffff", black: 0.25, white: 0.75, gamma: 1 };

describe("toneTables", () => {
  it("maps gray at or below the black point to ink and at or above the white point to paper", () => {
    const [r] = toneTables(tone, 5); // gray levels 0, .25, .5, .75, 1
    expect(r).toEqual([0, 0, 0.5, 1, 1]);
  });

  it("interpolates each channel between ink and paper", () => {
    const [r, g, b] = toneTables({ ...tone, ink: "#0d1b2a", paper: "#efede4", black: 0, white: 1 }, 2);
    expect([r[0], g[0], b[0]]).toEqual([0.051, 0.1059, 0.1647]);
    expect([r[1], g[1], b[1]]).toEqual([0.9373, 0.9294, 0.8941]);
  });

  it("applies gamma to mid-tones", () => {
    const [r] = toneTables({ ...tone, black: 0, white: 1, gamma: 2 }, 3);
    expect(r[1]).toBe(0.25);
  });
});
