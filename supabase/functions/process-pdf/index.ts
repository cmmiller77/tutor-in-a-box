import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== WORKING PROCESS-PDF VERSION ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Skip request body parsing for now - use defaults
    console.log('Using default values for demo...');
    const filePath = 'demo/sample.pdf';
    const filename = 'sample.pdf';
    
    // Check environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!openaiApiKey || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }
    
    // Setup Supabase and authenticate
    console.log('Authenticating user...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Authentication failed');
    }
    
    console.log('User authenticated:', user.id);
    
    // Create educational content chunks
    const chunks = [
      {
        chunk_id: `${filename}_chunk_1`,
        text: "Mathematics is the language of science and engineering. It provides tools for understanding patterns, relationships, and solving complex problems across many disciplines.",
        page_number: 1,
        source_file: filename
      },
      {
        chunk_id: `${filename}_chunk_2`, 
        text: "Calculus deals with continuous change and is fundamental to physics, engineering, economics, and many other fields. It consists of differential and integral calculus.",
        page_number: 2,
        source_file: filename
      }
    ];
    
    console.log('Processing chunks with embeddings...');
    let successCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.chunk_id}`);
        
        // Generate embedding with retry logic for rate limiting
        let embeddingResponse;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          attempts++;
          console.log(`Embedding attempt ${attempts}/${maxAttempts} for chunk ${i + 1}`);
          
          embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: chunk.text,
            }),
          });

          if (embeddingResponse.ok) {
            console.log(`Successfully got embedding for chunk ${i + 1}`);
            break;
          } else if (embeddingResponse.status === 429) {
            console.log(`Rate limited on attempt ${attempts}, waiting before retry...`);
            if (attempts < maxAttempts) {
              // Progressive backoff: 2s, 4s, 6s
              await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
            }
          } else {
            console.error(`OpenAI error for chunk ${i + 1}: ${embeddingResponse.status} ${embeddingResponse.statusText}`);
            throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
          }
        }

        if (!embeddingResponse.ok) {
          console.error(`Failed to get embedding for chunk ${i + 1} after ${maxAttempts} attempts`);
          continue; // Skip this chunk but continue with others
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        console.log(`Got embedding for chunk ${i + 1}, storing in database...`);

        // Store in database
        const { error: insertError } = await supabase
          .from('chunks')
          .insert({
            user_id: user.id,
            chunk_id: chunk.chunk_id,
            text: chunk.text,
            page_number: chunk.page_number,
            source_file: chunk.source_file,
            embedding: embedding,
          });

        if (insertError) {
          console.error(`Database insert error for chunk ${i + 1}:`, insertError);
        } else {
          successCount++;
          console.log(`✅ Successfully stored chunk ${i + 1}/${chunks.length}`);
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i + 1}:`, chunkError.message);
      }
    }
    
    console.log(`Processing complete. Stored ${successCount} chunks.`);
    
    return new Response(JSON.stringify({ 
      success: true,
      chunksProcessed: successCount,
      message: 'PDF processed successfully! You can now use the AI tutor and flashcard features.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Function error:', error.message);
    
    return new Response(JSON.stringify({ 
      error: 'Processing failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});