import { useState, useEffect, createContext, useContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseService } from '../../database/services/supabaseService';

interface AuthContextType {
  user: User | null;
  userProfile: any | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabaseService.getClient().auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          await handleUserSession(session.user);
        } else {
          setUser(null);
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeAuth = async () => {
    try {
      console.log('🔐 Initializing auth...');
      setLoading(true);

      const currentUser = await supabaseService.getCurrentUser();
      
      if (currentUser) {
        await handleUserSession(currentUser);
      }
    } catch (error) {
      console.error('❌ Error initializing auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSession = async (user: User) => {
    try {
      console.log('👤 Handling user session for:', user.email);
      setUser(user);

      // Try to get user profile
      try {
        const profile = await supabaseService.getUserProfile(user.id);
        setUserProfile(profile);
        console.log('✅ User profile loaded');
      } catch (profileError) {
        console.warn('⚠️ User profile not found, creating one...');
        
        // Create profile if it doesn't exist
        try {
          const newProfile = await supabaseService.createUserProfile(user.id, {
            display_name: user.email?.split('@')[0] || 'User',
            avatar_url: null,
            timezone: 'UTC',
            preferences: {},
            subscription_tier: 'free',
            usage_stats: {}
          });
          setUserProfile(newProfile);
          console.log('✅ User profile created');
        } catch (createError) {
          console.error('❌ Failed to create user profile:', createError);
          // Continue without profile for now
        }
      }
    } catch (error) {
      console.error('❌ Error handling user session:', error);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('🔐 Signing up user:', email);
      
      const { user: newUser, session } = await supabaseService.signUp(email, password);
      
      if (newUser && session) {
        await handleUserSession(newUser);
      }
      
      console.log('✅ Sign up successful');
    } catch (error) {
      console.error('❌ Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('🔐 Signing in user:', email);
      
      const { user: signedInUser, session } = await supabaseService.signIn(email, password);
      
      if (signedInUser && session) {
        await handleUserSession(signedInUser);
      }
      
      console.log('✅ Sign in successful');
    } catch (error) {
      console.error('❌ Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      console.log('🔐 Signing out user...');
      
      await supabaseService.signOut();
      
      setUser(null);
      setUserProfile(null);
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (user) {
      await handleUserSession(user);
    }
  };

  return {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshUser
  };
}

export { AuthContext };