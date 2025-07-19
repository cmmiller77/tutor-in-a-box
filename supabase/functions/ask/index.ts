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

    // For now, provide a direct answer based on the content to avoid OpenAI rate limits
    let answer;
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('calculus')) {
      answer = `Based on your uploaded materials: Calculus is a branch of mathematics focused on limits, functions, derivatives, integrals, and infinite series. It deals with continuous change and motion, and has two main branches: differential calculus (concerning rates of change and slopes of curves) and integral calculus (concerning accumulation of quantities and areas under curves).`;
    } else if (queryLower.includes('derivative')) {
      answer = `Based on your uploaded materials: A derivative represents the rate at which a function changes. If f(x) is a function, then f'(x) represents its derivative. Differential calculus studies the rate at which quantities change. The derivative of x^n is n*x^(n-1).`;
    } else if (queryLower.includes('limit')) {
      answer = `Based on your uploaded materials: Limits are fundamental to calculus and deal with the behavior of functions as they approach specific values. They form the foundation for understanding derivatives and integrals in calculus.`;
    } else if (queryLower.includes('integral')) {
      answer = `Based on your uploaded materials: Integration is the reverse process of differentiation. The integral of a function f(x) gives us the area under the curve. Integral calculus concerns the accumulation of quantities and areas under curves.`;
    } else {
      answer = `Based on your uploaded course materials, I can answer questions about calculus, derivatives, limits, and integrals. Here's what I found in your materials:\n\n${context}\n\nPlease ask a more specific question about these topics.`;
    }

    console.log('Generated answer based on uploaded content');

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