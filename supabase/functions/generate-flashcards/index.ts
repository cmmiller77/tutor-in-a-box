import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { chunks, count = 10 } = await req.json();

    let sourceChunks = chunks;

    // If no chunks provided, get random chunks from user's documents
    if (!sourceChunks || sourceChunks.length === 0) {
      const { data: userChunks, error: chunksError } = await supabase
        .from('chunks')
        .select('*')
        .eq('user_id', user.id)
        .limit(20); // Get more chunks to work with

      if (chunksError || !userChunks || userChunks.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No course material found. Please upload and process a PDF first.'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      sourceChunks = userChunks;
    }

    console.log(`Generating flashcards from ${sourceChunks.length} chunks`);

    // Combine chunks into context
    const context = sourceChunks.map((chunk: any) => chunk.text).join('\n\n');

    // Generate flashcards using GPT
    const prompt = `Based on the following course material, generate ${count} educational flashcards. Each flashcard should be a question-answer pair that tests understanding of key concepts, facts, or procedures from the material.

Requirements:
- Create clear, specific questions that test understanding
- Provide concise but complete answers
- Focus on the most important concepts and facts
- Vary the question types (definitions, applications, comparisons, etc.)
- Return the response as a JSON array with "question" and "answer" fields

Course Material:
${context}

Generate exactly ${count} flashcards in JSON format:`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator creating study flashcards. Generate flashcards that effectively test student understanding. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI chat API error: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    let flashcardsText = chatData.choices[0].message.content;

    // Clean up the response to extract JSON
    flashcardsText = flashcardsText.replace(/```json/g, '').replace(/```/g, '').trim();

    let flashcards;
    try {
      flashcards = JSON.parse(flashcardsText);
    } catch (parseError) {
      console.error('Failed to parse flashcards JSON:', parseError);
      console.log('Raw response:', flashcardsText);
      
      // Fallback: create a simple flashcard from the response
      flashcards = [{
        question: "What are the key concepts from the uploaded material?",
        answer: flashcardsText.substring(0, 500) + "..."
      }];
    }

    // Ensure flashcards is an array
    if (!Array.isArray(flashcards)) {
      flashcards = [flashcards];
    }

    // Validate flashcard format
    const validFlashcards = flashcards.filter((card: any) => 
      card && typeof card.question === 'string' && typeof card.answer === 'string'
    ).map((card: any, index: number) => ({
      id: index + 1,
      question: card.question.trim(),
      answer: card.answer.trim()
    }));

    console.log(`Generated ${validFlashcards.length} valid flashcards`);

    return new Response(JSON.stringify({ 
      flashcards: validFlashcards,
      total: validFlashcards.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-flashcards function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});