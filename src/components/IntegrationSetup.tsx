import React, { useState } from 'react';
import { Save, X, Play, AlertCircle, CheckCircle, Globe, Rss, Newspaper, Cloud, TrendingUp, Calendar, Building2, Database, FileText } from 'lucide-react';
import { Integration, IntegrationConfig, IntegrationField } from '../types/integrations';
import { integrationsService } from '../services/integrationsService';
import OAuthConnect from './OAuthConnect';
import { useAuth } from '../hooks/useAuth';

interface IntegrationSetupProps {
  integration: Integration;
  existingConfig?: IntegrationConfig;
  onSave: (config: IntegrationConfig) => void;
  onCancel: () => void;
  className?: string;
}

const iconMap = {
  Globe,
  Rss,
  Newspaper,
  Cloud,
  TrendingUp,
  Calendar,
  Building2,
  Database,
  FileText
};

const triggerOptions = [
  { value: 'chat-start', label: 'On Chat Start', description: 'Fetch data when conversation begins' },
  { value: 'periodic', label: 'Periodic', description: 'Fetch data at regular intervals' },
  { value: 'both', label: 'Both', description: 'Fetch on chat start and periodically' }
];

const intervalOptions = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 360, label: '6 hours' },
  { value: 720, label: '12 hours' },
  { value: 1440, label: '24 hours' }
];

export default function IntegrationSetup({ integration, existingConfig, onSave, onCancel, className = '' }: IntegrationSetupProps) {
  const { user } = useAuth();
  const [config, setConfig] = useState<IntegrationConfig>({
    integrationId: integration.id,
    enabled: existingConfig?.enabled ?? true,
    settings: existingConfig?.settings ?? {},
    trigger: existingConfig?.trigger ?? 'chat-start',
    intervalMinutes: existingConfig?.intervalMinutes ?? 30,
    description: existingConfig?.description ?? '',
    oauthTokenId: existingConfig?.oauthTokenId,
    oauthConnected: existingConfig?.oauthConnected ?? false
  });

  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const IconComponent = iconMap[integration.icon as keyof typeof iconMap] || Database;

  const handleFieldChange = (fieldId: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [fieldId]: value
      }
    }));
  };

  const handleConfigChange = (field: keyof IntegrationConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleOAuthSuccess = (tokenId: string) => {
    console.log('OAuth connection successful, token ID:', tokenId);
    setConfig(prev => ({
      ...prev,
      oauthTokenId: tokenId,
      oauthConnected: true
    }));
  };

  const handleOAuthError = (error: string) => {
    console.error('OAuth connection failed:', error);
    setTestResult({
      success: false,
      message: `OAuth connection failed: ${error}`
    });
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // For OAuth integrations, check if connected first
      if (integration.requiresOAuth && !config.oauthConnected) {
        setTestResult({
          success: false,
          message: 'Please connect your account first using the OAuth button above.'
        });
        return;
      }

      const result = await integrationsService.executeIntegration(integration, config);
      setTestResult({
        success: true,
        message: 'Integration test successful!',
        data: result
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error.message || error}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    // For OAuth integrations, ensure connection is established
    if (integration.requiresOAuth && !config.oauthConnected) {
      setTestResult({
        success: false,
        message: 'Please connect your account first using the OAuth button.'
      });
      return;
    }

    onSave(config);
  };

  const renderField = (field: IntegrationField) => {
    const value = config.settings[field.id] || field.defaultValue || '';

    switch (field.type) {
      case 'text':
      case 'url':
      case 'number':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm"
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 resize-none text-sm"
            required={field.required}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm"
            required={field.required}
          >
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: integration.color + '20', color: integration.color }}
            >
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{integration.name}</h2>
              <p className="text-slate-400 text-sm">{integration.description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-slate-700 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* OAuth Connection - Show first if required */}
        {integration.requiresOAuth && (
          <div>
            <label className="block text-xs font-medium text-white mb-2">
              Account Connection
              <span className="text-red-400 ml-1">*</span>
            </label>
            <OAuthConnect
              provider={integration.oauthProvider || integration.id}
              clientId={config.settings.clientId || ''}
              clientSecret={config.settings.clientSecret || ''}
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
            />
            <p className="text-slate-400 text-xs mt-1">
              Connect your {integration.name} account to enable this integration
            </p>
          </div>
        )}

        {/* Integration Fields */}
        {integration.fields.map(field => (
          <div key={field.id}>
            <label className="block text-xs font-medium text-white mb-2">
              {field.name}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            {renderField(field)}
            {field.description && (
              <p className="text-slate-400 text-xs mt-1">{field.description}</p>
            )}
          </div>
        ))}

        {/* Trigger Configuration - Only for source integrations */}
        {integration.category === 'source' && (
          <div>
            <label className="block text-xs font-medium text-white mb-2">
              Execution Trigger
            </label>
            <div className="space-y-2">
              {triggerOptions.map(option => (
                <label key={option.value} className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="trigger"
                    value={option.value}
                    checked={config.trigger === option.value}
                    onChange={(e) => handleConfigChange('trigger', e.target.value)}
                    className="mt-0.5 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-white font-medium text-sm">{option.label}</div>
                    <div className="text-slate-400 text-xs">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Interval Configuration - Only for periodic triggers */}
        {integration.category === 'source' && (config.trigger === 'periodic' || config.trigger === 'both') && (
          <div>
            <label className="block text-xs font-medium text-white mb-2">
              Execution Interval
            </label>
            <select
              value={config.intervalMinutes}
              onChange={(e) => handleConfigChange('intervalMinutes', parseInt(e.target.value))}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 text-sm"
            >
              {intervalOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-white mb-2">
            Description
          </label>
          <textarea
            value={config.description}
            onChange={(e) => handleConfigChange('description', e.target.value)}
            placeholder="Describe how this integration will be used..."
            rows={2}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none transition-colors duration-200 resize-none text-sm"
          />
        </div>

        {/* Test Results */}
        {testResult && (
          <div className={`p-3 rounded-lg border ${
            testResult.success 
              ? 'border-green-700 bg-green-900 bg-opacity-20' 
              : 'border-red-700 bg-red-900 bg-opacity-20'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className={`font-medium text-sm ${
                testResult.success ? 'text-green-300' : 'text-red-300'
              }`}>
                {testResult.message}
              </span>
            </div>
            {testResult.success && testResult.data && (
              <div className="mt-2">
                <p className="text-slate-300 text-xs mb-1">Preview:</p>
                <pre className="text-xs text-slate-400 bg-slate-800 p-2 rounded overflow-x-auto">
                  {JSON.stringify(testResult.data, null, 2).substring(0, 300)}
                  {JSON.stringify(testResult.data, null, 2).length > 300 ? '...' : ''}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700">
          <button
            onClick={handleTest}
            disabled={isTesting || (integration.requiresOAuth && !config.oauthConnected)}
            className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm"
          >
            <Play className="w-3 h-3" />
            <span>{isTesting ? 'Testing...' : 'Test'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 text-sm"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}