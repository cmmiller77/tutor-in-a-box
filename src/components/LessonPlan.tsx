import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Play, PenTool, Target, Clock, Users } from "lucide-react"

const LessonPlan = () => {
  const lessonSections = [
    {
      title: "Key Concepts",
      icon: Target,
      items: [
        "Quantum mechanics fundamentals",
        "Wave-particle duality",
        "Uncertainty principle",
        "Quantum entanglement"
      ]
    },
    {
      title: "Video Tutorials",
      icon: Play,
      items: [
        "Introduction to Quantum Physics (15 min)",
        "Double-slit Experiment Explained (12 min)",
        "Schrödinger's Cat Paradox (8 min)"
      ]
    },
    {
      title: "Practice Questions",
      icon: PenTool,
      items: [
        "Calculate de Broglie wavelength",
        "Analyze quantum tunneling scenarios",
        "Solve uncertainty principle problems"
      ]
    }
  ]

  return (
    <section className="py-16 bg-gradient-to-r from-background to-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold heading-gradient mb-4">
              Generated Lesson Plan
            </h2>
            <p className="text-lg text-muted-foreground">
              AI-crafted learning path based on your uploaded materials
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card className="lesson-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Estimated Time</h3>
                  <p className="text-sm text-muted-foreground">2-3 hours</p>
                </div>
              </div>
            </Card>

            <Card className="lesson-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-educational/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-educational" />
                </div>
                <div>
                  <h3 className="font-semibold">Difficulty Level</h3>
                  <Badge variant="secondary">Intermediate</Badge>
                </div>
              </div>
            </Card>

            <Card className="lesson-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Learning Style</h3>
                  <p className="text-sm text-muted-foreground">Visual & Interactive</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {lessonSections.map((section, index) => (
              <Card key={index} className="lesson-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <section.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{section.title}</h3>
                </div>

                <div className="space-y-3">
                  {section.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>

                <Button variant="educational" className="w-full mt-6">
                  Start {section.title}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default LessonPlan