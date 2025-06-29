import { useState, useEffect } from 'react'
import { supabase } from '../../database/lib/supabase'
import { useAuth } from '../../auth/hooks/useAuth'
import type { UserUsage, PlanLimits } from '../../../core/types/limits'

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    callTimeMinutes: 60,
    maxAgents: 3,
    maxIntegrations: 2,
    storageGB: 1,
    chatTokens: 50000
  },
  pro: {
    callTimeMinutes: 600,
    maxAgents: 25,
    maxIntegrations: 10,
    storageGB: 10,
    chatTokens: 500000
  },
  enterprise: {
    callTimeMinutes: -1, // unlimited
    maxAgents: -1, // unlimited
    maxIntegrations: -1, // unlimited
    storageGB: -1, // unlimited
    chatTokens: -1 // unlimited
  }
}

export function useLimits() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UserUsage | null>(null)
  const [limits, setLimits] = useState<PlanLimits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLimits = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setError(null)
      
      // Test Supabase connection first
      const { data: connectionTest, error: connectionError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (connectionError) {
        console.error('Supabase connection error:', connectionError)
        throw new Error(`Database connection failed: ${connectionError.message}`)
      }

      // Fetch user profile to get plan
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError)
        throw new Error(`Failed to fetch user profile: ${profileError.message}`)
      }

      // Fetch usage data
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage data:', usageError)
        throw new Error(`Failed to fetch usage data: ${usageError.message}`)
      }

      // Count agents
      const { count: agentCount, error: agentError } = await supabase
        .from('user_agents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (agentError) {
        console.error('Error counting agents:', agentError)
        throw new Error(`Failed to count agents: ${agentError.message}`)
      }

      // Count integrations
      const { count: integrationCount, error: integrationError } = await supabase
        .from('agent_integrations')
        .select('agent_id', { count: 'exact', head: true })
        .in('agent_id', 
          supabase
            .from('user_agents')
            .select('id')
            .eq('user_id', user.id)
        )

      if (integrationError) {
        console.error('Error counting integrations:', integrationError)
        // Don't throw here, just log and continue with 0
      }

      const planId = profile?.preferences?.plan_id || usageData?.plan_id || 'free'
      const planLimits = PLAN_LIMITS[planId] || PLAN_LIMITS.free

      const currentUsage: UserUsage = {
        callTimeUsed: usageData?.call_time_used || 0,
        agentsCreated: agentCount || 0,
        integrationsActive: integrationCount || 0,
        storageUsed: usageData?.storage_used || 0,
        chatTokensUsed: usageData?.chat_tokens_used || 0,
        planId
      }

      setUsage(currentUsage)
      setLimits(planLimits)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Error in fetchLimits:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLimits()
  }, [user])

  const checkLimit = (type: keyof PlanLimits): { exceeded: boolean; percentage: number } => {
    if (!usage || !limits) {
      return { exceeded: false, percentage: 0 }
    }

    const limit = limits[type]
    if (limit === -1) {
      return { exceeded: false, percentage: 0 } // unlimited
    }

    let used = 0
    switch (type) {
      case 'callTimeMinutes':
        used = usage.callTimeUsed
        break
      case 'maxAgents':
        used = usage.agentsCreated
        break
      case 'maxIntegrations':
        used = usage.integrationsActive
        break
      case 'storageGB':
        used = Math.ceil(usage.storageUsed / (1024 * 1024 * 1024)) // Convert bytes to GB
        break
      case 'chatTokens':
        used = usage.chatTokensUsed
        break
    }

    const percentage = limit > 0 ? (used / limit) * 100 : 0
    return {
      exceeded: used >= limit,
      percentage: Math.min(percentage, 100)
    }
  }

  const canPerformAction = (type: keyof PlanLimits): boolean => {
    const { exceeded } = checkLimit(type)
    return !exceeded
  }

  return {
    usage,
    limits,
    loading,
    error,
    checkLimit,
    canPerformAction,
    refetch: fetchLimits
  }
}