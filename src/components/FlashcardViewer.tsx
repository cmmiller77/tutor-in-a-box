import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Loader2, RotateCcw, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface Flashcard {
  id: number
  question: string
  answer: string
}

const FlashcardViewer = () => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const { toast } = useToast()

  const generateFlashcards = async () => {
    try {
      setLoading(true)
      
      // Get the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Please sign in to generate flashcards')
      }

      const response = await supabase.functions.invoke('generate-flashcards', {
        body: JSON.stringify({ count: 10 }),
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate flashcards')
      }

      const result = response.data
      setFlashcards(result.flashcards)
      setCurrentIndex(0)
      setShowAnswer(false)

      toast({
        title: "Flashcards generated",
        description: `Created ${result.total} flashcards from your course material.`,
      })

    } catch (error) {
      console.error('Error generating flashcards:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate flashcards",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setShowAnswer(false)
    }
  }

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setShowAnswer(false)
    }
  }

  const toggleAnswer = () => {
    setShowAnswer(!showAnswer)
  }

  const resetCards = () => {
    setCurrentIndex(0)
    setShowAnswer(false)
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <BookOpen className="w-8 h-8 text-primary" />
          <h2 className="text-3xl font-bold heading-gradient">Flashcards</h2>
        </div>
        <p className="text-lg text-muted-foreground">
          Study with AI-generated flashcards based on your course material
        </p>
      </div>

      {flashcards.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <div className="text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-4">No flashcards generated yet. Create flashcards from your uploaded PDF!</p>
            </div>
            <Button onClick={generateFlashcards} disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Flashcards...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Generate Flashcards
                </>
              )}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="px-3 py-1">
              Card {currentIndex + 1} of {flashcards.length}
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetCards}>
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={generateFlashcards} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4 mr-1" />
                )}
                New Set
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
            />
          </div>

          {/* Flashcard */}
          <Card className="min-h-[400px] relative overflow-hidden">
            <div className="p-8 h-full flex flex-col">
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-center space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Question:</h3>
                    <p className="text-lg leading-relaxed">{currentCard?.question}</p>
                  </div>
                  
                  {showAnswer && (
                    <div className="space-y-4 border-t pt-6">
                      <h3 className="text-xl font-semibold text-green-600">Answer:</h3>
                      <p className="text-lg leading-relaxed text-muted-foreground">
                        {currentCard?.answer}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card controls */}
              <div className="flex items-center justify-between pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={prevCard} 
                  disabled={currentIndex === 0}
                >
                  Previous
                </Button>
                
                <Button 
                  onClick={toggleAnswer}
                  variant={showAnswer ? "secondary" : "default"}
                  className="px-6"
                >
                  {showAnswer ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide Answer
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show Answer
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={nextCard} 
                  disabled={currentIndex === flashcards.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {/* Quick navigation */}
          <div className="flex flex-wrap gap-2 justify-center">
            {flashcards.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index)
                  setShowAnswer(false)
                }}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  index === currentIndex 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FlashcardViewer