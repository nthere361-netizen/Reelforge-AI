import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { AppError } from '../lib/errors.js';
import { fetchSafeUrl } from '../lib/ssrf.js';
import { generateStructured } from '../lib/gemini.js';
import { buildIdeaExpansionPrompt, buildDocumentTopicsPrompt } from '../ai/prompts.js';
import {
  ExpandIdeaResponse,
  ExpandIdeaResponseSchema,
  DocumentTopicsResponse,
  DocumentTopicsResponseSchema,
} from '@reelforge/shared';

export class SourceService {
  /**
   * Normalizes text by collapsing whitespace, stripping control characters,
   * enforcing character bounds (200 to 60,000 chars), and counting words.
   */
  static normalizeText(rawText: string): {
    text: string;
    wordCount: number;
    truncated: boolean;
  } {
    if (!rawText || typeof rawText !== 'string') {
      throw new AppError('VALIDATION_ERROR', 400, 'Source text cannot be empty');
    }

    // Strip control characters (except newlines and tabs) and normalize spaces
    let clean = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    let truncated = false;
    const MAX_CHARS = 60000;
    if (clean.length > MAX_CHARS) {
      // Truncate at paragraph boundary
      const sub = clean.slice(0, MAX_CHARS);
      const lastBreak = sub.lastIndexOf('\n\n');
      clean = (lastBreak > 200 ? sub.slice(0, lastBreak) : sub).trim();
      truncated = true;
    }

    if (clean.length < 200) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        `Source text is too short (${clean.length} chars). Minimum 200 characters required.`
      );
    }

    const words = clean.split(/\s+/).filter(Boolean);
    return {
      text: clean,
      wordCount: words.length,
      truncated,
    };
  }

  /**
   * Extracts text from uploaded file buffer (.txt, .md, .docx, .pdf) with signature validation
   */
  static async extractFromUpload(
    buffer: Buffer,
    filename: string,
    mimetype: string
  ): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new AppError('VALIDATION_ERROR', 400, 'Uploaded file is empty');
    }

    if (buffer.length > 5 * 1024 * 1024) {
      throw new AppError('VALIDATION_ERROR', 400, 'File size exceeds maximum 5 MB limit');
    }

    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Verify magic bytes
    if (ext === 'pdf' || mimetype.includes('pdf')) {
      const isPdf =
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46; // %PDF
      if (!isPdf) {
        throw new AppError('VALIDATION_ERROR', 400, 'File header does not match valid PDF signature');
      }
      try {
        const parsed = await pdfParse(buffer);
        return parsed.text;
      } catch (err: any) {
        throw new AppError('VALIDATION_ERROR', 400, `Failed to parse PDF document: ${err.message}`);
      }
    }

    if (ext === 'docx' || mimetype.includes('wordprocessingml')) {
      const isZip =
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04; // PK\x03\x04
      if (!isZip) {
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          'File header does not match valid DOCX/ZIP signature'
        );
      }
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (err: any) {
        throw new AppError('VALIDATION_ERROR', 400, `Failed to parse DOCX document: ${err.message}`);
      }
    }

    if (['txt', 'md', 'markdown'].includes(ext) || mimetype.includes('text/')) {
      return buffer.toString('utf-8');
    }

    throw new AppError(
      'VALIDATION_ERROR',
      400,
      `Unsupported file format (${ext}). Accepted formats: .txt, .md, .docx, .pdf`
    );
  }

  /**
   * Fetches and extracts readable article text from a public web URL with SSRF protection
   */
  static async extractFromUrl(url: string): Promise<string> {
    const html = await fetchSafeUrl(url);

    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 100) {
        return article.textContent;
      }

      // Fallback: extract body text
      const bodyText = dom.window.document.body?.textContent || '';
      if (bodyText.trim().length > 100) {
        return bodyText;
      }

      throw new AppError('VALIDATION_ERROR', 400, 'No readable article text found at URL');
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('VALIDATION_ERROR', 400, `Failed to extract web content: ${err.message}`);
    }
  }

  /**
   * Feature 1: AI Idea-to-Video Generator
   * Expands a short topic, idea, or description into a full educational/entertaining blueprint
   */
  static async expandIdea(opts: {
    idea: string;
    preferredDomain?: string;
    preferredPlatform?: string;
  }): Promise<ExpandIdeaResponse> {
    const prompt = buildIdeaExpansionPrompt({
      idea: opts.idea,
      preferred_domain: opts.preferredDomain,
      preferred_platform: opts.preferredPlatform,
    });

    const systemInstruction = `You are ReelForge AI's Principal Creative Director and Educational Content Strategist. Your mission is to take brief topics or raw ideas and expand them into rich, structured, highly educational video briefs with realistic source content.`;

    return await generateStructured({
      schema: ExpandIdeaResponseSchema,
      systemInstruction,
      prompt,
      temperature: 0.7,
    });
  }

  /**
   * Feature 2: Document-to-Explainer Topic Extraction
   * Analyzes extracted document text and breaks it down into clear sub-topics/sections
   */
  static async extractDocumentTopics(text: string): Promise<DocumentTopicsResponse> {
    const prompt = buildDocumentTopicsPrompt({ text });
    const systemInstruction = `You are ReelForge AI's Academic Document Analyzer. You decompose complex papers, study guides, and articles into clean, digestible educational topics for explainer videos. Never invent topics not present in the document.`;

    return await generateStructured({
      schema: DocumentTopicsResponseSchema,
      systemInstruction,
      prompt,
      temperature: 0.3,
    });
  }
}

