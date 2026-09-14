import crypto from "node:crypto";
import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";

export function verifyMetaSignature(
  raw: Buffer,
  header: string | null,
  secret: string,
): boolean {
  if (!secret || !header || !/^sha256=[a-f0-9]{64}$/i.test(header))
    return false;
  return crypto.timingSafeEqual(
    Buffer.from(header.slice(7), "hex"),
    crypto.createHmac("sha256", secret).update(raw).digest(),
  );
}
export function publicIp(ip: string): boolean {
  // IPv6 is deliberately denied until an equally strict range validator is added.
  if (net.isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}
export async function assertSafePublicUrl(input: string): Promise<URL> {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error("Only public HTTPS URLs on port 443 are allowed");
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
    throw new Error("Private or unsupported network destination");
  return url;
}
export async function fetchMedia(
  input: string,
  maxBytes: number,
  allowedHosts: string[],
): Promise<Buffer> {
  return (await fetchMediaAsset(input, maxBytes, allowedHosts)).buffer;
}
export async function fetchMediaAsset(
  input: string,
  maxBytes: number,
  allowedHosts: string[],
): Promise<{ buffer: Buffer; contentType: string }> {
  const url = await assertSafePublicUrl(input);
  if (!allowedHosts.includes(url.hostname))
    throw new Error("Media host has not been approved in META_MEDIA_HOSTS");
  const addresses = await dns.lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
    throw new Error("Unsafe media destination");
  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        family: 4,
        lookup: (_host, _options, callback) => callback(null, address, 4),
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error("Media unavailable, expired, or redirected"));
          return;
        }
        if (
          !/^(video|image)\//.test(String(response.headers["content-type"]))
        ) {
          response.resume();
          reject(new Error("Unsupported media type"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes)
            request.destroy(new Error("Media exceeds size limit"));
          else chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: String(response.headers["content-type"]).split(";")[0],
          }),
        );
        response.on("error", reject);
      },
    );
    const timeout = setTimeout(
      () => request.destroy(new Error("Media download timed out")),
      30000,
    );
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
  });
}
