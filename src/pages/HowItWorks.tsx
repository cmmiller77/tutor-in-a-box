import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, Upload, Brain, BookOpen, Target, CheckCircle } from "lucide-react"

const HowItWorks = () => {
  const steps = [
    {
      step: "01",
      title: "Upload Your Materials",
      description: "Simply drag and drop your course documents, PDFs, notes, or any study material. Grad.ai supports all major file formats.",
      icon: Upload,
      color: "text-primary"
    },
    {
      step: "02", 
      title: "AI Analysis & Processing",
      description: "Our advanced AI analyzes your content, extracting key concepts, creating structured lessons, and understanding your learning needs.",
      icon: Brain,
      color: "text-accent"
    },
    {
      step: "03",
      title: "Personalized Learning Plan",
      description: "Get a customized study plan with interactive lessons, practice questions, and progress tracking tailored to your learning style.",
      icon: Target,
      color: "text-educational"
    },
    {
      step: "04",
      title: "Interactive Tutoring",
      description: "Chat with your AI tutor 24/7, ask questions, get explanations, and receive instant feedback on your understanding.",
      icon: BookOpen,
      color: "text-success"
    }
  ]

  const features = [
    "Smart content extraction and organization",
    "Adaptive learning algorithms", 
    "Real-time Q&A with AI tutor",
    "Progress tracking and analytics",
    "Multi-format file support",
    "Personalized study schedules"
  ]

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-8 h-8 text-primary" />
              <span className="text-2xl font-bold heading-gradient">Grad.ai</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </a>
            <span className="text-foreground font-medium">How it Works</span>
            <a href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost">Sign In</Button>
            <Button variant="hero">Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Target className="w-4 h-4" />
            Simple 4-Step Process
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            How <span className="heading-gradient">Grad.ai</span> Works
          </h1>
          
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Transform any course material into a personalized AI tutor in just 4 simple steps. 
            No technical knowledge required - just upload and start learning.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            {steps.map((step, index) => (
              <Card key={step.step} className="p-8 lesson-card group hover:shadow-lg transition-all duration-300">
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
                      <step.icon className={`w-8 h-8 ${step.color}`} />
                    </div>
                    <div className="text-sm font-bold text-muted-foreground">{step.step}</div>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </div>
                
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-8 top-1/2 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-accent/5 to-primary/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Powerful Features Included
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every feature is designed to enhance your learning experience and help you achieve your academic goals faster.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3 p-4 bg-card rounded-lg">
                <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                <span className="text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of educators who are already improving learning outcomes with Grad.ai.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="group">
              Start Learning Now
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HowItWorks