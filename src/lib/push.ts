import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(userId: string): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY) as BufferSource,
  })

  const json = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      { onConflict: 'endpoint' },
    )
  if (error) throw error
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getPushSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
