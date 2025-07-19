import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== SIMPLE PROCESS-PDF TEST ===');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    // Try to read the body
    const body = await req.text();
    console.log('Body length:', body.length);
    console.log('Body content:', body);
    
    // Try to parse as JSON
    if (body.trim()) {
      try {
        const parsed = JSON.parse(body);
        console.log('Parsed JSON:', parsed);
      } catch (e) {
        console.log('JSON parse failed:', e.message);
      }
    }
    
    // Just return success
    return new Response(JSON.stringify({ 
      success: true,
      chunksProcessed: 2,
      message: 'Simple test successful'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Caught error:', error);
    console.error('Error type:', typeof error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Test error',
      message: error.message,
      type: typeof error
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});