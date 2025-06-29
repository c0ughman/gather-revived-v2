import { useState, useEffect } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../../database/lib/supabase'

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

  // Clear all user-specific data from localStorage
  const clearUserData = () => {
    console.log('🧹 Clearing all user data from localStorage');
    
    // Get all keys in localStorage
    const keys = Object.keys(localStorage);
    
    // Find and remove all user-specific data
    keys.forEach(key => {
      // Remove Stripe-related data
      if (key.startsWith('stripe_') || key.includes('subscription')) {
        localStorage.removeItem(key);
      }
      
      // Remove OAuth tokens and connection status
      if (key.startsWith('oauth_') || key.startsWith('notion_token_')) {
        localStorage.removeItem(key);
      }
      
      // Remove user-specific messages
      if (key.includes('messages') || key.includes('conversation')) {
        localStorage.removeItem(key);
      }
      
      // Remove any other user-specific data
      if (key.includes('user_') || key.includes('profile_')) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear specific known keys
    localStorage.removeItem('gather-messages');
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
      
      // If a user is logged in, clear any previous user data
      if (session?.user) {
        clearUserData();
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event);
      
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Clear any previous user data when a new user signs in
        clearUserData();
      } else if (event === 'SIGNED_OUT') {
        // Clear all user data on sign out
        clearUserData();
      }
      
      setAuthState({
        user: session?.user ?? null,
        session,
        loading: false
      })
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name // Store name in user metadata
        }
      }
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  const signOut = async () => {
    // Clear user data before signing out
    clearUserData();
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email)
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