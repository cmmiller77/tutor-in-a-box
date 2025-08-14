import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Users, MessageCircle, Clock, Brain, Target } from "lucide-react"

const DataInsights = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-background to-primary/5">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Brain className="w-4 h-4" />
              Learning Analytics Dashboard
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
              Turn Student Questions into
              <span className="heading-gradient block">
                Teaching Insights
              </span>
            </h2>
            
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Every question students ask their AI tutor becomes valuable data. Identify struggling concepts, 
              track learning progress, and adapt your teaching methods based on real student needs.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground">Track learning progress in real-time</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-accent" />
                </div>
                <span className="text-foreground">Analyze question patterns and difficulty levels</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-educational/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-educational" />
                </div>
                <span className="text-foreground">Identify knowledge gaps before they impact grades</span>
              </div>
            </div>
          </div>

          <div className="relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-primary/20 rounded-3xl blur-3xl animate-glow" />
            <Card className="relative lesson-card p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Class Analytics Overview</h3>
                  <Badge variant="secondary">Live Data</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Active Students</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">24/28</div>
                  </div>
                  <div className="bg-accent/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageCircle className="w-4 h-4 text-accent" />
                      <span className="text-sm text-muted-foreground">Questions Today</span>
                    </div>
                    <div className="text-2xl font-bold text-accent">156</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Quantum Mechanics</span>
                    <span className="text-sm text-muted-foreground">42 questions</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: "85%" }} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Wave Functions</span>
                    <span className="text-sm text-muted-foreground">28 questions</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-accent h-2 rounded-full" style={{ width: "65%" }} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Uncertainty Principle</span>
                    <span className="text-sm text-muted-foreground">19 questions</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-educational h-2 rounded-full" style={{ width: "45%" }} />
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Last updated 2 minutes ago</span>
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

export default DataInsights