import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeEntry, toLocalDateString } from "./gemini";

const geminiReply = (json: object) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }));

afterEach(() => vi.restoreAllMocks());

describe("toLocalDateString", () => {
  it("names the local calendar day, not the UTC one", () => {
    expect(toLocalDateString(new Date(2026, 8, 23))).toBe("2026-09-23");
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

describe("analyzeEntry", () => {
  it("sends the key in a header, never in the URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ categories: ["joy"], intensity: 0.6, temporalScope: "point" }),
    );
    await analyzeEntry("a good day", new Date(2026, 8, 1).toISOString(), "test-key");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("test-key");
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
  });

  it("tells Gemini the anchor as the local day it was placed on", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ categories: ["joy"], intensity: 0.6, temporalScope: "point" }),
    );
    await analyzeEntry("a good day", new Date(2026, 7, 25).toISOString(), "k");

    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).toContain("Anchor date: 2026-08-25.");
  });

  it("reads Gemini's end date as local midnight of that day", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ categories: ["hope"], intensity: 0.5, temporalScope: "forward", endDate: "2026-10-03" }),
    );
    const result = await analyzeEntry("until the results", new Date(2026, 8, 15).toISOString(), "k");

    const end = new Date(result!.endDate!);
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 9, 3, 0]);
  });
});
