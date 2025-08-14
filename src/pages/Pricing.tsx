import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Brain, Check, Zap, Crown, Users } from "lucide-react"

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      description: "Perfect for trying out Grad.ai",
      icon: Brain,
      color: "text-muted-foreground",
      bgColor: "bg-card",
      features: [
        "Upload up to 3 documents",
        "Basic AI tutoring sessions",
        "Standard processing speed",
        "Community support",
        "Basic progress tracking"
      ],
      limitations: [
        "Limited to 10 questions per day",
        "Basic explanations only"
      ],
      cta: "Get Started Free",
      variant: "outline" as const
    },
    {
      name: "Student",
      price: "$9.99",
      period: "/month",
      description: "Ideal for individual learners",
      icon: Zap,
      color: "text-primary",
      bgColor: "bg-primary/5",
      badge: "Most Popular",
      features: [
        "Upload unlimited documents",
        "Advanced AI tutoring",
        "Priority processing speed", 
        "Email support",
        "Detailed progress analytics",
        "Custom study schedules",
        "Export study materials"
      ],
      cta: "Start 7-Day Free Trial",
      variant: "hero" as const
    },
    {
      name: "Pro",
      price: "$24.99", 
      period: "/month",
      description: "For serious students and professionals",
      icon: Crown,
      color: "text-accent",
      bgColor: "bg-accent/5",
      features: [
        "Everything in Student plan",
        "AI-generated practice tests",
        "Advanced content analysis",
        "Priority support",
        "Collaboration features",
        "API access",
        "White-label options",
        "Advanced integrations"
      ],
      cta: "Upgrade to Pro",
      variant: "educational" as const
    },
    {
      name: "Institution",
      price: "Custom",
      description: "For schools and organizations", 
      icon: Users,
      color: "text-educational",
      bgColor: "bg-educational/5",
      features: [
        "Everything in Pro plan",
        "Unlimited users",
        "Admin dashboard",
        "Custom integrations",
        "Dedicated support",
        "Training & onboarding",
        "SLA guarantees",
        "Custom AI models"
      ],
      cta: "Contact Sales",
      variant: "outline" as const
    }
  ]

  const faqs = [
    {
      question: "How does the AI tutoring work?",
      answer: "Our AI analyzes your uploaded materials and creates a personalized learning experience. It can answer questions, provide explanations, and adapt to your learning style in real-time."
    },
    {
      question: "What file formats are supported?",
      answer: "Grad.ai supports PDF, DOCX, TXT, PPTX, and many other common document formats. Our AI can extract text and understand content from most educational materials."
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Yes, you can cancel your subscription at any time. You'll continue to have access to your plan features until the end of your billing period."
    },
    {
      question: "Is there a free trial available?",
      answer: "Yes! We offer a 7-day free trial for our Student plan, and our Starter plan is completely free forever with basic features."
    }
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
            <a href="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How it Works
            </a>
            <span className="text-foreground font-medium">Pricing</span>
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
            <Crown className="w-4 h-4" />
            Flexible Pricing Plans
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Choose Your <span className="heading-gradient">Learning Journey</span>
          </h1>
          
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start free and scale as you grow. Every plan includes our core AI tutoring features 
            with different limits and advanced capabilities.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
            {plans.map((plan, index) => (
              <Card key={plan.name} className={`p-8 lesson-card relative ${plan.bgColor} ${plan.name === 'Student' ? 'scale-105 border-primary shadow-xl' : ''}`}>
                {plan.badge && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                    {plan.badge}
                  </Badge>
                )}
                
                <div className="text-center mb-8">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-4`}>
                    <plan.icon className={`w-8 h-8 ${plan.color}`} />
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                  
                  {plan.limitations && plan.limitations.map((limitation, limitIndex) => (
                    <div key={limitIndex} className="flex items-start gap-3 text-muted-foreground">
                      <div className="w-5 h-5 flex-shrink-0 mt-0.5 text-center">•</div>
                      <span className="text-sm">{limitation}</span>
                    </div>
                  ))}
                </div>

                <Button variant={plan.variant} className="w-full group">
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gradient-to-br from-accent/5 to-primary/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Got questions? We've got answers. If you can't find what you're looking for, feel free to contact our support team.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <Card key={index} className="p-6">
                <h3 className="font-semibold mb-3">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Learning?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of educators who are already improving learning outcomes with Grad.ai.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="lg" className="group">
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Pricing