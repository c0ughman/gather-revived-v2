import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Zap, Brain, Users, MessageCircle, Play, Check, Star, Globe, Shield, Infinity, Layers, Cpu, Network } from 'lucide-react';

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

  const capabilities = [
    {
      icon: Layers,
      title: "Multi-Modal Intelligence",
      description: "Process text, voice, images, and documents seamlessly",
      gradient: "from-cyan-400 via-blue-500 to-purple-600"
    },
    {
      icon: Network,
      title: "Connected Ecosystem",
      description: "Integrate with 50+ platforms and data sources",
      gradient: "from-green-400 via-emerald-500 to-teal-600"
    },
    {
      icon: Cpu,
      title: "Advanced Reasoning",
      description: "Complex problem-solving with contextual understanding",
      gradient: "from-orange-400 via-red-500 to-pink-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white overflow-hidden">
      {/* Custom CSS for animated gradient */}
      <style jsx>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-20px) rotate(1deg); }
          66% { transform: translateY(-10px) rotate(-1deg); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        @keyframes wave {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animated-gradient-text {
          background: linear-gradient(90deg, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38);
          background-size: 200% 100%;
          animation: gradientMove 8s ease-in-out infinite;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .animated-gradient-bg {
          background: linear-gradient(90deg, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38);
          background-size: 200% 100%;
          animation: gradientMove 8s ease-in-out infinite;
        }
        
        .animated-gradient-button {
          background: linear-gradient(90deg, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38);
          background-size: 200% 100%;
          animation: gradientMove 8s ease-in-out infinite;
          transition: all 0.3s ease;
        }
        
        .animated-gradient-button:hover {
          animation: gradientMove 2s ease-in-out infinite;
          box-shadow: 0 0 30px rgba(73, 72, 236, 0.6), 0 0 60px rgba(137, 75, 244, 0.4), 0 0 90px rgba(223, 84, 138, 0.3);
        }
        
        .animated-gradient-orb {
          background: linear-gradient(90deg, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38, #3435B7, #4948EC, #894BF4, #DF548A, #EB6D38);
          background-size: 200% 100%;
          animation: gradientMove 12s ease-in-out infinite;
        }
        
        .floating-element {
          animation: float 6s ease-in-out infinite;
        }
        
        .pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }
        
        .wave-effect {
          position: relative;
          overflow: hidden;
        }
        
        .wave-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          animation: wave 3s ease-in-out infinite;
        }
        
        .glass-morphism {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .gradient-blob-1 {
          background: radial-gradient(ellipse at center, #3435B7 0%, #4948EC 25%, #894BF4 50%, transparent 70%);
          filter: blur(40px);
        }
        
        .gradient-blob-2 {
          background: radial-gradient(ellipse at center, #DF548A 0%, #EB6D38 25%, #3435B7 50%, transparent 70%);
          filter: blur(60px);
        }
        
        .gradient-blob-3 {
          background: radial-gradient(ellipse at center, #894BF4 0%, #DF548A 25%, #4948EC 50%, transparent 70%);
          filter: blur(50px);
        }
      `}</style>

      {/* Enhanced Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Large gradient blobs inspired by the image */}
        <div className="absolute -top-40 -right-40 w-96 h-96 gradient-blob-1 rounded-full pulse-glow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 gradient-blob-2 rounded-full pulse-glow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] gradient-blob-3 rounded-full pulse-glow" style={{ animationDelay: '4s' }}></div>
        
        {/* Floating geometric elements */}
        <div className="absolute top-20 left-20 w-32 h-32 animated-gradient-orb rounded-full floating-element opacity-30"></div>
        <div className="absolute top-40 right-32 w-24 h-24 animated-gradient-orb rounded-full floating-element opacity-40" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 animated-gradient-orb rounded-full floating-element opacity-25" style={{ animationDelay: '3s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 animated-gradient-bg rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              Gather
            </span>
          </div>
          <button
            onClick={onGetStarted}
            className="px-6 py-3 animated-gradient-button rounded-full font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg text-white"
          >
            Get Started Free
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center space-x-2 px-4 py-2 glass-morphism rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-[#4948EC]" />
              <span className="text-sm font-medium">The future of AI collaboration is here</span>
            </div>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Your AI
              </span>
              <br />
              <span className="animated-gradient-text">
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
                className="group px-8 py-4 animated-gradient-button rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center space-x-3 text-white"
              >
                <span>Start Building Your Team</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              
              <button className="group flex items-center space-x-3 px-6 py-4 glass-morphism hover:bg-white/10 rounded-full transition-all duration-300 wave-effect">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
                <span className="font-semibold">Watch Demo</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* New Capabilities Section - Inspired by the image */}
      <section className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="animated-gradient-text">
                Powered by Intelligence
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Experience the next generation of AI capabilities designed to amplify human potential
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {capabilities.map((capability, index) => (
              <div
                key={index}
                className="relative group"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                {/* Background gradient effect inspired by the image */}
                <div className={`absolute inset-0 bg-gradient-to-r ${capability.gradient} rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500`}></div>
                
                <div className="relative glass-morphism rounded-3xl p-8 h-full transition-all duration-500 group-hover:transform group-hover:scale-105">
                  <div className={`w-16 h-16 bg-gradient-to-r ${capability.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <capability.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">{capability.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{capability.description}</p>
                  
                  {/* Decorative gradient line */}
                  <div className={`mt-6 h-1 bg-gradient-to-r ${capability.gradient} rounded-full`}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Visual representation inspired by the image */}
          <div className="relative">
            <div className="glass-morphism rounded-3xl p-12 text-center">
              <div className="relative inline-block">
                {/* Central AI core */}
                <div className="w-32 h-32 animated-gradient-bg rounded-full flex items-center justify-center mx-auto mb-8 pulse-glow">
                  <Brain className="w-16 h-16 text-white" />
                </div>
                
                {/* Surrounding capability orbs */}
                <div className="absolute -top-8 -left-8 w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center floating-element">
                  <Layers className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-8 -right-8 w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center floating-element" style={{ animationDelay: '1s' }}>
                  <Network className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center floating-element" style={{ animationDelay: '2s' }}>
                  <Cpu className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <h3 className="text-3xl font-bold text-white mb-4">
                <span className="animated-gradient-text">Unified AI Intelligence</span>
              </h3>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                All capabilities work together seamlessly, creating an AI experience that's greater than the sum of its parts
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section with Enhanced Glass Effects */}
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

          <div className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="relative group glass-morphism rounded-2xl p-8 transition-all duration-500 hover:transform hover:scale-105 wave-effect"
                style={{ animationDelay: `${index * 200}ms` }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-[#4948EC]/20 to-[#894BF4]/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <benefit.icon className="w-8 h-8 text-[#4948EC]" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white">{benefit.title}</h3>
                <p className="text-slate-400 leading-relaxed">{benefit.description}</p>
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
                className="glass-morphism rounded-2xl p-8 transition-all duration-300 hover:transform hover:scale-105 wave-effect"
              >
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
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold animated-gradient-text mb-2">
                50K+
              </div>
              <div className="text-slate-400">AI Assistants Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold animated-gradient-text mb-2">
                2M+
              </div>
              <div className="text-slate-400">Conversations</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold animated-gradient-text mb-2">
                99.9%
              </div>
              <div className="text-slate-400">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold animated-gradient-text mb-2">
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
                <span className="animated-gradient-text">
                  Nothing You Don't
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Built for professionals who demand excellence. Every feature designed to amplify your capabilities, not complicate your workflow.
              </p>
              
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-6 h-6 animated-gradient-bg rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Mock Interface */}
              <div className="glass-morphism rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 animated-gradient-bg rounded-lg"></div>
                    <div>
                      <div className="text-white font-semibold">Research Assistant</div>
                      <div className="text-slate-400 text-sm">Analyzing market trends...</div>
                    </div>
                  </div>
                  
                  <div className="glass-morphism rounded-lg p-4">
                    <div className="text-slate-300 text-sm">
                      I've analyzed 500+ sources and found 3 key opportunities in the emerging AI market...
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 animated-gradient-bg rounded-lg"></div>
                    <div>
                      <div className="text-white font-semibold">Creative Director</div>
                      <div className="text-slate-400 text-sm">Generating campaign concepts...</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-[#4948EC]/20 to-[#894BF4]/20 rounded-2xl glass-morphism flex items-center justify-center floating-element">
                <Brain className="w-8 h-8 text-[#4948EC]" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-[#894BF4]/20 to-[#DF548A]/20 rounded-xl glass-morphism flex items-center justify-center floating-element" style={{ animationDelay: '1s' }}>
                <Zap className="w-6 h-6 text-[#894BF4]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="relative z-10 py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="relative glass-morphism rounded-3xl p-12 shadow-2xl">
            {/* Background decorative gradient */}
            <div className="absolute inset-0 animated-gradient-orb rounded-3xl opacity-10"></div>
            
            <div className="relative">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  Ready to Transform
                </span>
                <br />
                <span className="animated-gradient-text">
                  How You Work?
                </span>
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Join the AI revolution. Create your first intelligent assistant in minutes, not months.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button
                  onClick={onGetStarted}
                  className="group px-8 py-4 animated-gradient-button rounded-full font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-2xl flex items-center space-x-3 text-white"
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
              <div className="w-8 h-8 animated-gradient-bg rounded-lg flex items-center justify-center">
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