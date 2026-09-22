import { analyzeMeal, saveAnalyzedMeal } from './gemini'
import { getPendingMeals, removePendingMeal } from './outbox'

export async function processOutbox(): Promise<{ processed: number; remaining: number }> {
  const pending = await getPendingMeals()
  let processed = 0

  for (const item of pending) {
    try {
      const result = await analyzeMeal({
        imageBase64: item.kind === 'photo' ? item.base64 : undefined,
        imageMimeType: item.kind === 'photo' ? item.mimeType : undefined,
        audioBase64: item.kind === 'voice' ? item.base64 : undefined,
        audioMimeType: item.kind === 'voice' ? item.mimeType : undefined,
        note: item.note,
        grams: item.grams,
      })
      await saveAnalyzedMeal({
        userId: item.userId,
        date: item.date,
        mealSlot: item.mealSlot,
        source: item.kind === 'voice' ? 'voice' : 'ai',
        result,
      })
      await removePendingMeal(item.id)
      processed++
    } catch {
      // still offline or Gemini's unavailable — leave it queued, try again next time
    }
  }

  return { processed, remaining: pending.length - processed }
}
