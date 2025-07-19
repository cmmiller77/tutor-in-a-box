import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== DEBUG VERSION ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Test 1: Can we read the request?
    console.log('Test 1: Reading request...');
    let data;
    try {
      data = await req.json();
      console.log('SUCCESS: req.json() worked:', data);
    } catch (e) {
      console.log('FAILED: req.json() failed:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Request parsing failed',
        details: e.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test 2: Do we have the required data?
    console.log('Test 2: Checking data...');
    const { filePath, filename } = data;
    if (!filePath) {
      return new Response(JSON.stringify({ 
        error: 'Missing filePath',
        received: data
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('SUCCESS: All tests passed');
    
    return new Response(JSON.stringify({ 
      success: true,
      chunksProcessed: 2,
      message: 'Basic parsing works',
      receivedData: { filePath, filename }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('CRITICAL ERROR:', error);
    return new Response(JSON.stringify({ 
      error: 'Critical failure',
      message: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});