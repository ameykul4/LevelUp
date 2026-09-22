import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  loading: boolean
  init: () => () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, loading: false })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, loading: false })
    })

    return () => subscription.subscription.unsubscribe()
  },
}))
