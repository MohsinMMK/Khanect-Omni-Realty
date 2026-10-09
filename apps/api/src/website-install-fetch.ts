import { lookup as dnsLookup } from "node:dns/promises"
import type { LookupAddress } from "node:dns"
import type { LookupFunction } from "node:net"
import ipaddr from "ipaddr.js"
import { Agent, fetch as undiciFetch, type RequestInit } from "undici"

export const MAX_WEBSITE_HTML_BYTES = 2 * 1024 * 1024
export type WebsiteInstallLookup = (hostname: string) => Promise<LookupAddress[]>
export type WebsiteInstallFetcher = (url: string, init: RequestInit) => Promise<{
  ok: boolean
  headers: Pick<Headers, "get">
  body: ReadableStream<Uint8Array> | null
}>

export class WebsiteUrlNotPublicError extends Error {
  constructor() {
    super("Use a public HTTP or HTTPS website on its standard port, without URL credentials.")
  }
}

function isPublicAddress(value: string): boolean {
  try {
    const address = ipaddr.parse(value)
    if (address.range() !== "unicast") return false
    // Only currently allocated global IPv6 unicast space; deny transition addresses.
    return address.kind() === "ipv4" || (address as ipaddr.IPv6).match(ipaddr.IPv6.parse("2000::"), 3)
  } catch {
    return false
  }
}

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let onAbort: () => void = () => undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener("abort", onAbort, { once: true })
  })
  try {
    return await Promise.race([operation, aborted])
  } finally {
    signal.removeEventListener("abort", onAbort)
  }
}

export async function fetchPublicWebsite(url: URL, options: {
  fetcher?: WebsiteInstallFetcher
  lookup?: WebsiteInstallLookup
  signal?: AbortSignal
} = {}): Promise<{ ok: boolean; html: string }> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) {
    throw new WebsiteUrlNotPublicError()
  }
  const signal = options.signal ?? AbortSignal.timeout(10_000)
  signal.throwIfAborted()
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const literal = ipaddr.isValid(hostname)
  if (literal && !isPublicAddress(hostname)) throw new WebsiteUrlNotPublicError()
  const addresses = literal
    ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === "ipv4" ? 4 : 6 }]
    : await abortable((options.lookup ?? ((host) => dnsLookup(host, { all: true, verbatim: true })))(hostname), signal)
  if (addresses.length === 0 || addresses.some(({ address, family }) =>
    ![4, 6].includes(family) || !isPublicAddress(address))) throw new WebsiteUrlNotPublicError()

  // Validate every answer, then pin the socket lookup to this vetted snapshot.
  // A second DNS lookup must never open a rebinding gap. Host and TLS SNI stay intact.
  const pinned = addresses[0]!
  const lookup: LookupFunction = (_host, lookupOptions, callback) => {
    if (lookupOptions.all) callback(null, addresses)
    else callback(null, pinned.address, pinned.family)
  }
  const dispatcher = new Agent({
    connect: { lookup, timeout: 10_000 },
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: 250,
    maxResponseSize: MAX_WEBSITE_HTML_BYTES,
  })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const init: RequestInit = { redirect: "error", signal, dispatcher }
    const response = await abortable((options.fetcher ?? undiciFetch)(url.toString(), init), signal)
    const length = response.headers.get("content-length")
    if (length && Number(length) > MAX_WEBSITE_HTML_BYTES) {
      await response.body?.cancel()
      throw new Error("Website HTML exceeds the verification size limit.")
    }
    reader = response.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await abortable(reader.read(), signal)
      if (done) break
      size += value.byteLength
      // Count decoded bytes too: the transport limit alone misses compressed expansion.
      if (size > MAX_WEBSITE_HTML_BYTES) throw new Error("Website HTML exceeds the verification size limit.")
      chunks.push(value)
    }
    return { ok: response.ok, html: Buffer.concat(chunks, size).toString("utf8") }
  } finally {
    await reader?.cancel().catch(() => undefined)
    await dispatcher.destroy()
  }
}
