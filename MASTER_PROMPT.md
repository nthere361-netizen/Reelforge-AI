# MASTER PROMPT: ReelForge AI, Multimodal Text-to-Video Content Studio
By the Assignment Team.

## 1. Header & System Persona Role
You are a Principal Full-Stack Engineer, AI Systems Architect and Security-Minded Product Engineer with 15+ years of experience shipping production SaaS on React, Node.js, PostgreSQL and generative AI APIs. You write strict, typed, well-structured, secure and fully working code. You never leave TODO, ..., pseudo-code, mock data in production paths or placeholder functions. Every file you create is complete and runnable.

## 2. Core Mission Directive
Build, end to end and without skipping steps, a production-grade web application called ReelForge AI: an AI-powered assistant that converts single-modal text knowledge (blogs, articles, documents, notes) into a complete multimodal short-video package: script, voiceover audio, visual scene storyboard with generated images, captions and a synchronized in-browser preview player, all inside one unified workflow.
Rules of engagement:
• Deliver the full repository: frontend, backend, SQL migrations, config, README.
• Work phase by phase (Section 21). Finish and self-verify each phase before starting the next.
• Every AI call happens only on the server. The Gemini API key must never reach the browser.
• Every AI response is validated with Zod before it is stored or returned. Invalid output triggers one automatic repair retry, then a clean error.
• Do not invent features beyond this document. Do not omit any feature in it.

## 3. Product Goal
Problem: Audiences consume information mostly as video and audio, yet a large amount of valuable knowledge is trapped in text. Creators, marketers and educators must jump between separate tools to write scripts, record voiceovers and brainstorm visuals. This friction limits productivity.
Goal: Let a user paste or upload text once and, within minutes, receive an editable, exportable, multimodal video package. The user should never leave the app to write a script, produce a voiceover or plan visuals.
Primary personas: (1) Content creator repurposing blogs into Reels/Shorts. (2) Marketer turning product articles into promo videos. (3) Educator turning lecture notes into explainer videos.
Success metrics: Source text to full package in under 3 minutes; every scene has narration, on-screen text, visual description and an image; audio duration matches the script within 10 percent; zero secrets exposed to the client.

## 4. Mandatory Features
All of the following are required:
1. Email/password authentication with Supabase Auth (sign up, login, logout, password reset, protected routes).
2. Source ingestion through three methods: paste text, upload .txt/.md/.docx/.pdf (server-side text extraction), or paste a public URL (server-side fetch and readable-text extraction with SSRF protection).
3. Content Analysis (AI): summary, key points, detected topic, audience insights, and a recommended video structure.
4. Video Configuration form (Section 9): domain, platform, duration, tone, language, audience, voice, visual style.
5. Script Generation (AI): hook, scene-by-scene script, call to action, hashtags and caption text, produced as strict structured JSON.
6. Scene Visual Brainstorming (AI): per scene visual description, image prompt, camera motion, transition, mood and music cue.
7. Voiceover Generation (AI TTS): per scene and full-track audio using Gemini speech generation, stored in Supabase Storage and playable in the app.
8. Storyboard Image Generation (AI): one image per scene using Gemini image generation, with per-scene regenerate.
9. Scene Editor: edit narration, on-screen text, visual description and image prompt for each scene; reorder, add, delete scenes; regenerate a single scene with AI; version history of scripts.
10. Synchronized Preview Player: plays scene images with Ken Burns motion, voiceover audio and burned-in caption text in sync, entirely in the browser.
11. Export: script JSON, SRT and VTT captions, full voiceover WAV, per-scene images ZIP, and a printable storyboard PDF.
12. Project Dashboard: list, search, filter by status/domain, duplicate and delete projects.
13. Data isolation: each user can only see their own data (Section 11).
14. Rate limiting, input validation, safe error handling and structured logging (Section 18).
15. Responsive, accessible UI with loading, empty and error states on every screen.

## 5. Technology Requirements
Layer:
- Frontend: React.js 18+ (Vite, TypeScript), React Router v6, TanStack Query, React Hook Form + Zod resolver, Tailwind CSS
- Backend: Node.js 20+ with Express.js (TypeScript), modular routers, centralized error middleware
- Database and Auth: Supabase PostgreSQL, Supabase Auth, Supabase Storage
- AI: @google/genai SDK (server only) for text, structured JSON, text-to-speech and image generation
- Validation: Zod on every request body, query, AI output and environment config
- Extras: helmet, cors, express-rate-limit, pino, multer, mammoth (docx), pdf-parse (pdf), @mozilla/readability + jsdom (URL extraction), archiver (ZIP), pdfkit (storyboard PDF), zod-to-json-schema or Zod 4 z.toJSONSchema
- Tooling: ESLint, Prettier, Vitest, Supertest, dotenv, tsx for dev
Model names must come from environment variables (Section 19), never hard-coded: text model default gemini-2.5-flash, speech model default gemini-2.5-flash-preview-tts, image model default gemini-2.5-flash-image.

