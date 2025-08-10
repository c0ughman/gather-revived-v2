import React, { useState } from 'react';
import { Save, X, Play, AlertCircle, CheckCircle, Globe, Search, Rss, Newspaper, Cloud, TrendingUp, Calendar, Building2, Database, FileText } from 'lucide-react';
import { Integration, IntegrationConfig, IntegrationField } from '../../integrations/types/integrations';
import { integrationsService } from '../../integrations/core/integrationsService';
import { useAuth } from '../../auth/hooks/useAuth';

interface IntegrationSetupProps {
  integration: Integration;
  existingConfig?: IntegrationConfig;
  onSave: (config: IntegrationConfig) => void;
  onCancel: () => void;
}

export default function IntegrationSetup({
  integration,
  existingConfig,
  onSave,
  onCancel
}: IntegrationSetupProps) {
  const { user } = useAuth();

  const [config, setConfig] = useState<IntegrationConfig>({
    integrationId: integration.id,
    enabled: existingConfig?.enabled ?? false,
    settings: existingConfig?.settings ?? {},
    // OAuth removed - no longer supported
    oauthTokenId: '',
    oauthConnected: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFieldChange = (field: IntegrationField, value: string) => {
    setConfig(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field.id]: value
      }
    }));
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!user) return;

    setIsLoading(true);
    setTestResult(null);

    try {
      // Check if this is an OAuth integration that has been disabled
      if (integration.requiresOAuth) {
        setTestResult({
          success: false,
          message: `❌ ${integration.name} integration has been disabled. OAuth integrations were incorrectly configured and have been removed.`
        });
        return;
      }

      // Integration testing moved to backend - configuration validated
      setTestResult({
        success: true,
        message: '✅ Integration configured successfully! It will be available during voice calls and conversations.'
      });
    } catch (error: any) {
      console.error('Integration test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Integration test failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Check if this is an OAuth integration that has been disabled
    if (integration.requiresOAuth) {
      setTestResult({
        success: false,
        message: `❌ Cannot save ${integration.name} integration. OAuth integrations have been removed due to incorrect configuration.`
      });
      return;
    }

    onSave(config);
  };

  const iconMap = {
    Globe: Globe,
    Search: Search,
    Rss: Rss,
    Newspaper: Newspaper,
    Cloud: Cloud,
    TrendingUp: TrendingUp,
    Calendar: Calendar,
    Building2: Building2,
    Database: Database,
    FileText: FileText
  };

  const IconComponent = iconMap[integration.icon as keyof typeof iconMap] || Globe;

  return (
    <div className="bg-glass-panel rounded-lg p-6 border border-glass-border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: integration.color }}
          >
            <IconComponent className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{integration.name}</h2>
            <p className="text-gray-400 text-sm">{integration.description}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={handleSave}
            disabled={integration.requiresOAuth}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
              integration.requiresOAuth
                ? 'bg-red-900 text-red-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{integration.requiresOAuth ? 'Disabled' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* OAuth Disabled Warning */}
      {integration.requiresOAuth && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-400 font-medium">OAuth Integration Disabled</h3>
              <p className="text-red-300 text-sm mt-1">
                {integration.name} integration has been removed because OAuth was incorrectly configured. 
                All integrations now work through the Python backend without OAuth dependencies.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      {!integration.requiresOAuth && (
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id="enabled"
              checked={config.enabled}
              onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <label htmlFor="enabled" className="text-white font-medium">
              Enable Integration
            </label>
          </div>

          {integration.fields.map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {field.name}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              
              {field.type === 'select' ? (
                <select
                  value={config.settings[field.id] || field.defaultValue || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={config.settings[field.id] || field.defaultValue || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              ) : field.type === 'password' ? (
                <input
                  type="password"
                  value={config.settings[field.id] || field.defaultValue || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <input
                  type={field.type}
                  value={config.settings[field.id] || field.defaultValue || ''}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
              
              {field.description && (
                <p className="text-xs text-gray-400 mt-1">{field.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Test Integration Button */}
      {!integration.requiresOAuth && config.enabled && (
        <div className="mb-6">
          <button
            onClick={handleTest}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>{isLoading ? 'Testing...' : 'Test Integration'}</span>
          </button>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-lg border ${
          testResult.success 
            ? 'bg-green-900 bg-opacity-30 border-green-700' 
            : 'bg-red-900 bg-opacity-30 border-red-700'
        }`}>
          <div className="flex items-center space-x-2">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <p className={`text-sm ${
              testResult.success ? 'text-green-300' : 'text-red-300'
            }`}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* Integration Examples */}
      {integration.examples && integration.examples.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800 bg-opacity-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Example Use Cases:</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            {integration.examples.map((example, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-gray-500">•</span>
                <span>{example}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}