// Open Food Facts — free barcode → macros lookup (BUILD_PLAN §6a). No API key needed.

export interface BarcodeProduct {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sugar_g: number
  sodium_mg: number
  gramsPerServing: number | null
}

export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null

  const p = data.product
  const n = p.nutriments ?? {}
  const per100 = {
    calories: n['energy-kcal_100g'] ?? 0,
    protein_g: n.proteins_100g ?? 0,
    carbs_g: n.carbohydrates_100g ?? 0,
    fat_g: n.fat_100g ?? 0,
    fiber_g: n.fiber_100g ?? 0,
    sugar_g: n.sugars_100g ?? 0,
    sodium_mg: (n.sodium_100g ?? 0) * 1000,
  }

  const servingGrams = p.serving_quantity ? Number(p.serving_quantity) : null
  const scale = servingGrams ? servingGrams / 100 : 1

  return {
    name: p.product_name || p.generic_name || 'Unknown product',
    calories: Math.round(per100.calories * scale),
    protein_g: round1(per100.protein_g * scale),
    carbs_g: round1(per100.carbs_g * scale),
    fat_g: round1(per100.fat_g * scale),
    fiber_g: round1(per100.fiber_g * scale),
    sugar_g: round1(per100.sugar_g * scale),
    sodium_mg: Math.round(per100.sodium_mg * scale),
    gramsPerServing: servingGrams,
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
