import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== TEXT INGESTION STARTED ===');
    
    const { text, filename, extractionMethod = 'direct' } = await req.json();
    console.log('Processing text from:', filename, 'Method:', extractionMethod);
    console.log('Text length:', text?.length, 'characters');

    // Get Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log('User authenticated:', user.id);

    // Validate input
    if (!text || text.trim().length < 10) {
      console.error('❌ No text provided or text too short');
      return new Response(
        JSON.stringify({ error: 'Text content is required and must be at least 10 characters' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!filename) {
      console.error('❌ No filename provided');
      return new Response(
        JSON.stringify({ error: 'Filename is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete existing chunks for this file (if reprocessing)
    console.log('🗑️  Deleting existing chunks for:', filename);
    const { error: deleteError } = await supabase
      .from('chunks')
      .delete()
      .eq('user_id', user.id)
      .eq('source_file', filename);

    if (deleteError) {
      console.error('❌ Error deleting existing chunks:', deleteError);
    } else {
      console.log('✅ Existing chunks deleted');
    }

    // Chunk the text
    console.log('📝 Chunking text...');
    const chunks = chunkText(text, filename);
    console.log(`📊 Created ${chunks.length} chunks`);

    // Process chunks with embeddings
    let processedChunks = 0;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }

    for (const chunk of chunks) {
      try {
        console.log(`🔄 Processing chunk ${chunk.chunk_id}...`);
        
        // Generate embedding with retry logic
        let embedding;
        let retries = 3;
        
        while (retries > 0) {
          try {
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
              const errorText = await embeddingResponse.text();
              throw new Error(`OpenAI API error: ${embeddingResponse.status} - ${errorText}`);
            }

            const embeddingData = await embeddingResponse.json();
            embedding = embeddingData.data[0].embedding;
            break;
          } catch (embeddingError) {
            retries--;
            console.error(`❌ Embedding attempt failed (${3-retries}/3):`, embeddingError);
            
            if (retries > 0) {
              console.log('⏳ Waiting before retry...');
              await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
            } else {
              throw embeddingError;
            }
          }
        }

        // Store chunk in database
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
          console.error(`❌ Error inserting chunk ${chunk.chunk_id}:`, insertError);
          throw insertError;
        }

        processedChunks++;
        if (processedChunks % 5 === 0) {
          console.log(`📊 Progress: ${processedChunks}/${chunks.length} chunks processed`);
        }

      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${chunk.chunk_id}:`, chunkError);
        // Continue with other chunks rather than failing completely
      }
    }

    console.log(`✅ Text ingestion completed: ${processedChunks}/${chunks.length} chunks processed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${processedChunks} chunks from ${filename}`,
        filename,
        extractionMethod,
        chunksProcessed: processedChunks,
        totalChunks: chunks.length,
        textLength: text.length,
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('❌ Text ingestion error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process text',
        details: error.message,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Chunking function
function chunkText(text: string, sourceFile: string) {
  const chunks = [];
  const chunkSize = 1000;
  const overlap = 100;
  
  // Simple paragraph-aware chunking
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  let currentChunk = '';
  let chunkIndex = 0;
  let currentPage = 1;
  
  for (const paragraph of paragraphs) {
    // Check if this paragraph contains a page marker
    const pageMatch = paragraph.match(/--- Page (\d+) ---/);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1]);
      continue;
    }
    
    // If adding this paragraph would exceed chunk size, save current chunk
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        chunk_id: `${sourceFile}_chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        page_number: currentPage,
        source_file: sourceFile,
      });
      
      // Start new chunk with overlap
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 10)); // Approximate word overlap
      currentChunk = overlapWords.join(' ') + ' ' + paragraph;
      chunkIndex++;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  // Add final chunk if there's remaining text
  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunk_id: `${sourceFile}_chunk_${chunkIndex}`,
      text: currentChunk.trim(),
      page_number: currentPage,
      source_file: sourceFile,
    });
  }
  
  return chunks;
}