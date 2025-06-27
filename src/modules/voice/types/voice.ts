export interface CallState {
  isActive: boolean;
  duration: number;
  isMuted: boolean;
  status: 'connecting' | 'connected' | 'ended';
}

export interface VoiceConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface VoiceResponse {
  text: string;
  isComplete: boolean;
} 