/*
  # Fix Authentication Settings
  
  This migration ensures that email confirmation is properly disabled
  and users can sign up and sign in immediately.
*/

-- Update auth settings to disable email confirmation
-- Note: This needs to be done in the Supabase dashboard as well
-- Go to Authentication > Settings and set:
-- - Enable email confirmations: OFF
-- - Enable email change confirmations: OFF

-- Ensure RLS policies allow immediate access after signup
-- The existing policies should work, but let's make sure

-- Add a function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, preferences, usage_stats)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    '{}',
    '{}'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO anon, authenticated;
GRANT ALL ON public.user_agents TO anon, authenticated;
GRANT ALL ON public.agent_integrations TO anon, authenticated;
GRANT ALL ON public.agent_documents TO anon, authenticated;
GRANT ALL ON public.conversations TO anon, authenticated;
GRANT ALL ON public.messages TO anon, authenticated;
GRANT ALL ON public.message_attachments TO anon, authenticated;

-- Ensure the auth.uid() function works properly
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;