import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { getUser } }) }));

import { createSupabaseVerifier } from "./auth";

describe("createSupabaseVerifier", () => {
  beforeEach(() => getUser.mockReset());

  it("returns the user for a valid token and caches it", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.c" } }, error: null });
    const verify = createSupabaseVerifier("https://x.supabase.co", "key");
    expect(await verify("t")).toEqual({ id: "u1", email: "a@b.c" });
    await verify("t");
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("treats a token Supabase rejects as invalid", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 403, message: "bad_jwt" } });
    expect(await createSupabaseVerifier("https://x.supabase.co", "key")("t")).toBeNull();
  });

  it("throws when Supabase is unreachable, so users aren't told their session expired", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 0, message: "fetch failed" } });
    await expect(createSupabaseVerifier("https://x.supabase.co", "key")("t")).rejects.toMatchObject({ message: "fetch failed" });
  });

  it("throws on Supabase server errors", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503, message: "unavailable" } });
    await expect(createSupabaseVerifier("https://x.supabase.co", "key")("t")).rejects.toBeTruthy();
  });
});