## 6. Application Pages (Routes)
- / : Public Landing page: value proposition, how it works, CTA
- /login : Public Email/password login
- /signup : Public Registration with full name and role
- /forgot-password : Public Request reset email
- /reset-password : Public Set new password from email link
- /dashboard : Auth Project list, search, filters, stats
- /projects/new : Auth Step 1 and 2: source input and video configuration
- /projects/:id : Auth Project hub: status pipeline, analysis, script overview
- /projects/:id/editor : Auth Scene editor with AI regenerate and version history
- /projects/:id/media : Auth Voiceover and storyboard image generation and review
- /projects/:id/preview : Auth Synchronized preview player
- /projects/:id/export : Auth Export center
- /settings : Auth Profile, default domain, default language, default voice
- * : Public 404 page

## 7. User Flow
1. User signs up or logs in and lands on /dashboard.
2. Clicks New Project. On /projects/new they provide source content (paste, upload or URL). The server extracts and normalizes the text and shows word count and a preview.
3. User fills the Video Configuration form (Section 9) and submits.
4. Analyze: server runs the Content Analysis prompt. UI shows summary, key points and recommended structure. User may edit the title and confirm.
5. Script: server runs the Script Generation prompt (structured JSON, Zod validated). Scenes are saved. User is taken to /projects/:id/editor.
6. Edit: user edits any scene text, reorders scenes, or regenerates a scene or the whole script with extra instructions. Each full regeneration creates a new script version.
7. Media: on /projects/:id/media the user generates voiceover (per scene or all) and storyboard images (per scene or all). Progress is shown per scene. Failed scenes can be retried individually.
8. Preview: user plays the synchronized preview with captions.
9. Export: user downloads JSON, SRT, VTT, WAV, images ZIP and storyboard PDF.
10. Project status moves through: draft, analyzing, scripted, media_generating, ready, failed.

## 8. Target Domains & Categorization
Domain keys: agriculture, education, marketing, technology, health, finance, travel, news, general.

## 9. Form & Advisory Configuration
Zod schema fields: title, domain, target_platform, aspect_ratio, target_duration_seconds, tone, language, audience, voice_name, visual_style, include_cta, extra_instructions.

## 10. Database Schema (Production SQL for PostgreSQL)
supabase/migrations/0001_init.sql

## 11. Row Level Security (RLS) / Data Isolation Rules
supabase/migrations/0002_rls.sql

## 12. Backend API Routes
Base path /api/v1. Envelope { data, error }.

## 13. Gemini SDK Setup & Server-Side Security
@google/genai SDK on server only.

## 14. AI System Prompt
System instruction with non-negotiable rules.

## 15. Detailed AI Prompts (with required JSON Schemas)
15.1 Content Analysis (AnalysisOutputSchema)
15.2 Script and Scene Generation (SceneOutputSchema, ScriptOutputSchema)
15.3 Single Scene Regeneration
15.4 Image Prompt Assembly
15.5 Voiceover Directive (TTS)

## 16. Zod Validation Requirements
shared package, request and AI output validations.

## 17. Frontend Components List
Full component hierarchy and accessibility.

## 18. Security Requirements
Secrets, Auth, CSP, CORS, Rate limiting, SSRF guard, Upload safety, etc.

## 19. Environment Variables Template
server/.env.example and client/.env.example

## 20. Suggested Folder Structure
reelforge-ai/ with shared, server, client, supabase.

## 21. Implementation Phases
Phases 1 through 8.

## 22. Acceptance Criteria
16 criteria items.

## 23. Final Instruction to Coding Agent
Start now with Phase 1 and proceed through Phase 8 without stopping to ask questions.

## Appendix A. Voiceover (TTS) Execution Spec
## Appendix B. Storyboard Image Execution Spec
## Appendix C. Synchronized Preview Player Spec
## Appendix D. Export Execution Spec
## Appendix E. AI Output Repair Logic
## Appendix F. Automated Testing Specs
## Appendix G. Per-Phase Self-Verification Gates

