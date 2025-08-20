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
    console.log('=== PDF PROCESSING (SERVER EXTRACTION UNAVAILABLE) ===');
    
    const { filePath, filename } = await req.json();
    console.log('Request for server extraction:', filename);
    
    // Server-side PDF extraction is temporarily unavailable due to Deno compatibility issues
    console.log('❌ Server extraction unavailable, directing to local extraction');
    return new Response(
      JSON.stringify({ 
        error: 'Server extraction unavailable',
        message: 'PDF.js is not compatible with the Deno runtime. Please use "Local extraction" instead, which supports OCR and works reliably in your browser.',
        useLocalExtraction: true
      }),
      { status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Function error:', error.message);
    
    return new Response(JSON.stringify({ 
      error: 'Server extraction unavailable',
      message: 'PDF.js is not compatible with the Deno runtime. Please use "Local extraction" instead.'
    }), {
      status: 501,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});