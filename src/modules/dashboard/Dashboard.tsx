import React, { useState } from 'react';
import { Bot, MessageSquare, Phone, Settings, Sparkles, Users, Zap, Brain, Database, Plus } from 'lucide-react';
import IntegrationsLibrary from '../../components/IntegrationsLibrary';
import { Integration } from '../../types/integrations';

interface DashboardProps {}

export default function Dashboard() {
  const [showIntegrationsLibrary, setShowIntegrationsLibrary] = useState(false);

  const features = [
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "Smart Conversations",
      description: "Engage with AI personas tailored to your needs"
    },
    {
      icon: <Phone className="w-5 h-5" />,
      title: "Voice Interactions",
      description: "Experience natural voice conversations with AI"
    },
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Multiple Personalities",
      description: "Choose from various AI experts and companions"
    },
    {
      icon: <Database className="w-5 h-5" />,
      title: "Data Integrations",
      description: "Connect to external APIs and data sources"
    },
    {
      icon: <Settings className="w-5 h-5" />,
      title: "Customizable",
      description: "Personalize each AI to match your preferences"
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: "Always Learning",
      description: "AI that adapts and improves with every interaction"
    }
  ];

  const stats = [
    { label: "AI Assistants", value: "6", color: "text-blue-400" },
    { label: "Active Conversations", value: "12", color: "text-green-400" },
    { label: "Messages Today", value: "47", color: "text-purple-400" },
    { label: "Integrations Available", value: "6", color: "text-orange-400" }
  ];

  const handleSelectIntegration = (integration: Integration) => {
    console.log('Selected integration:', integration);
    // This could open a modal or navigate to integration setup
  };

  if (showIntegrationsLibrary) {
    return (
      <div className="h-full bg-slate-900 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600">
                <Database className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Integrations Library</h1>
                <p className="text-slate-400 text-lg">Connect your AI agents to external data sources</p>
              </div>
            </div>
            <button
              onClick={() => setShowIntegrationsLibrary(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors duration-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Integrations Library */}
        <div className="flex-1 p-6 overflow-y-auto">
          <IntegrationsLibrary onSelectIntegration={handleSelectIntegration} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-8 border-b border-slate-700">
        <div className="flex items-center space-x-4 mb-6">
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome to Gather</h1>
            <p className="text-slate-400 text-lg">Your AI-powered communication hub</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Getting Started Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Getting Started</h2>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-start space-x-4">
                <div className="p-2 rounded-lg bg-blue-600 flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Choose Your AI Companion</h3>
                  <p className="text-slate-400 mb-4">
                    Select from our diverse range of AI personalities on the left sidebar. Each AI has unique expertise and conversation styles.
                  </p>
                  <div className="flex space-x-4">
                    <div className="flex items-center space-x-2 text-sm text-slate-300">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span>Click chat to start messaging</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-slate-300">
                      <Phone className="w-4 h-4 text-green-400" />
                      <span>Click call for voice interaction</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Integrations Preview Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Data Integrations</h2>
              <button
                onClick={() => setShowIntegrationsLibrary(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              >
                <Database className="w-4 h-4" />
                <span>Browse All Integrations</span>
              </button>
            </div>
            
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-start space-x-4 mb-6">
                <div className="p-2 rounded-lg bg-purple-600 flex-shrink-0">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Connect External Data Sources</h3>
                  <p className="text-slate-400 mb-4">
                    Enhance your AI agents with real-time data from APIs, RSS feeds, weather services, financial markets, and more.
                  </p>
                </div>
              </div>

              {/* Quick Integration Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 rounded bg-blue-600 bg-opacity-20">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <h4 className="font-medium text-white">HTTP Requests</h4>
                  </div>
                  <p className="text-slate-400 text-sm">Connect to any public API endpoint</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 rounded bg-orange-600 bg-opacity-20">
                      <MessageSquare className="w-4 h-4 text-orange-400" />
                    </div>
                    <h4 className="font-medium text-white">RSS Feeds</h4>
                  </div>
                  <p className="text-slate-400 text-sm">Subscribe to news and content feeds</p>
                </div>

                <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="p-2 rounded bg-green-600 bg-opacity-20">
                      <Brain className="w-4 h-4 text-green-400" />
                    </div>
                    <h4 className="font-medium text-white">Financial Data</h4>
                  </div>
                  <p className="text-slate-400 text-sm">Track markets and cryptocurrency</p>
                </div>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowIntegrationsLibrary(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors duration-200"
                >
                  View all 6 available integrations →
                </button>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Platform Features</h2>
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors duration-200">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-slate-700 text-blue-400 flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-slate-400 text-sm">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-4">
              <button className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105">
                <MessageSquare className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">Start New Chat</div>
                <div className="text-sm opacity-90">Begin a conversation</div>
              </button>
              <button className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4 text-white hover:from-green-700 hover:to-green-800 transition-all duration-200 transform hover:scale-105">
                <Phone className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">Make a Call</div>
                <div className="text-sm opacity-90">Voice interaction</div>
              </button>
              <button className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 text-white hover:from-purple-700 hover:to-purple-800 transition-all duration-200 transform hover:scale-105">
                <Settings className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">Customize AI</div>
                <div className="text-sm opacity-90">Personalize experience</div>
              </button>
              <button 
                onClick={() => setShowIntegrationsLibrary(true)}
                className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-lg p-4 text-white hover:from-orange-700 hover:to-orange-800 transition-all duration-200 transform hover:scale-105"
              >
                <Database className="w-6 h-6 mx-auto mb-2" />
                <div className="font-semibold">Add Integration</div>
                <div className="text-sm opacity-90">Connect data sources</div>
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}