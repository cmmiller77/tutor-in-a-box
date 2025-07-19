import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== ASK FUNCTION START ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.log('ERROR: Missing OpenAI API key');
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
      console.log('ERROR: Missing authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.log('ERROR: Auth failed:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Parse request body (using the working pattern)
    const rawBody = await req.text();
    let query;
    
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        query = parsed.query;
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing query:', query);

    // Get chunks for this user
    const { data: userChunks, error: chunksError } = await supabase
      .from('chunks')
      .select('id, text, source_file, page_number, chunk_id')
      .eq('user_id', user.id)
      .limit(5);

    console.log('Found chunks:', userChunks?.length || 0);

    if (!userChunks || userChunks.length === 0) {
      return new Response(JSON.stringify({ 
        answer: "I don't have any uploaded course materials to answer questions about. Please upload a PDF first, then ask your question.",
        sources: [],
        query: query
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create context from chunks
    const context = userChunks.map((chunk: any, index: number) => 
      `[Source ${index + 1} - ${chunk.source_file}, Page ${chunk.page_number}]:\n${chunk.text}`
    ).join('\n\n');

    console.log('Using context from', userChunks.length, 'chunks');

    // Generate answer using GPT
    const prompt = `Based on the following course material excerpts, answer the user's question. Be specific and reference the sources when possible.

Context from course materials:
${context}

User Question: ${query}

Please provide a comprehensive answer based only on the information provided in the context above.`;

    console.log('Calling OpenAI...');

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
      console.log('ERROR: OpenAI API failed:', chatResponse.status);
      throw new Error(`OpenAI API error: ${chatResponse.statusText}`);
    }

    const chatData = await chatResponse.json();
    const answer = chatData.choices[0].message.content;

    console.log('Got answer from OpenAI');

    // Format sources
    const sources = userChunks.map((chunk: any, index: number) => ({
      id: index + 1,
      source_file: chunk.source_file,
      page_number: chunk.page_number || 1,
      chunk_id: chunk.chunk_id
    }));

    const result = {
      answer,
      sources,
      query
    };

    console.log('Returning successful response');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.log('ERROR: Function failed:', error.message);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});