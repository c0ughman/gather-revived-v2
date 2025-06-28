import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Zap, Brain, Users, MessageCircle, Play, Check, Star, Globe, Shield, Infinity } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const testimonials = [
    {
      quote: "Gather transformed how I work. My AI assistants handle research, analysis, and creative tasks while I focus on strategy.",
      author: "Sarah Chen",
      role: "Product Director",
      company: "TechFlow",
      rating: 5
    },
    {
      quote: "The integration capabilities are incredible. My AI pulls data from everywhere and gives me insights I never had before.",
      author: "Marcus Rodriguez",
      role: "Data Scientist",
      company: "Insight Labs",
      rating: 5
    },
    {
      quote: "It's like having a team of specialists available 24/7. Each AI has its own expertise and personality.",
      author: "Emma Thompson",
      role: "Creative Director",
      company: "Studio Bright",
      rating: 5
    }
  ];

  const benefits = [
    {
      icon: Brain,
      title: "Amplify Your Intelligence",
      description: "Create specialized AI assistants that think alongside you, each with unique expertise and personality."
    },
    {
      icon: Zap,
      title: "Instant Access to Everything",
      description: "Connect your tools, data, and workflows. Your AI assistants know what you know, when you need it."
    },
    {
      icon: Users,
      title: "Scale Your Capabilities",
      description: "Why hire when you can create? Build a team of AI specialists that work around the clock."
    },
    {
      icon: Infinity,
      title: "Limitless Possibilities",
      description: "From research to analysis, creative work to data processing - your AI team handles it all."
    }
  ];

  const features = [
    "Personalized AI assistants with unique personalities",
    "Real-time data integration from 50+ sources",
    "Voice conversations with natural speech",
    "Document analysis and knowledge management",
    "Custom workflows and automation",
    "Enterprise-grade security and privacy"
  ];

  return (
    <div className="min-h-screen bg-[#0a0118] text-white overflow-hidden relative">
      {/* Enhanced Background with New Gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main gradient background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, #e0f7ff, #ec38bc, #7303c0, #0a0118)'
          }}
        />
        
        {/* Animated floating elements for glass backing */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-purple-600/30 rounded-full blur-3xl animate-pulse opacity-40"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-tr from-pink-400/30 to-blue-600/30 rounded-full blur-3xl animate-pulse opacity-40" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse opacity-30" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-1/3 left-1/4 w-72 h-72 bg-gradient-to-br from-blue-400/25 to-purple-500/25 rounded-full blur-3xl animate-pulse opacity-35" style={{ animationDelay: '6s' }}></div>
        
        {/* Additional backing elements */}
        <div className="absolute top-40 right-1/3 w-48 h-48 bg-gradient-to-bl from-cyan-300/20 to-pink-400/20 rounded-full blur-2xl animate-pulse opacity-50" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-40 left-1/2 w-56 h-56 bg-gradient-to-tr from-purple-400/25 to-cyan-400/25 rounded-full blur-2xl animate-pulse opacity-45" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Dark overlay for better contrast */}
      <div className="fixed inset-0 bg-[#0a0118]/60 pointer-events-none"></div>

      {/* Navigation */}
      <nav className="relative z-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Gather
            </span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-700 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium">The future of AI collaboration is here</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Your AI
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-400 bg-clip-text text-transparent">
                Dream Team
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Stop switching between tools. Stop waiting for answers. Create specialized AI assistants that know your work, 
              understand your goals, and deliver results that matter.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={onGetStarted}
                className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-700 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl flex items-center space-x-3"
              >
                <span>Start Building Your Team</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              
              <button className="group flex items-center space-x-3 px-6 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-full border border-white/20 hover:border-white/40 transition-all duration-300">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
                <span className="font-semibold">Watch Demo</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Why Settle for Less?
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              While others offer chatbots, we deliver intelligent companions that transform how you think, work, and create.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="group relative"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {/* Backing element for glass effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-purple-600/20 rounded-2xl blur-xl transform group-hover:scale-110 transition-transform duration-500 opacity-60"></div>
                
                <div className="relative p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 hover:transform hover:scale-105">
                  <div className="w-16 h-16 bg-gradient-to-br from-cyan-400/20 to-purple-600/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <benefit.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-white">{benefit.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Trusted by Innovators
              </span>
            </h2>
            <p className="text-xl text-slate-400">
              Join thousands of professionals who've transformed their workflow
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="relative group"
              >
                {/* Backing element for glass effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-pink-400/15 to-cyan-400/15 rounded-2xl blur-lg transform group-hover:scale-105 transition-transform duration-300 opacity-70"></div>
                
                <div className="relative p-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-lg text-slate-300 mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </blockquote>
                  <div>
                    <div className="font-semibold text-white">{testimonial.author}</div>
                    <div className="text-sm text-slate-400">{testimonial.role} at {testimonial.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-2">
                50K+
              </div>
              <div className="text-slate-400">AI Assistants Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-2">
                2M+
              </div>
              <div className="text-slate-400">Conversations</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-2">
                99.9%
              </div>
              <div className="text-slate-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent mb-2">
                4.9★
              </div>
              <div className="text-slate-400">User Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8">
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Everything You Need,
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                  Nothing You Don't
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Built for professionals who demand excellence. Every feature designed to amplify your capabilities, not complicate your workflow.
              </p>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-cyan-400 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Backing element for mock interface */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-purple-600/20 rounded-3xl blur-2xl transform scale-110 opacity-60"></div>
              
              {/* Mock Interface */}
              <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 p-8 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-lg"></div>
                    <div>
                      <div className="text-white font-semibold">Research Assistant</div>
                      <div className="text-slate-400 text-sm">Analyzing market trends...</div>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-slate-300 text-sm">
                      I've analyzed 500+ sources and found 3 key opportunities in the emerging AI market...
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg"></div>
                    <div>
                      <div className="text-white font-semibold">Creative Director</div>
                      <div className="text-slate-400 text-sm">Generating campaign concepts...</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-cyan-400/20 to-purple-600/20 rounded-2xl backdrop-blur-sm border border-white/10 flex items-center justify-center">
                <Brain className="w-8 h-8 text-cyan-400" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl backdrop-blur-sm border border-white/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative">
            {/* Enhanced backing element for CTA */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/25 to-purple-600/25 rounded-3xl blur-2xl transform scale-110 opacity-80"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-400/15 to-blue-400/15 rounded-3xl blur-xl transform scale-105 opacity-60"></div>
            
            <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl border border-white/20 p-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Ready to Transform
                </span>
                <br />
                <span className="bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
                  How You Work?
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Join the AI revolution. Create your first intelligent assistant in minutes, not months.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button
                  onClick={onGetStarted}
                  className="group px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-700 rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-3xl flex items-center space-x-3"
                >
                  <span>Start Your Free Trial</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </button>
                
                <div className="text-slate-400 text-sm">
                  No credit card required • 14-day free trial
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-16 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Gather
              </span>
            </div>
            
            <div className="flex items-center space-x-8 text-slate-400">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Enterprise Security</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span className="text-sm">Global Infrastructure</span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-slate-500 text-sm">
            © 2024 Gather AI. All rights reserved. Built for the future of work.
          </div>
        </div>
      </footer>
    </div>
  );
}