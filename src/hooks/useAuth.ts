import { useState, useEffect } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)
      
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })

      // Create user profile when user signs up or signs in for the first time
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureUserProfile(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Ensure user profile exists in our database
  const ensureUserProfile = async (user: User) => {
    try {
      console.log('Ensuring user profile exists for:', user.email)
      
      // Check if profile already exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking user profile:', fetchError)
        return
      }

      // Create profile if it doesn't exist
      if (!existingProfile) {
        console.log('Creating new user profile...')
        
        const displayName = user.email?.split('@')[0] || 'User'
        
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            display_name: displayName,
            preferences: {},
            usage_stats: {}
          })

        if (insertError) {
          console.error('Error creating user profile:', insertError)
        } else {
          console.log('User profile created successfully')
        }
      } else {
        console.log('User profile already exists')
      }
    } catch (error) {
      console.error('Error in ensureUserProfile:', error)
    }
  }

  const signUp = async (email: string, password: string) => {
    console.log('Attempting to sign up:', email)
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined // Disable email confirmation
      }
    })

    console.log('Sign up result:', { data, error })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to sign in:', email)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    console.log('Sign in result:', { data, error })
    return { data, error }
  }

  const signOut = async () => {
    console.log('Signing out...')
    
    const { error } = await supabase.auth.signOut()
    
    if (!error) {
      // Clear local state immediately
      setAuthState({
        user: null,
        session: null,
        loading: false
      })
    }
    
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    return { data, error }
  }

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    resetPassword
  }
}