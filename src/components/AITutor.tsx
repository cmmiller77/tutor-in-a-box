import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Send, MessageCircle, Sparkles } from "lucide-react"
import tutorIcon from "@/assets/tutor-icon.jpg"

const AITutor = () => {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "ai" as const,
      content: "Hello! I'm your AI tutor for Quantum Physics. I've analyzed your course materials and I'm ready to help you understand any concepts. What would you like to explore first?",
      timestamp: "2 minutes ago"
    },
    {
      id: 2,
      type: "user" as const,
      content: "Can you explain wave-particle duality in simple terms?",
      timestamp: "1 minute ago"
    },
    {
      id: 3,
      type: "ai" as const,
      content: "Great question! Wave-particle duality means that light and matter can behave both like waves and particles, depending on how we observe them. Think of it like this: imagine you're looking at water - sometimes you see individual droplets (particles), other times you see flowing waves. Electrons and photons work similarly! Would you like me to explain the famous double-slit experiment that demonstrates this?",
      timestamp: "Just now"
    }
  ])

  const handleSendMessage = () => {
    if (message.trim()) {
      // Add user message
      const newMessage = {
        id: messages.length + 1,
        type: "user" as const,
        content: message,
        timestamp: "Just now"
      }
      setMessages([...messages, newMessage])
      setMessage("")
      
      // Simulate AI response
      setTimeout(() => {
        const aiResponse = {
          id: messages.length + 2,
          type: "ai" as const,
          content: "That's an excellent question! Let me break that down for you based on your course materials...",
          timestamp: "Just now"
        }
        setMessages(prev => [...prev, aiResponse])
      }, 1000)
    }
  }

  const suggestedQuestions = [
    "Explain quantum entanglement",
    "What is Schrödinger's equation?",
    "How does quantum tunneling work?",
    "Practice problems for uncertainty principle"
  ]

  return (
    <section className="py-16 bg-gradient-to-bl from-accent/5 to-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={tutorIcon} alt="AI Tutor" className="w-16 h-16 rounded-full" />
              <div>
                <h2 className="text-3xl md:text-4xl font-bold heading-gradient">
                  Your AI Tutor
                </h2>
                <p className="text-lg text-muted-foreground">
                  Ask me anything about your course materials
                </p>
              </div>
            </div>
          </div>

          <Card className="lesson-card mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Physics Expert Mode</h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
            </div>

            <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.type === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`p-4 rounded-lg max-w-[80%] ${
                      msg.type === 'user'
                        ? 'bg-primary text-primary-foreground ml-auto'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-2">{msg.timestamp}</p>
                  </div>
                  {msg.type === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium">You</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Ask your AI tutor anything..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button variant="hero" onClick={handleSendMessage}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">Suggested Questions</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {suggestedQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-left p-4 h-auto hover:bg-primary/5 hover:border-primary/30"
                  onClick={() => setMessage(question)}
                >
                  <MessageCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="text-sm">{question}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AITutor