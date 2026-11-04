export function buildAnalysisPrompt(opts: {
  target_duration_seconds: number;
  platform: string;
  language: string;
  extra_instructions?: string;
  source_text: string;
}): string {
  return `TASK: Analyze the source content and prepare a plan for a ${opts.target_duration_seconds}-second ${opts.platform} video in ${opts.language}.
Return: a suggested title, a 2-4 sentence summary, 3-12 key points ranked by importance, the detected topic, audience insights, and a recommended beat structure for the video.
Extra instructions from the user (optional, lower priority than the rules): ${opts.extra_instructions || 'None'}

<source_content>
${opts.source_text}
</source_content>`;
}

export function buildScriptPrompt(opts: {
  target_duration_seconds: number;
  min_scenes: number;
  max_scenes: number;
  language: string;
  include_cta: boolean;
  analysis_json: string;
  extra_instructions?: string;
  source_text: string;
}): string {
  return `TASK: Write a complete video script and storyboard.
Target duration: ${opts.target_duration_seconds} seconds (stay within 10 percent). Create between ${opts.min_scenes} and ${opts.max_scenes} scenes of roughly 5-8 seconds each.
Language for narration, on-screen text, caption and hashtags: ${opts.language}.
Include a call to action: ${opts.include_cta ? 'true' : 'false'}.
Approved analysis (use it as the plan): ${opts.analysis_json}
User extra instructions (lower priority than the rules): ${opts.extra_instructions || 'None'}

Requirements:
- Scene 0 is the hook and must grab attention in its first sentence.
- scene_index starts at 0 and increases by 1.
- Provide for every scene: narration, on_screen_text, visual_description, image_prompt, camera_motion, transition, mood, music_cue, duration_seconds.
- Keep character, setting and palette consistent across image prompts by repeating a short style anchor phrase.
- caption_text is a social post caption of at most 2200 characters. hashtags are 5-12 words without the # symbol.

<source_content>
${opts.source_text}
</source_content>`;
}

export function buildSceneRegenPrompt(opts: {
  scene_index: number;
  instruction?: string;
  current_duration: number;
  prev_scene_json?: string;
  current_scene_json: string;
  next_scene_json?: string;
  analysis_summary: string;
}): string {
  return `TASK: Rewrite ONLY scene ${opts.scene_index} of the video, keeping continuity with the neighboring scenes and the same style anchor.
User instruction: ${opts.instruction || 'Improve engagement, visual depth, and natural conversational delivery'}
Keep duration_seconds within 20 percent of ${opts.current_duration}.
Previous scene: ${opts.prev_scene_json || 'None (This is the opening scene)'}
Current scene: ${opts.current_scene_json}
Next scene: ${opts.next_scene_json || 'None (This is the concluding scene)'}
Video plan: ${opts.analysis_summary}`;
}

export function assembleImagePrompt(opts: {
  scene_image_prompt: string;
  visual_style: string;
  aspect_ratio: string;
}): string {
  return `${opts.scene_image_prompt}. Visual style: ${opts.visual_style}. Aspect ratio ${opts.aspect_ratio}. Consistent palette and subject across the series. No text, no captions, no watermark, no logos, no identifiable real people.`;
}

export const toneDirectiveMap: Record<string, string> = {
  informative: 'Say clearly and steadily',
  energetic: 'Say with upbeat energy',
  friendly: 'Say warmly and conversationally',
  professional: 'Say in a confident, professional tone',
  humorous: 'Say playfully with light humor',
  inspirational: 'Say with passion and conviction',
  calm: 'Say slowly and soothingly',
};

// Feature 1: Idea Expansion Prompt
export function buildIdeaExpansionPrompt(opts: {
  idea: string;
  preferred_domain?: string;
  preferred_platform?: string;
}): string {
  return `TASK: Expand this video idea/topic into a complete, high-quality video production blueprint.
USER IDEA / TOPIC: "${opts.idea}"
Preferred domain (optional): ${opts.preferred_domain || 'auto-detect'}
Preferred platform (optional): ${opts.preferred_platform || 'auto-detect'}

INSTRUCTIONS:
1. Identify the core subject, target audience, and best educational/entertaining angle.
2. Select the most appropriate domain ('education','technology','marketing','health','finance','travel','news','agriculture','general').
3. Select the best target platform ('youtube_shorts','tiktok','instagram_reels','linkedin_video') and aspect ratio ('9:16' for vertical short-form, '16:9' for horizontal).
4. Recommend optimal duration (30, 45, 60, or 90 seconds).
5. Generate an expanded_source_text: A thorough, informative, high-value 300 to 800 word briefing explaining the concept clearly with concrete insights, examples, and key facts. This will serve as the grounded foundation for script generation.
6. Return title, tone, audience, visual_style ('cinematic','minimal','3d_render','documentary','vector_art'), and 3-6 key takeaways.`;
}

