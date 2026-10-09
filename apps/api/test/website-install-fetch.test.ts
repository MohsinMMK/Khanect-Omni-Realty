import type { LookupFunction } from "node:net"
import { describe, expect, it, vi } from "vitest"
import { fetchPublicWebsite, MAX_WEBSITE_HTML_BYTES, WebsiteUrlNotPublicError, type WebsiteInstallFetcher } from "../src/website-install-fetch.js"

const transport = vi.hoisted(() => ({ lookup: undefined as LookupFunction | undefined, last: undefined as import("undici").Agent | undefined }))
vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>()
  return {
    ...actual,
    Agent: class extends actual.Agent {
      constructor(options: import("undici").Agent.Options) {
        super(options)
        transport.lookup = typeof options.connect === "object" && "lookup" in options.connect ? options.connect.lookup : undefined
        transport.last = this
      }
    },
  }
})

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }]

describe("Public website installation fetch", () => {
  it.each([
    "http://127.0.0.1", "http://127.1", "http://2130706433", "http://0x7f000001",
    "http://0.0.0.0", "http://10.0.0.1", "http://172.16.0.1", "http://192.168.1.1",
    "http://169.254.169.254", "http://100.64.0.1", "http://192.0.2.1", "http://224.0.0.1",
    "http://[::1]", "http://[::]", "http://[fd00::1]", "http://[fe80::1]",
    "http://[::ffff:127.0.0.1]", "http://[64:ff9b::a00:1]", "http://[2002:a00:1::]",
    "http://[2001:db8::1]", "https://user:password@install.example", "https://install.example:8443",
    "ftp://install.example",
  ])("blocks unsafe URL %s before DNS or transport", async (target) => {
    const lookup = vi.fn(publicLookup)
    const fetcher = vi.fn<WebsiteInstallFetcher>()
    await expect(fetchPublicWebsite(new URL(target), { lookup, fetcher })).rejects.toBeInstanceOf(WebsiteUrlNotPublicError)
    expect(lookup).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    [], [{ address: "127.0.0.1", family: 4 }],
    [{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }],
    [{ address: "2606:4700:4700::1111", family: 6 }, { address: "fd00::1", family: 6 }],
  ])("blocks empty/private/mixed DNS answers %j", async (...addresses) => {
    const fetcher = vi.fn<WebsiteInstallFetcher>()
    await expect(fetchPublicWebsite(new URL("https://install.example"), {
      lookup: async () => addresses, fetcher,
    })).rejects.toBeInstanceOf(WebsiteUrlNotPublicError)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    { address: "93.184.216.34", family: 4 },
    { address: "2606:4700:4700::1111", family: 6 },
  ])("pins a public DNS answer through socket lookup and preserves the URL: %j", async (address) => {
    const lookup = vi.fn().mockResolvedValueOnce([address]).mockResolvedValue([{ address: "127.0.0.1", family: 4 }])
    const fetcher = vi.fn<WebsiteInstallFetcher>(async (target, init) => {
      expect(target).toBe("https://install.example/path?value=1")
      expect(init).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) })
      expect(init).toHaveProperty("dispatcher")
      const single = vi.fn()
      transport.lookup!("install.example", {}, single)
      expect(single).toHaveBeenCalledWith(null, address.address, address.family)
      const all = vi.fn()
      transport.lookup!("install.example", { all: true }, all)
      expect(all).toHaveBeenCalledWith(null, [address])
      return new Response("<html>widget snippet</html>")
    })
    await expect(fetchPublicWebsite(new URL("https://install.example/path?value=1"), { lookup, fetcher }))
      .resolves.toEqual({ ok: true, html: "<html>widget snippet</html>" })
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it("bounds streamed decoded bytes, cancels the body, and closes the dispatcher", async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn<WebsiteInstallFetcher>(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_WEBSITE_HTML_BYTES))
        controller.enqueue(new Uint8Array(1))
      }, cancel,
    }), { headers: { "content-encoding": "gzip" } }))
    await expect(fetchPublicWebsite(new URL("https://install.example"), { lookup: publicLookup, fetcher }))
      .rejects.toThrow("size limit")
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(transport.last?.destroyed).toBe(true)
  })

  it("preserves all vetted IPv4/IPv6 answers for connection fallback without resolving again", async () => {
    const addresses = [
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "93.184.216.34", family: 4 },
    ]
    const lookup = vi.fn().mockResolvedValueOnce(addresses).mockResolvedValue([{ address: "10.0.0.1", family: 4 }])
    const fetcher: WebsiteInstallFetcher = async () => {
      const callback = vi.fn()
      transport.lookup!("install.example", { all: true }, callback)
      expect(callback).toHaveBeenCalledWith(null, addresses)
      return new Response("ok")
    }
    await expect(fetchPublicWebsite(new URL("https://install.example"), { lookup, fetcher })).resolves.toMatchObject({ html: "ok" })
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it("rejects an oversized content length before consuming the body", async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn<WebsiteInstallFetcher>(async () => new Response(new ReadableStream({ cancel }), {
      headers: { "content-length": String(MAX_WEBSITE_HTML_BYTES + 1) },
    }))
    await expect(fetchPublicWebsite(new URL("https://install.example"), { lookup: publicLookup, fetcher }))
      .rejects.toThrow("size limit")
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each(["dns", "body"])("the shared deadline stops stalled %s", async (stage) => {
    const controller = new AbortController()
    const cancel = vi.fn()
    const pending = fetchPublicWebsite(new URL("https://install.example"), {
      signal: controller.signal,
      lookup: stage === "dns" ? () => new Promise(() => undefined) : publicLookup,
      fetcher: async () => new Response(new ReadableStream({ cancel })),
    })
    const assertion = expect(pending).rejects.toThrow("deadline")
    await new Promise((resolve) => setImmediate(resolve))
    controller.abort(new Error("deadline"))
    await assertion
    if (stage === "body") expect(cancel).toHaveBeenCalledTimes(1)
  })
})
