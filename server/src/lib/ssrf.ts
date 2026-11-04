import dns from 'dns/promises';
import { AppError } from './errors.js';

export function isPrivateIp(ip: string): boolean {
  // IPv4 private/loopback/link-local/metadata
  if (ip === 'localhost' || ip === '::1') return true;

  // IPv4 mapped IPv6
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }

  // IPv6 ULA (fc00::/7) or link-local (fe80::/10)
  const lower = ip.toLowerCase();
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
    return true;
  }

  return false;
}

export async function validateSafeUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('VALIDATION_ERROR', 400, 'Only http and https protocols are permitted');
  }

  const hostname = url.hostname;
  if (!hostname) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid URL hostname');
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          `Access to private/internal network IP (${addr.address}) is forbidden`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('VALIDATION_ERROR', 400, `Failed to resolve hostname: ${hostname}`);
  }

  return url;
}

export async function fetchSafeUrl(initialUrl: string, maxRedirects = 3): Promise<string> {
  let currentUrl = initialUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const validatedUrl = await validateSafeUrl(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let res: Response;
    try {
      res = await fetch(validatedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ReelForgeAI-Bot/1.0 (+https://reelforge.ai)',
          Accept: 'text/html, text/plain',
        },
        redirect: 'manual', // Manual to validate every hop
      });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new AppError('AI_UPSTREAM_ERROR', 502, 'URL fetch timed out after 10 seconds');
      }
      throw new AppError('VALIDATION_ERROR', 400, `Failed to fetch URL: ${err.message}`);
    } finally {
      clearTimeout(timeout);
    }

    // Handle redirects
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) {
        throw new AppError('VALIDATION_ERROR', 400, 'Redirect response missing Location header');
      }
      currentUrl = new URL(location, validatedUrl).toString();
      redirects++;
      continue;
    }

    if (!res.ok) {
      throw new AppError('VALIDATION_ERROR', 400, `Target server returned HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        `Invalid content type (${contentType}). Only HTML and plain text are accepted.`
      );
    }

    // Read with 3 MB response cap
    const MAX_BYTES = 3 * 1024 * 1024;
    const reader = res.body?.getReader();
    if (!reader) {
      return await res.text();
    }

    let receivedLength = 0;
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        receivedLength += value.length;
        if (receivedLength > MAX_BYTES) {
          controller.abort();
          throw new AppError('VALIDATION_ERROR', 400, 'Response size exceeded 3 MB cap');
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks);
    return buffer.toString('utf-8');
  }

  throw new AppError('VALIDATION_ERROR', 400, 'Exceeded maximum redirects limit (3)');
}