// Feature 2: Document Topics Extraction Prompt
export function buildDocumentTopicsPrompt(opts: { text: string }): string {
  return `TASK: Analyze this document and extract its main educational concepts, sections, or topics.
Return:
1. document_summary: A 2-3 sentence overview of the entire document.
2. detected_subject: The primary academic or professional discipline.
3. topics: 3 to 8 distinct topics covered in the document. For each topic, provide:
   - id: unique slug (e.g., 'topic-1', 'quantum-entanglement')
   - title: concise descriptive topic name
   - summary: 2-sentence summary of this topic
   - key_concepts: 2-5 core terms or principles explained in this topic.

<document_content>
${opts.text.slice(0, 15000)}
</document_content>`;
}

// Feature 5: Script Translation Prompt
export function buildTranslatePrompt(opts: {
  script_json: string;
  target_language: string;
}): string {
  return `TASK: Translate this video script into ${opts.target_language}.
Translate ALL textual fields: video_title, hook, call_to_action, caption_text, hashtags, and each scene's narration and on_screen_text.
IMPORTANT RULES:
1. Retain the exact same number of scenes and scene_index sequence (0, 1, 2...).
2. Preserve scene durations, camera_motion, transitions, mood, and music_cue.
3. In visual_description and image_prompt, translate any descriptions while maintaining the artistic style.
4. The translated narration must sound completely natural, engaging, and culturally native to ${opts.target_language} speakers, matching the original scene timing and word pace.

<script_to_translate>
${opts.script_json}
</script_to_translate>`;
}

// Feature 7: Quality and Fact-Checking Audit Prompt
export function buildQualityAuditPrompt(opts: {
  source_text: string;
  script_json: string;
}): string {
  return `TASK: Perform a rigorous Fact-Checking and Content Quality Audit on this video script against its source text.

INSPECTION CRITERIA:
1. Factual Grounding: Check every key assertion in the script. Flag whether each claim is 'supported' by the source text or 'unverified_in_source' (never invent external verification).
2. Quality & Hook: Rate quality_score (0-100), hook_score (0-100), and readability_score (0-100).
3. Clarity & Repetition: Identify unclear explanations, missing context, or repetitive phrasing.
4. Actionable Improvements: Provide concrete recommendations (e.g. proposing a punchier hook or clarifying a specific scene).

<source_text>
${opts.source_text}
</source_text>

<script>
${opts.script_json}
</script>`;
}

// Feature 6: Repurposing Prompt
export function buildRepurposePrompt(opts: {
  script_json: string;
  source_text: string;
}): string {
  return `TASK: Repurpose this video content into high-impact cross-platform assets.
GENERATE:
1. shorts_script: An ultra-punchy 15-30 second viral short-form script cut with an immediate hook and concise narration.
2. alternative_hooks: 5 distinct high-converting hooks (styles: Question, Shocking Stat, Contrarian/Mythbuster, How-To, Story-Driven) with rationale.
3. social_posts: 4 platform-optimized social posts for YouTube, Instagram, LinkedIn, and X/Twitter with tailored formatting, emojis, and hashtags.
4. key_point_summary: 4-8 bullet points summarizing the core takeaways.

<source_text>
${opts.source_text}
</source_text>

<script>
${opts.script_json}
</script>`;
}

// Feature 4: Copilot Assistant Prompt
export function buildCopilotPrompt(opts: {
  project_context: string;
  active_script: string;
  user_message: string;
  action_type: string;
  scene_index?: number;
}): string {
  return `TASK: You are the ReelForge AI Video Copilot, an expert creative director and educational video producer.
Help the user refine their video script, scenes, narration, and presentation style.

USER REQUEST: "${opts.user_message}"
ACTION INTENT: ${opts.action_type}
SELECTED SCENE: ${opts.scene_index !== undefined ? `Scene ${opts.scene_index}` : 'Global project / script'}

PROJECT CONTEXT:
${opts.project_context}

ACTIVE SCRIPT:
${opts.active_script}

INSTRUCTIONS:
- Give a helpful, encouraging, direct reply explaining your suggestions.
- If the user asks to modify a scene, hook, or text, provide the concrete replacement in 'action_payload' with 'suggested_action' set to 'update_hook' or 'update_scene'.
- If just answering a question or brainstorming ideas, set 'suggested_action' to 'none'.`;
}


