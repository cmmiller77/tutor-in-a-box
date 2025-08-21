import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { MessageSquare, Loader2, Send } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface Source {
  id: number
  source_file: string
  page_number: number
  chunk_id: string
}

interface QAResult {
  answer: string
  sources: Source[]
  query: string
}

interface AITutorProps {
  classId?: string
}

const AITutor = ({ classId }: AITutorProps) => {
  const [question, setQuestion] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState<QAResult[]>([])
  const { toast } = useToast()

  const askQuestion = async (retryCount = 0) => {
    if (!question.trim()) {
      toast({
        title: "Please enter a question",
        description: "Type your question about the uploaded course material.",
        variant: "destructive",
      })
      return
    }

    const currentQuestion = question
    
    try {
      setLoading(true)
      
      // Get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please sign in to ask questions')
      }

      const response = await supabase.functions.invoke('ask', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { 
          query: currentQuestion,
          class_id: classId 
        }
      })

      console.log('Function response error:', response.error)

      if (response.error) {
        // Handle specific error messages
        const errorMessage = response.error.message || 'Failed to get answer'
        if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
          throw new Error('Authentication failed. Please sign in again.')
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          throw new Error('Too many requests. Please wait a moment and try again.')
        } else if (errorMessage.includes('server') || errorMessage.includes('500')) {
          // Server error - retry once
          if (retryCount === 0) {
            console.log('Server error, retrying...')
            await new Promise(resolve => setTimeout(resolve, 2000))
            return askQuestion(1)
          }
          throw new Error('Server error. Please try again later.')
        }
        throw new Error(errorMessage)
      }

      const result = response.data as QAResult
      setConversation(prev => [...prev, result])
      setQuestion("")

      toast({
        title: "Question answered",
        description: "Check the response below.",
      })

    } catch (error) {
      console.error('Error asking question:', error)
      
      // Keep the question on error so user doesn't lose it
      if (question !== currentQuestion) {
        setQuestion(currentQuestion)
      }
      
      // Network/transport error - retry once
      if (retryCount === 0 && (error instanceof TypeError || error.message.includes('fetch'))) {
        console.log('Network error, retrying...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        return askQuestion(1)
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get answer",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = () => askQuestion(0)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAskQuestion()
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <MessageSquare className="w-8 h-8 text-primary" />
          <h2 className="text-3xl font-bold heading-gradient">Experience AI Tutoring</h2>
        </div>
        <p className="text-lg text-muted-foreground">
          See how students interact with AI tutors and the insights you'll gain as an educator
        </p>
      </div>

      {/* Question Input */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Try: 'Explain quantum superposition in simple terms'"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="flex-1"
            />
            <Button 
              onClick={handleAskQuestion} 
              disabled={loading || !question.trim()}
              size="icon"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            This is how students will interact with their AI tutor. All questions are tracked for your analytics.
          </p>
        </div>
      </Card>

      {/* Conversation History */}
      <div className="space-y-6">
        {conversation.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Try asking a sample question to see how the AI tutor responds and generates insights!</p>
            </div>
          </Card>
        ) : (
          conversation.map((qa, index) => (
            <div key={index} className="space-y-4">
              {/* Question */}
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-muted-foreground mb-1">You asked:</p>
                    <p className="text-foreground">{qa.query}</p>
                  </div>
                </div>
              </Card>

              {/* Answer */}
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <MessageSquare className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-muted-foreground mb-1">AI Tutor:</p>
                    <div className="text-foreground whitespace-pre-wrap mb-4">{qa.answer}</div>
                    
                    {qa.sources.length > 0 && (
                      <div className="border-t pt-4">
                        <p className="font-medium text-sm text-muted-foreground mb-2">Sources:</p>
                        <div className="space-y-1">
                          {qa.sources.map((source) => (
                            <div key={source.id} className="text-xs text-muted-foreground bg-muted p-2 rounded">
                              📄 {source.source_file} (Page {source.page_number})
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default AITutor