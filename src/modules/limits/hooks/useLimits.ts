import { useState, useEffect } from 'react'
import { supabase } from '../../database/lib/supabase'
import { useAuth } from '../../auth/hooks/useAuth'
import { PLAN_LIMITS, type UsageStats, type UsageLimits } from '../../../core/types/limits'

export function useLimits() {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [limits, setLimits] = useState<UsageLimits | null>(null)
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

      // First, get the agent IDs for the current user
      const { data: userAgents, error: userAgentsError } = await supabase
        .from('user_agents')
        .select('id')
        .eq('user_id', user.id)

      if (userAgentsError) {
        console.error('Error fetching user agents:', userAgentsError)
        throw new Error(`Failed to fetch user agents: ${userAgentsError.message}`)
      }

      // Extract agent IDs into an array
      const agentIds = userAgents?.map(agent => agent.id) || []

      // Count integrations using the array of agent IDs
      let integrationCount = 0
      if (agentIds.length > 0) {
        const { count, error: integrationError } = await supabase
          .from('agent_integrations')
          .select('agent_id', { count: 'exact', head: true })
          .in('agent_id', agentIds)

        if (integrationError) {
          console.error('Error counting integrations:', integrationError)
          // Don't throw here, just log and continue with 0
        } else {
          integrationCount = count || 0
        }
      }

      const planId = profile?.preferences?.plan_id || usageData?.plan_id || 'free'
      const planLimits = PLAN_LIMITS[planId] || PLAN_LIMITS.free

      const currentUsage: UsageStats = {
        callTimeUsedMinutes: usageData?.call_time_used || 0,
        agentsCreated: agentCount || 0,
        integrationsActive: integrationCount || 0,
        storageUsedMB: Math.ceil((usageData?.storage_used || 0) / (1024 * 1024)), // Convert bytes to MB
        chatTokensUsed: usageData?.chat_tokens_used || 0
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

  const checkLimit = (type: keyof UsageLimits): { exceeded: boolean; percentage: number } => {
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
        used = usage.callTimeUsedMinutes
        break
      case 'maxAgents':
        used = usage.agentsCreated
        break
      case 'maxIntegrations':
        used = usage.integrationsActive
        break
      case 'maxStorageMB':
        used = usage.storageUsedMB
        break
      case 'maxChatTokens':
        used = usage.chatTokensUsed
        break
    }

    const percentage = limit > 0 ? (used / limit) * 100 : 0
    return {
      exceeded: used >= limit,
      percentage: Math.min(percentage, 100)
    }
  }

  const canPerformAction = (type: keyof UsageLimits): boolean => {
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