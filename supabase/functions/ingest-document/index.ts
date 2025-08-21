import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to split text into chunks
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    
    // Try to end at a sentence boundary
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('.', end);
      const questionEnd = text.lastIndexOf('?', end);
      const exclamationEnd = text.lastIndexOf('!', end);
      
      const lastSentence = Math.max(sentenceEnd, questionEnd, exclamationEnd);
      if (lastSentence > start + chunkSize * 0.5) {
        end = lastSentence + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = Math.max(end - overlap, start + 1);
  }
  
  return chunks.filter(chunk => chunk.length > 50); // Remove very short chunks
}

serve(async (req) => {
  console.log('=== INGEST DOCUMENT FUNCTION START ===');
  
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

    // Parse request body
    const { document_id } = await req.json();

    if (!document_id) {
      return new Response(JSON.stringify({ error: 'Document ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing document:', document_id);

    // Get the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .eq('user_id', user.id)
      .single();

    if (docError || !doc) {
      console.log('ERROR: Document not found:', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Document found:', doc.filename);

    // Split document into chunks
    const chunks = chunkText(doc.content, 1000, 100);
    console.log(`Created ${chunks.length} chunks from document`);

    // Process chunks in batches to avoid overwhelming OpenAI
    const batchSize = 10;
    let totalProcessed = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`);

      // Generate embeddings for the batch
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: batch,
        }),
      });

      if (!embeddingResponse.ok) {
        console.log(`Embedding request failed for batch: ${embeddingResponse.status}`);
        const errorText = await embeddingResponse.text();
        console.log('OpenAI error:', errorText);
        throw new Error(`Failed to generate embeddings: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embeddings = embeddingData.data;

      // Store chunks with embeddings in database
      const chunkInserts = batch.map((chunkText, batchIndex) => {
        const chunkIndex = i + batchIndex;
        return {
          user_id: user.id,
          chunk_id: `${doc.id}_chunk_${chunkIndex + 1}`,
          text: chunkText,
          embedding: embeddings[batchIndex].embedding,
          source_file: doc.filename,
          page_number: Math.floor(chunkIndex / 5) + 1, // Rough estimate
        };
      });

      const { error: insertError } = await supabase
        .from('chunks')
        .insert(chunkInserts);

      if (insertError) {
        console.log('ERROR: Failed to insert chunks:', insertError);
        throw new Error('Failed to store chunks in database');
      }

      totalProcessed += batch.length;
      console.log(`Processed ${totalProcessed} of ${chunks.length} chunks`);

      // Add a small delay to avoid rate limiting
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Successfully ingested document: ${totalProcessed} chunks created`);

    return new Response(JSON.stringify({ 
      success: true,
      chunks_created: totalProcessed,
      document_id: doc.id,
      filename: doc.filename
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Ingest document error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to ingest document',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});