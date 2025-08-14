import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, Users, Brain, TrendingUp, MessageSquare, Shield } from "lucide-react"

const TeacherFeatures = () => {
  const features = [
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Track student engagement, question patterns, and learning progress with comprehensive dashboards.",
      color: "primary"
    },
    {
      icon: MessageSquare,
      title: "Question Insights",
      description: "Identify knowledge gaps by analyzing the questions students ask their AI tutors most frequently.",
      color: "accent"
    },
    {
      icon: Users,
      title: "Class Management",
      description: "Easily deploy AI tutors across multiple classes and monitor student interactions in real-time.",
      color: "educational"
    },
    {
      icon: TrendingUp,
      title: "Performance Tracking",
      description: "Monitor learning outcomes and see measurable improvements in student comprehension rates.",
      color: "success"
    },
    {
      icon: Brain,
      title: "Adaptive Learning",
      description: "AI tutors adapt to each student's learning style while providing you with detailed insights.",
      color: "primary"
    },
    {
      icon: Shield,
      title: "Safe & Secure",
      description: "Enterprise-grade security ensures student data privacy and FERPA compliance.",
      color: "accent"
    }
  ]

  return (
    <section className="py-20 bg-gradient-to-br from-muted/30 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Brain className="w-4 h-4" />
            Powerful Teacher Tools
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Everything You Need to
            <span className="heading-gradient block">
              Enhance Learning
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get deep insights into your students' learning journey and make data-driven decisions 
            to improve educational outcomes.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <Card key={index} className="lesson-card group hover:scale-105 transition-transform duration-300">
                <div className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-${feature.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className={`w-6 h-6 text-${feature.color}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="text-center">
          <Button variant="hero" size="lg" className="group">
            Start Your Free Trial
            <TrendingUp className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  )
}

export default TeacherFeatures