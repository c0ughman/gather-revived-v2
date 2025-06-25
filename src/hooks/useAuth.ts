import { useState, useEffect } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { supabaseService } from '../services/supabaseService'

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
    console.log('🔐 Initializing auth...')
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔐 Initial session:', session?.user?.email || 'No session')
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
      console.log('🔐 Auth state changed:', event, session?.user?.email || 'No user')
      
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })

      // Create user profile when user signs up or signs in for the first time
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🔐 User signed in, ensuring profile exists...')
        await ensureUserProfile(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Ensure user profile exists in our database
  const ensureUserProfile = async (user: User) => {
    try {
      console.log('👤 Ensuring user profile exists for:', user.email)
      
      // Try to get existing profile
      const existingProfile = await supabaseService.getUserProfile(user.id)
      
      if (!existingProfile) {
        console.log('👤 Creating new user profile...')
        
        const displayName = user.email?.split('@')[0] || 'User'
        
        await supabaseService.createUserProfile(user.id, displayName)
        console.log('✅ User profile created successfully')
      } else {
        console.log('✅ User profile already exists')
      }
    } catch (error) {
      console.error('❌ Error in ensureUserProfile:', error)
    }
  }

  const signUp = async (email: string, password: string) => {
    console.log('📝 Attempting to sign up:', email)
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation redirect
          data: {
            email_confirm: false // Try to disable email confirmation
          }
        }
      })

      console.log('📝 Sign up result:', { 
        user: data.user?.email, 
        session: !!data.session,
        error: error?.message 
      })

      // If sign up was successful but no session (email confirmation required)
      if (data.user && !data.session && !error) {
        console.log('📧 Email confirmation may be required, attempting direct sign in...')
        
        // Try to sign in immediately (this works if email confirmation is disabled)
        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password
        })
        
        console.log('📝 Direct sign in after signup:', {
          user: signInResult.data.user?.email,
          session: !!signInResult.data.session,
          error: signInResult.error?.message
        })
        
        return signInResult
      }

      return { data, error }
    } catch (err) {
      console.error('❌ Sign up error:', err)
      return { data: null, error: err as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    console.log('🔑 Attempting to sign in:', email)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    console.log('🔑 Sign in result:', { 
      user: data.user?.email, 
      session: !!data.session,
      error: error?.message 
    })
    
    return { data, error }
  }

  const signOut = async () => {
    console.log('🚪 Signing out...')
    
    const { error } = await supabase.auth.signOut()
    
    if (!error) {
      // Clear local state immediately
      setAuthState({
        user: null,
        session: null,
        loading: false
      })
      console.log('✅ Signed out successfully')
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