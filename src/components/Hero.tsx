import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, BookOpen, Brain, Target } from "lucide-react"
import heroImage from "@/assets/hero-image.jpg"

const Hero = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-background via-primary/5 to-accent/10">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Brain className="w-4 h-4" />
              AI-Powered Education Platform
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6 text-shadow">
              Transform Your
              <span className="heading-gradient block">
                Classroom
              </span>
              with AI Tutors
            </h1>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Deploy AI tutors for your classes and gain valuable insights into student learning. 
              Track question patterns, identify knowledge gaps, and improve outcomes with real-time data. 
              Empower your teaching with intelligent analytics that help every student succeed.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button variant="hero" size="lg" className="group">
                Start Teaching with AI
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg">
                See Teacher Dashboard
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">Active Classrooms</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">85%</div>
                <div className="text-sm text-muted-foreground">Improved Outcomes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-educational">Real-time</div>
                <div className="text-sm text-muted-foreground">Learning Analytics</div>
              </div>
            </div>
          </div>

          <div className="relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl animate-glow" />
            <Card className="relative lesson-card overflow-hidden">
              <img 
                src={heroImage} 
                alt="AI Learning Platform" 
                className="w-full h-80 object-cover rounded-xl"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-xl" />
              
              <div className="absolute bottom-6 left-6 right-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs text-white font-medium">AI</div>
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-white" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-educational flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-white text-sm font-medium">
                    Active Learning Session
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-white text-sm">
                    "What concepts are students struggling with most?"
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-white/80 text-xs">Analyzing student questions...</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero