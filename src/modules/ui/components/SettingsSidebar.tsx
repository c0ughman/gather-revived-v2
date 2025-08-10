import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Save, User, Database, FileText, Plus, Trash2, Settings, X, Upload, Volume2, Palette } from 'lucide-react';
import { AIContact } from '../../../core/types/types';
import { DocumentInfo } from '../../fileManagement/types/documents';
import { IntegrationInstance } from '../../integrations/types/integrations';
import { getIntegrationById } from '../../integrations/data/integrations';
import DocumentUpload, { DocumentList } from './DocumentUpload';
import IntegrationsLibrary from './IntegrationsLibrary';
import IntegrationSetup from './IntegrationSetup';
import { Integration, IntegrationConfig } from '../../integrations/types/integrations';
import { documentApiService } from '../../../core/services/documentApiService';

interface SettingsSidebarProps {
  contact: AIContact | null;
  onSave: (contact: AIContact) => void;
  className?: string;
  formData?: {
    name: string;
    description: string;
    color: string;
    voice: string;
    avatar: string;
  };
  integrations?: IntegrationInstance[];
  documents?: DocumentInfo[];
  hasChanges?: boolean;
  onFormChange?: (field: string, value: string) => void;
  onIntegrationsChange?: (integrations: IntegrationInstance[]) => void;
  onDocumentsChange?: (documents: DocumentInfo[]) => void;
}

