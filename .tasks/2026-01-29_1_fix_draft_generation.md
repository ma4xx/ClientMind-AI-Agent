# Context

File Name: 2026-01-29_1_fix_draft_generation
Created Date: 2026-01-29
Creator: Trae
Main Branch: main
Task Branch: task/fix-draft-generation_2026-01-29_1
Yolo Mode: Ask

# Task Description

The user reported an error in `Generate Draft` node: "draft generation failed: empty stream response".
This occurs in `src/app/api/draft/generate/route.ts` when calling the Elastic Agent Builder API.
The API returns a 200 OK (presumably) but the streamed content is empty or not parsed correctly.

# Project Overview

- Next.js 16+ project
- Uses Elastic Agent Builder for AI
- n8n workflow triggers this API

# Analysis

- The code uses `fetch` to call `${kibanaUrl}/api/agent_builder/converse/async`.
- It expects an SSE stream.
- The debug output confirmed that the API returns standard SSE with `event:` lines and `data:` lines.
- The original code IGNORED `event:` lines and only looked for `event` field inside the JSON payload.
- The original code also failed to process the last line of the buffer if the stream ended without a newline or if the content was a single huge line.
- The `message` event contains the final response, but because the code didn't capture the `event: message` line, it couldn't match `eventType === 'message'`.

# Proposed Solution

1. Add `currentEvent` state variable to track SSE event type.
2. Update loop to parse `event: ` lines.
3. Use `currentEvent` or `data.event` (fallback) to determine event type.
4. Add logic to process the remaining `buffer` after the stream ends.
5. Add enhanced logging to help with future debugging.

# Current Execution Step: "2. Implement Fix"

- Modified `src/app/api/draft/generate/route.ts` to correctly parse SSE events and handle buffering.

# Task Progress

2026-01-29 03:30:00

- Modified: `src/app/api/draft/generate/route.ts`
- Changes: Improved SSE parsing logic.
- Reason: Fix "empty stream response" error.
- Status: Success

# Final Review

The fix addresses the root cause identified from the debug logs (missing event type handling).
The logging improvements will also help if the issue persists (e.g. if the API returns a different structure).
