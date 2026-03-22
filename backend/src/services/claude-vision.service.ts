import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface WakeDetectionResult {
  confidence: number;
  status: 'sleeping' | 'stirring' | 'awake';
  reasoning?: string;
}

/**
 * Analyzes a camera frame (base64 PNG) using Claude Vision to detect if a child is awake.
 * The `media_type` field is required by the Claude API for base64 image sources.
 */
export async function detectWakeFromFrame(
  base64Frame: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
): Promise<WakeDetectionResult> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType, // Required field — was missing, causing the 400 error
              data: base64Frame,
            },
          },
          {
            type: 'text',
            text: 'Is the child in this image awake, stirring, or still sleeping? Reply with JSON: {"status":"sleeping"|"stirring"|"awake","confidence":0.0-1.0,"reasoning":"brief explanation"}',
          },
        ],
      },
    ],
  });

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        confidence: parsed.confidence ?? 0.5,
        status: parsed.status ?? 'sleeping',
        reasoning: parsed.reasoning,
      };
    }
  } catch {
    // Fall through to default
  }

  return { confidence: 0.5, status: 'sleeping' };
}