export default function SettingsSidebar({ 
  contact, 
  onSave, 
  className = '',
  formData: externalFormData,
  integrations: externalIntegrations,
  documents: externalDocuments,
  hasChanges: externalHasChanges,
  onFormChange,
  onIntegrationsChange,
  onDocumentsChange
}: SettingsSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    integrations: true,
    documents: true
  });

  // Use external state if provided, otherwise use local state
  const [localFormData, setLocalFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    voice: 'Puck',
    avatar: ''
  });

  // Available voices from Gemini Live API
  const availableVoices = [
    { id: 'Puck', name: 'Puck', description: 'Playful and energetic', gender: 'Male' },
    { id: 'Charon', name: 'Charon', description: 'Deep and mysterious', gender: 'Male' },
    { id: 'Kore', name: 'Kore', description: 'Warm and friendly', gender: 'Female' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Strong and confident', gender: 'Male' },
    { id: 'Aoede', name: 'Aoede', description: 'Melodic and soothing', gender: 'Female' },
    { id: 'Leda', name: 'Leda', description: 'Gentle and calm', gender: 'Female' },
    { id: 'Orus', name: 'Orus', description: 'Clear and articulate', gender: 'Male' },
    { id: 'Zephyr', name: 'Zephyr', description: 'Light and airy', gender: 'Female' }
  ];

  // Available colors with names
  const availableColors = [
    { id: '#3b82f6', name: 'Blue', hex: '#3b82f6' },
    { id: '#8b5cf6', name: 'Purple', hex: '#8b5cf6' },
    { id: '#10b981', name: 'Emerald', hex: '#10b981' },
    { id: '#f59e0b', name: 'Amber', hex: '#f59e0b' },
    { id: '#ef4444', name: 'Red', hex: '#ef4444' },
    { id: '#ec4899', name: 'Pink', hex: '#ec4899' },
    { id: '#06b6d4', name: 'Cyan', hex: '#06b6d4' },
    { id: '#84cc16', name: 'Lime', hex: '#84cc16' },
    { id: '#f97316', name: 'Orange', hex: '#f97316' },
    { id: '#6366f1', name: 'Indigo', hex: '#6366f1' }
  ];

  const [localIntegrations, setLocalIntegrations] = useState<IntegrationInstance[]>([]);
  const [localDocuments, setLocalDocuments] = useState<DocumentInfo[]>([]);
  const [localHasChanges, setLocalHasChanges] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);

  // Use external state if provided, otherwise use local state
  const formData = externalFormData || localFormData;
  const integrations = externalIntegrations || localIntegrations;
  const documents = externalDocuments || localDocuments;
  const hasChanges = externalHasChanges !== undefined ? externalHasChanges : localHasChanges;
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Integration setup state
  const [showIntegrationsLibrary, setShowIntegrationsLibrary] = useState(false);
  const [setupIntegration, setSetupIntegration] = useState<Integration | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationInstance | null>(null);

  // Update form data when contact changes
  useEffect(() => {
    if (contact && !externalFormData) {
      setLocalFormData({
        name: contact.name,
        description: contact.description,
        color: contact.color,
        voice: contact.voice || 'Puck',
        avatar: contact.avatar || ''
      });
      setLocalIntegrations(contact.integrations || []);
      setLocalDocuments(contact.documents || []);
      setLocalHasChanges(false);
    }
  }, [contact, externalFormData]);

  // Close color dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.color-dropdown')) {
        setShowColorDropdown(false);
      }
    };

    if (showColorDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorDropdown]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    if (onFormChange) {
      onFormChange(field, value);
    } else {
      setLocalFormData(prev => ({ ...prev, [field]: value }));
      setLocalHasChanges(true);
    }
  };

  const handleSave = () => {
    if (!contact) return;

    const updatedContact: AIContact = {
      ...contact,
      name: formData.name.trim(),
      description: formData.description.trim(),
      voice: formData.voice,
      initials: formData.name.trim().split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2) || 'AI',
      integrations: integrations.length > 0 ? integrations : undefined,
      documents: documents.length > 0 ? documents : undefined
    };
    
    onSave(updatedContact);
    if (!onFormChange) {
      setLocalHasChanges(false);
    }
  };

  // Document handlers
  const handleDocumentUploaded = (document: DocumentInfo) => {
    if (onDocumentsChange) {
      onDocumentsChange([...documents, document]);
    } else {
      setLocalDocuments(prev => [...prev, document]);
      setLocalHasChanges(true);
    }
    setUploadError(null);
  };

  const handleDocumentError = (error: string) => {
    setUploadError(error);
  };

  const [deletingDocuments, setDeletingDocuments] = useState<Set<string>>(new Set());

  const handleRemoveDocument = async (documentId: string) => {
    // Prevent multiple simultaneous deletions of the same document
    if (deletingDocuments.has(documentId)) {
      console.log(`⏭️ Document ${documentId} is already being deleted, skipping`);
      return;
    }
    
    setDeletingDocuments(prev => new Set([...prev, documentId]));
    
    try {
      // First, try to delete from database
      console.log(`🗑️ Deleting document ${documentId} from database`);
      await documentApiService.deleteDocument(documentId);
      console.log(`✅ Successfully deleted document ${documentId} from database`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if this is a "document not found" error (frontend-only document)
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        console.log(`📝 Document ${documentId} was frontend-only, removing from local state`);
      } else {
        console.error(`❌ Failed to delete document ${documentId} from database:`, error);
        // For other errors, we'll still continue to remove from frontend for better UX
      }
    } finally {
      // Clean up the tracking set
      setDeletingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
    
    // Always remove from local state (whether database deletion succeeded or failed)
    if (onDocumentsChange) {
      onDocumentsChange(documents.filter(doc => doc.id !== documentId));
    } else {
      setLocalDocuments(prev => prev.filter(doc => doc.id !== documentId));
      setLocalHasChanges(true);
    }
    
    console.log(`✅ Document ${documentId} removed from frontend`);
  };

  // Integration handlers
  const handleSelectIntegration = (integration: Integration) => {
    setSetupIntegration(integration);
    setShowIntegrationsLibrary(false);
  };

  const handleSaveIntegration = (config: IntegrationConfig) => {
    const integrationInstance: IntegrationInstance = {
      id: Date.now().toString(),
      integrationId: config.integrationId,
      name: `${getIntegrationById(config.integrationId)?.name} - ${contact?.name}`,
      config,
      status: 'active'
    };

    if (editingIntegration) {
      const updatedIntegrations = integrations.map(int => 
        int.id === editingIntegration.id ? { ...integrationInstance, id: editingIntegration.id } : int
      );
      if (onIntegrationsChange) {
        onIntegrationsChange(updatedIntegrations);
      } else {
        setLocalIntegrations(updatedIntegrations);
        setLocalHasChanges(true);
      }
    } else {
      if (onIntegrationsChange) {
        onIntegrationsChange([...integrations, integrationInstance]);
      } else {
        setLocalIntegrations(prev => [...prev, integrationInstance]);
        setLocalHasChanges(true);
      }
    }

    setSetupIntegration(null);
    setEditingIntegration(null);
  };

  const handleEditIntegration = (integrationInstance: IntegrationInstance) => {
    const integration = getIntegrationById(integrationInstance.integrationId);
    if (integration) {
      setSetupIntegration(integration);
      setEditingIntegration(integrationInstance);
    }
  };

  const handleRemoveIntegration = (integrationId: string) => {
    if (confirm('Remove this integration?')) {
      if (onIntegrationsChange) {
        onIntegrationsChange(integrations.filter(int => int.id !== integrationId));
      } else {
        setLocalIntegrations(prev => prev.filter(int => int.id !== integrationId));
        setLocalHasChanges(true);
      }
    }
  };

  // Helper function to create radial gradient for agents without avatars
  const createAgentGradient = (color: string) => {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Create complementary color by shifting hue and make it lighter
    const compR = Math.round(255 - r * 0.3); // Softer complement
    const compG = Math.round(255 - g * 0.3);
    const compB = Math.round(255 - b * 0.3);
    
    // Make complementary color lighter than the main color
    const lightCompR = Math.round(compR + (255 - compR) * 0.8);
    const lightCompG = Math.round(compG + (255 - compG) * 0.8);
    const lightCompB = Math.round(compB + (255 - compB) * 0.8);
    
    return `radial-gradient(circle, rgb(${lightCompR}, ${lightCompG}, ${lightCompB}) 0%, ${color} 40%, rgba(${r}, ${g}, ${b}, 0.4) 50%, rgba(${r}, ${g}, ${b}, 0.1) 60%, rgba(0, 0, 0, 0) 70%)`;
  };

  if (!contact) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <Settings className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 font-inter">Select a contact to view settings</p>
        </div>
      </div>
    );
  }

  // Show integration setup modal
  if (setupIntegration) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex flex-col ${className}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold font-inter">Setup Integration</h3>
          <button
            onClick={() => {
              setSetupIntegration(null);
              setEditingIntegration(null);
            }}
            className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto">
            <IntegrationSetup
              integration={setupIntegration}
              existingConfig={editingIntegration?.config}
              onSave={handleSaveIntegration}
              onCancel={() => {
                setSetupIntegration(null);
                setEditingIntegration(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show integrations library modal
  if (showIntegrationsLibrary) {
    return (
      <div className={`h-full bg-glass-panel glass-effect flex flex-col ${className}`}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-semibold font-inter">Add Integration</h3>
          <button
            onClick={() => setShowIntegrationsLibrary(false)}
            className="p-1 rounded-full hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-md mx-auto">
            <IntegrationsLibrary 
              onSelectIntegration={handleSelectIntegration}
              selectedIntegrations={integrations.map(int => int.integrationId)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full bg-glass-panel glass-effect flex flex-col font-inter ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-glass-panel glass-effect">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden">
              {formData.avatar ? (
                <img
                  src={formData.avatar}
                  alt={formData.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div 
                  className="w-full h-full rounded-lg"
                  style={{ background: createAgentGradient(formData.color) }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-white font-semibold truncate">{formData.name}</h2>
              <p className="text-slate-400 text-xs">Settings</p>
            </div>
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="flex items-center space-x-1 px-3 py-1.5 bg-[#186799] hover:bg-[#1a5a7a] text-white rounded-full transition-colors duration-200 text-sm"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* Settings Content - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-glass-panel glass-effect">
        {/* Basic Info Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Persona</span>
            </div>
            {expandedSections.basic ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.basic && (
            <div className="px-4 pb-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm resize-none"
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center space-x-1">
                  <Palette className="w-3 h-3" />
                  <span>Color</span>
                </label>
                <div className="relative color-dropdown">
                  <button
                    onClick={() => setShowColorDropdown(!showColorDropdown)}
                    className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm appearance-none cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: formData.color }}
                      />
                      <span>{availableColors.find(c => c.hex === formData.color)?.name || 'Select Color'}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showColorDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showColorDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-lg z-50 max-h-48 overflow-y-auto">
                      {availableColors.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => {
                            handleInputChange('color', color.hex);
                            setShowColorDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors duration-200 flex items-center space-x-2 ${
                            formData.color === color.hex ? 'bg-slate-700' : ''
                          }`}
                        >
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="text-white text-sm">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Voice */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center space-x-1">
                  <Volume2 className="w-3 h-3" />
                  <span>Voice</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.voice}
                    onChange={(e) => handleInputChange('voice', e.target.value)}
                    className="w-full bg-glass-panel glass-effect text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-[#186799] focus:outline-none transition-colors duration-200 text-sm appearance-none cursor-pointer"
                  >
                    {availableVoices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name} ({voice.gender}) - {voice.description}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Avatar Upload */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center space-x-1">
                  <Upload className="w-3 h-3" />
                  <span>Avatar</span>
                </label>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                    {formData.avatar ? (
                      <img
                        src={formData.avatar}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-full h-full"
                        style={{ background: createAgentGradient(formData.color) }}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            setUploadError('Please select an image file');
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            setUploadError('Image must be smaller than 5MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (e) => {
                            const base64 = e.target?.result as string;
                            handleInputChange('avatar', base64);
                            setUploadError(null);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="block text-xs text-slate-400 hover:text-white cursor-pointer transition-colors duration-200"
                    >
                      {formData.avatar ? 'Change avatar' : 'Upload avatar'}
                    </label>
                  </div>
                  {formData.avatar && (
                    <button
                      onClick={() => handleInputChange('avatar', '')}
                      className="p-1 hover:bg-slate-600 rounded text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Integrations Section */}
        <div className="border-b border-slate-700">
          <button
            onClick={() => toggleSection('integrations')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Integrations</span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {integrations.length}
              </span>
            </div>
            {expandedSections.integrations ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.integrations && (
            <div className="px-4 pb-4 space-y-3">
              <button
                onClick={() => setShowIntegrationsLibrary(true)}
                className="w-full flex items-center justify-center space-x-2 p-2 border border-dashed border-slate-600 rounded-lg hover:border-slate-500 hover:bg-white/5 transition-colors duration-200 text-sm"
              >
                <Plus className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Add Integration</span>
              </button>

              {integrations.map((integration) => {
                const integrationDef = getIntegrationById(integration.integrationId);
                if (!integrationDef) return null;

                return (
                  <div key={integration.id} className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: integrationDef.color + '20', color: integrationDef.color }}
                        >
                          <Database className="w-3 h-3" />
                        </div>
                        <span className="text-white text-sm font-medium truncate">{integrationDef.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditIntegration(integration)}
                          className="p-1 hover:bg-slate-600 rounded text-xs text-slate-400 hover:text-white transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveIntegration(integration.id)}
                          className="p-1 hover:bg-slate-600 rounded text-xs text-red-400 hover:text-red-300 transition-colors duration-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      Status: {integration.status === 'active' ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div>
          <button
            onClick={() => toggleSection('documents')}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-white font-medium">Documents</span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                {documents.length}
              </span>
            </div>
            {expandedSections.documents ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>
          
          {expandedSections.documents && (
            <div className="px-4 pb-4 space-y-3">
              {uploadError && (
                <div className="p-2 bg-red-900 bg-opacity-50 border border-red-700 rounded text-red-300 text-xs">
                  {uploadError}
                </div>
              )}
              
              <DocumentUpload
                onDocumentUploaded={handleDocumentUploaded}
                onError={handleDocumentError}
                className="text-xs"
              />
              
              <DocumentList
                documents={documents}
                onRemoveDocument={handleRemoveDocument}
                className="text-xs"
              />
              
              {documents.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No documents uploaded</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}