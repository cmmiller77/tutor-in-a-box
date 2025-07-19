import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SIMPLE ASK FUNCTION TEST ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS OPTIONS');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Request method:', req.method);
    console.log('Content-Type:', req.headers.get('content-type'));
    
    // Try to read the request body
    const rawBody = await req.text();
    console.log('Raw request body:', rawBody);
    
    let query = '';
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        console.log('Parsed body:', parsed);
        query = parsed.query || '';
      } catch (e) {
        console.log('JSON parse error:', e.message);
        return new Response(JSON.stringify({ 
          error: 'Invalid JSON',
          received: rawBody 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log('Empty request body');
      return new Response(JSON.stringify({ 
        error: 'Empty request body' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Query extracted:', query);

    // Return a test response for now
    const testResponse = {
      answer: `Test response for your question: "${query}". This is a simplified test to verify the function works. The question about calculus can be answered as: Calculus is a branch of mathematics that deals with continuous change and motion.`,
      sources: [
        {
          id: 1,
          source_file: 'test.pdf',
          page_number: 1,
          chunk_id: 'test_chunk_1'
        }
      ],
      query: query
    };

    console.log('Returning test response');
    
    return new Response(JSON.stringify(testResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log('Function error:', error.message);
    console.log('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Function error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});