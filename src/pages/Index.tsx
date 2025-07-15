import Header from "@/components/Header"
import Hero from "@/components/Hero"
import UploadSection from "@/components/UploadSection"
import LessonPlan from "@/components/LessonPlan"
import AITutor from "@/components/AITutor"

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <UploadSection />
      <LessonPlan />
      <AITutor />
    </div>
  )
}

export default Index;
