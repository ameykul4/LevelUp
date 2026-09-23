import { useState } from 'react'
import { Link } from 'react-router-dom'
import { GardenView } from '../components/together/GardenView'
import { MapView } from '../components/together/MapView'
import { Card } from '../components/ui/Card'
import { useCouple } from '../hooks/useCouple'
import { useAuthStore } from '../store/useAuthStore'

type Tab = 'map' | 'garden'

export function Together() {
  const session = useAuthStore((s) => s.session)
  const userId = session!.user.id
  const { isPaired, coupleId, loading } = useCouple(userId)
  const [tab, setTab] = useState<Tab>('map')

  if (loading) return null

  return (
    <div className="flex-1 px-5 py-8 max-w-lg mx-auto w-full flex flex-col gap-5">
      <h1 className="font-display text-3xl">Together</h1>

      {!isPaired || !coupleId ? (
        <Card>
          <p className="text-sm text-ink-soft text-center py-6">
            Pair with your partner to start your journey and garden together.
          </p>
          <Link to="/settings" className="text-sm text-you-deep font-medium block text-center">
            Invite your partner →
          </Link>
        </Card>
      ) : (
        <>
          <div className="flex gap-2">
            {(['map', 'garden'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2 text-sm font-medium capitalize ${
                  tab === t ? 'bg-you text-white' : 'bg-ink/5 text-ink-soft'
                }`}
              >
                {t === 'map' ? '🗺 Map' : '🌷 Garden'}
              </button>
            ))}
          </div>

          {tab === 'map' ? <MapView coupleId={coupleId} /> : <GardenView userId={userId} coupleId={coupleId} />}
        </>
      )}
    </div>
  )
}
