// analyze-meal — photo/voice → macros via Gemini (BUILD_PLAN §6a, §4, D4).
// The Gemini key stays server-side; the client only ever sends an image/audio
// blob and gets structured macros back. Progress photos never come through
// here — this function only ever touches food photos/voice notes.

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const MODEL = 'gemini-3.5-flash-lite'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `You are an expert nutrition estimator for a fitness-tracking app used by \
two people in India, so most meals are Indian home cooking (roti, dal, sabzi, rice, curries, \
etc.) but can be anything.

Given a photo of a meal, and/or a voice description (possibly Hinglish), and/or a user's \
correction note, identify the dish(es), estimate a realistic portion, and return accurate macros.

Rules:
- Be specific about Indian dishes ("roti" not "flatbread", "dal tadka" not "lentil soup") when
  that's clearly what it is.
- If multiple items are visible/described, combine them into one realistic total, named
  descriptively (e.g. "2 roti, dal, aloo sabzi").
- Estimate calories, protein, carbs, fat and fiber (plus sugar/sodium if reasonably inferable)
  for the ACTUAL portion shown or described, not a generic restaurant serving.
- Portion size is the hardest part to get right — lean toward realistic home-cooking portions.
- If a correction note is given, treat it as ground truth about what changed from a prior
  estimate (e.g. "extra roti" = add one roti's worth, "more oil" = raise fat moderately) and
  adjust accordingly rather than starting over.
- If the user specified an exact gram weight, scale your estimate to exactly that weight.
- Return ONLY the structured JSON.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    grams: { type: 'NUMBER' },
    calories: { type: 'NUMBER' },
    protein_g: { type: 'NUMBER' },
    carbs_g: { type: 'NUMBER' },
    fat_g: { type: 'NUMBER' },
    fiber_g: { type: 'NUMBER' },
    sugar_g: { type: 'NUMBER' },
    sodium_mg: { type: 'NUMBER' },
  },
  required: ['name', 'grams', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'],
}

interface RequestBody {
  imageBase64?: string
  imageMimeType?: string
  audioBase64?: string
  audioMimeType?: string
  note?: string
  grams?: number
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body: RequestBody = await req.json()
    const { imageBase64, imageMimeType, audioBase64, audioMimeType, note, grams } = body

    if (!imageBase64 && !audioBase64) {
      return jsonResponse({ error: 'Provide imageBase64 and/or audioBase64.' }, 400)
    }

    const parts: Record<string, unknown>[] = []
    if (imageBase64) {
      parts.push({ inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } })
    }
    if (audioBase64) {
      parts.push({ inline_data: { mime_type: audioMimeType || 'audio/webm', data: audioBase64 } })
    }

    let instruction = SYSTEM_PROMPT
    if (audioBase64 && !imageBase64) {
      instruction += '\n\nThere is no photo — rely on the audio description of what was eaten.'
    }
    if (grams) instruction += `\n\nThe user specified the portion is exactly ${grams} grams.`
    if (note) instruction += `\n\nUser correction note: "${note}"`

    parts.push({ text: instruction })

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return jsonResponse({ error: `Gemini error: ${errText}` }, 502)
    }

    const geminiData = await geminiRes.json()
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return jsonResponse({ error: 'No response from Gemini.' }, 502)

    const parsed = JSON.parse(text)
    return jsonResponse({ ...parsed, ai_raw: geminiData })
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
