import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function useCouple(userId: string) {
  const { data: coupleId, isLoading: coupleLoading } = useQuery({
    queryKey: ['couple-id', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('couple_members').select('couple_id').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return data?.couple_id as string | undefined
    },
  })

  const { data: partner, isLoading: partnerLoading } = useQuery({
    queryKey: ['partner', coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data: member, error: memberError } = await supabase
        .from('couple_members')
        .select('user_id')
        .eq('couple_id', coupleId)
        .neq('user_id', userId)
        .maybeSingle()
      if (memberError) throw memberError
      if (!member) return null

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', member.user_id)
        .single()
      if (profileError) throw profileError
      return profile as Profile
    },
  })

  return {
    isPaired: !!coupleId,
    coupleId,
    partner: partner ?? null,
    loading: coupleLoading || (!!coupleId && partnerLoading),
  }
}
