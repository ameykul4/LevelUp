import { supabase } from './supabase'

export async function uploadProgressPhoto(userId: string, file: File | Blob, mimeType: string): Promise<string> {
  const ext = mimeType.split('/')[1] || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('progress-photos').upload(path, file, { contentType: mimeType })
  if (error) throw error
  return path
}

export async function signedProgressPhotoUrls(paths: string[], expiresInSeconds = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from('progress-photos').createSignedUrls(paths, expiresInSeconds)
  if (error) throw error
  const map: Record<string, string> = {}
  for (const item of data) {
    if (item.signedUrl && item.path) map[item.path] = item.signedUrl
  }
  return map
}
