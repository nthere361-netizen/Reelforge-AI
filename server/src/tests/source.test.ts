import { describe, it, expect } from 'vitest';
import { isPrivateIp, validateSafeUrl } from '../lib/ssrf.js';
import { SourceService } from '../services/sourceService.js';

describe('SSRF Guard & Source Service', () => {
  it('identifies private, loopback, and metadata IPv4/IPv6 addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.1.5')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('rejects invalid or unsafe protocols in validateSafeUrl', async () => {
    await expect(validateSafeUrl('ftp://example.com')).rejects.toThrow();
    await expect(validateSafeUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(validateSafeUrl('gopher://example.com')).rejects.toThrow();
  });

  it('normalizes source text, collapses whitespace, and calculates word count', () => {
    const raw = '   This is a   multimodal text snippet.   \n\n  It contains information   for testing.   '.repeat(5);
    const normalized = SourceService.normalizeText(raw);
    expect(normalized.text.startsWith('This is a multimodal text snippet.')).toBe(true);
    expect(normalized.wordCount).toBeGreaterThan(30);
    expect(normalized.truncated).toBe(false);
  });

  it('rejects source text under 200 characters', () => {
    expect(() => SourceService.normalizeText('Too short text')).toThrow(
      /Minimum 200 characters required/
    );
  });

  it('rejects files without valid magic bytes', async () => {
    const fakePdf = Buffer.from('NOT_A_REAL_PDF_HEADER');
    await expect(
      SourceService.extractFromUpload(fakePdf, 'doc.pdf', 'application/pdf')
    ).rejects.toThrow(/PDF signature/);

    const fakeDocx = Buffer.from('NOT_A_REAL_DOCX_HEADER');
    await expect(
      SourceService.extractFromUpload(
        fakeDocx,
        'doc.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).rejects.toThrow(/DOCX\/ZIP signature/);
  });
});

