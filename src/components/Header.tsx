import { Button } from "@/components/ui/button"
import { BookOpen, Brain } from "lucide-react"
import { Link } from "react-router-dom"

const Header = () => {
  return (
    <header className="border-b border-border/50 bg-card/60 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold heading-gradient">myTutor</span>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
            How it Works
          </Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button variant="ghost">Sign In</Button>
          <Button variant="hero" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header