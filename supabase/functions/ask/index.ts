import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== ASK FUNCTION DEBUG START ===');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('Missing OpenAI API key');
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
      console.log('Missing authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Auth header present, verifying user...');
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.log('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    let query;
    try {
      console.log('Attempting to parse request body...');
      const body = await req.json();
      console.log('Parsed body:', body);
      query = body.query;
    } catch (jsonError) {
      console.log('JSON parsing failed:', jsonError.message);
      try {
        const textBody = await req.text();
        console.log('Text body:', textBody);
        const parsedBody = JSON.parse(textBody);
        console.log('Parsed from text:', parsedBody);
        query = parsedBody.query;
      } catch (textError) {
        console.log('Text parsing also failed:', textError.message);
        return new Response(JSON.stringify({ error: 'Invalid request body format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing query:', query);

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Perform vector similarity search
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'match_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        user_id: user.id
      }
    );

    if (searchError) {
      console.error('Vector search error:', searchError);
      // Fallback to a simple text search if vector search fails
      const { data: fallbackChunks, error: fallbackError } = await supabase
        .from('chunks')
        .select('*')
        .eq('user_id', user.id)
        .textSearch('text', query)
        .limit(5);

      if (fallbackError) {
        throw new Error('Failed to search chunks');
      }

      console.log('Using fallback search, found chunks:', fallbackChunks?.length || 0);
    }

    const chunks = similarChunks || [];
    console.log('Found relevant chunks:', chunks.length);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ 
        answer: "I don't have enough information in your uploaded documents to answer this question. Please upload relevant course materials first.",
        sources: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create context from relevant chunks
    const context = chunks.map((chunk: any, index: number) => 
      `[Source ${index + 1} - ${chunk.source_file}, Page ${chunk.page_number}]:\n${chunk.text}`
    ).join('\n\n');

    // Generate answer using GPT
    const prompt = `Based on the following course material excerpts, answer the user's question. Be specific and reference the sources when possible.

Context from course materials:
${context}

User Question: ${query}

Please provide a comprehensive answer based only on the information provided in the context above. If the context doesn't contain enough information to fully answer the question, say so explicitly.`;

    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful study assistant. Answer questions based only on the provided course material context. Be clear, concise, and reference sources when possible.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!chatResponse.ok) {
      throw new Error(`OpenAI chat API error: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    const answer = chatData.choices[0].message.content;

    // Format sources
    const sources = chunks.map((chunk: any, index: number) => ({
      id: index + 1,
      source_file: chunk.source_file,
      page_number: chunk.page_number,
      chunk_id: chunk.chunk_id
    }));

    return new Response(JSON.stringify({ 
      answer,
      sources,
      query
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ask function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});