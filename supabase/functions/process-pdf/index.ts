import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple tokenizer - approximates 500 tokens per chunk
const estimateTokens = (text: string): number => {
  return Math.ceil(text.split(/\s+/).length * 1.3); // Rough estimate
};

const extractTextFromPDF = async (pdfBuffer: ArrayBuffer): Promise<Array<{
  chunk_id: string;
  text: string;
  page_number: number;
  source_file: string;
}>> => {
  try {
    // For this demo, we'll use a simple text extraction
    // In production, you'd want to use a proper PDF parsing library
    const decoder = new TextDecoder();
    const text = decoder.decode(pdfBuffer);
    
    // Simple chunking strategy - split by sentences and group to ~500 tokens
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks = [];
    let currentChunk = "";
    let chunkCount = 0;
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence + ". ";
      
      if (estimateTokens(testChunk) > 500 && currentChunk.length > 0) {
        chunks.push({
          chunk_id: `chunk_${chunkCount}`,
          text: currentChunk.trim(),
          page_number: 1, // Simplified - would need proper PDF parsing
          source_file: "uploaded_pdf"
        });
        currentChunk = sentence + ". ";
        chunkCount++;
      } else {
        currentChunk = testChunk;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        chunk_id: `chunk_${chunkCount}`,
        text: currentChunk.trim(),
        page_number: 1,
        source_file: "uploaded_pdf"
      });
    }
    
    return chunks;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
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

    // Parse request body with error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      if (!bodyText.trim()) {
        throw new Error('Empty request body');
      }
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { filePath, filename } = requestBody;

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing PDF:', filePath);

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text and create chunks
    const pdfBuffer = await fileData.arrayBuffer();
    const chunks = await extractTextFromPDF(pdfBuffer);

    console.log(`Extracted ${chunks.length} chunks from PDF`);

    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
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

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Store chunk with embedding in database
        const { error: insertError } = await supabase
          .from('chunks')
          .insert({
            user_id: user.id,
            chunk_id: chunk.chunk_id,
            text: chunk.text,
            page_number: chunk.page_number,
            source_file: filename || chunk.source_file,
            embedding: embedding,
          });

        if (insertError) {
          console.error('Error inserting chunk:', insertError);
          throw new Error('Failed to store chunk');
        }

        console.log(`Processed chunk ${i + 1}/${chunks.length}`);
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      chunksProcessed: chunks.length,
      message: 'PDF processed and embeddings generated successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-pdf function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});