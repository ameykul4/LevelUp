import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Outlet, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { BottomNav } from './components/nav/BottomNav'
import { supabase } from './lib/supabase'
import { Auth } from './pages/Auth'
import { CheckIn } from './pages/CheckIn'
import { Diary } from './pages/Diary'
import { Home } from './pages/Home'
import { Onboarding } from './pages/Onboarding'
import { useAuthStore } from './store/useAuthStore'

const queryClient = new QueryClient()

function Splash() {
  return (
    <div className="flex-1 flex items-center justify-center bg-together">
      <p className="font-display text-2xl text-white">LevelUp</p>
    </div>
  )
}

function AppShell() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}

function Gate() {
  const { session, loading, init } = useAuthStore()

  useEffect(() => init(), [init])

  const { data: onboarded, isLoading: profileLoading } = useQuery({
    queryKey: ['onboarded', session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', session!.user.id)
        .single()
      if (error) throw error
      return data.onboarded as boolean
    },
  })

  if (loading) return <Splash />

  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
      <Route
        path="/onboarding"
        element={
          !session ? (
            <Navigate to="/auth" replace />
          ) : profileLoading ? (
            <Splash />
          ) : onboarded ? (
            <Navigate to="/" replace />
          ) : (
            <Onboarding />
          )
        }
      />
      <Route
        element={
          !session ? (
            <Navigate to="/auth" replace />
          ) : profileLoading ? (
            <Splash />
          ) : !onboarded ? (
            <Navigate to="/onboarding" replace />
          ) : (
            <AppShell />
          )
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/checkin" element={<CheckIn />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Gate />
      </Router>
    </QueryClientProvider>
  )
}

export default App
