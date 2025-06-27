export interface DatabaseAgent {
  id: string;
  name: string;
  initials: string;
  color: string;
  description: string;
  status: string;
  last_seen: string | null;
  voice: string | null;
  avatar_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseDocument {
  id: string;
  agent_id: string;
  name: string;
  file_type: string;
  file_size: number;
  content: string | null;
  summary: string | null;
  extracted_text: string | null;
  metadata: any;
  uploaded_at: string;
}

export interface DatabaseIntegration {
  id: string;
  agent_id: string;
  template_id: string;
  name: string;
  config: any;
  status: string;
  created_at: string;
  updated_at: string;
} 