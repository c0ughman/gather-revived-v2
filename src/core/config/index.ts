// Application configuration
export const APP_CONFIG = {
  name: 'Gather',
  version: '1.0.0',
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  },
  features: {
    voice: true,
    chat: true,
    integrations: true,
    fileUpload: true,
    oauth: true,
  },
  limits: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxMessages: 1000,
    maxIntegrations: 50,
  }
};

export type AppConfig = typeof APP_CONFIG; 