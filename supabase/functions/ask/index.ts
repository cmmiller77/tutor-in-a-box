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
    let query, classId;
    
    if (rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        query = parsed.query;
        classId = parsed.class_id;
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
    console.log('Class ID:', classId);

    // Get class details if classId is provided
    let classSubject = null;
    if (classId) {
      const { data: classData } = await supabase
        .from('classes')
        .select('subject')
        .eq('id', classId)
        .single();
      
      if (classData) {
        classSubject = classData.subject;
        console.log('Found class subject:', classSubject);
      }
    }

    // Log question for analytics
    let sourcesFound = 0;
    let responseGenerated = false;

    // Step 1: Convert user query to embedding for similarity search
    console.log('Converting query to embedding...');
    
    let queryEmbedding;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: query,
          }),
        });

        if (embeddingResponse.ok) {
          const embeddingData = await embeddingResponse.json();
          queryEmbedding = embeddingData.data[0].embedding;
          break;
        } else if (embeddingResponse.status === 429) {
          retryCount++;
          console.log(`Rate limited, attempt ${retryCount}/${maxRetries}`);
          if (retryCount < maxRetries) {
            const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } else {
          console.log('ERROR: OpenAI embedding failed:', embeddingResponse.status);
          throw new Error(`OpenAI embedding error: ${embeddingResponse.statusText}`);
        }
      } catch (error) {
        console.log('ERROR: Network error during embedding:', error);
        retryCount++;
        if (retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    if (!queryEmbedding) {
      console.log('Failed to get embedding after retries, falling back to keyword search');
      // Fallback: simple text search using ilike instead of textSearch
      const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
      let keywordChunks = [];
      let keywordError = null;
      
      if (searchTerms.length > 0) {
        const { data, error } = await supabase
          .from('chunks')
          .select('*')
          .eq('user_id', user.id)
          .ilike('text', `%${searchTerms[0]}%`)
          .limit(10);
        keywordChunks = data;
        keywordError = error;
      }
        
      if (keywordError) {
        console.log('ERROR: Keyword search failed:', keywordError);
        throw new Error('Failed to search course material');
      }

      if (!keywordChunks || keywordChunks.length === 0) {
        return new Response(
          JSON.stringify({ 
            answer: 'I could not find relevant information in your uploaded materials to answer this question. Please make sure you have uploaded course materials related to your question.',
            sources: [],
            query: query
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Use keyword-matched chunks for context
      const context = keywordChunks
        .map((chunk: any, index: number) => 
          `[Source ${index + 1}] ${chunk.source_file} (Page ${chunk.page_number})\n${chunk.text}`
        )
        .join('\n\n---\n\n');

      console.log('Using keyword search context from', keywordChunks.length, 'chunks');

      // Generate answer with keyword-matched context
      const answer = `Based on your course materials, here's what I found regarding "${query}":\n\n${context.slice(0, 1500)}...\n\nPlease note: This response uses keyword matching due to temporary limitations. For more precise answers, please try again later.`;
      
      return new Response(
        JSON.stringify({ 
          answer,
          sources: keywordChunks.map((chunk: any, index: number) => ({
            id: index + 1,
            source_file: chunk.source_file,
            page_number: chunk.page_number || 1,
            chunk_id: chunk.chunk_id
          })),
          query: query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('Query embedding generated, searching for similar chunks...');

    // Step 2: Use vector similarity search to find relevant chunks
    const { data: similarChunks, error: searchError } = await supabase
      .rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Lower threshold to get more potentially relevant content
        match_count: 15, // Get more chunks for better context
        user_id: user.id
      });

    if (searchError) {
      console.log('ERROR: Vector search failed:', searchError);
      throw new Error('Failed to search course material');
    }

    if (!similarChunks || similarChunks.length === 0) {
      console.log('No relevant chunks found for query');
      
      // Log analytics for no results found
      await supabase.from('question_analytics').insert({
        user_id: user.id,
        question: query,
        sources_found: 0,
        response_generated: false,
        class_id: classId,
        subject: classSubject
      });

      return new Response(
        JSON.stringify({ 
          answer: 'I could not find relevant information in your uploaded materials to answer this question. Please make sure you have uploaded course materials related to your question.',
          sources: [],
          query: query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Found ${similarChunks.length} relevant chunks with similarity scores`);
    sourcesFound = similarChunks.length;

    // Step 3: Create rich context from the most relevant chunks
    const context = similarChunks
      .map((chunk: any, index: number) => 
        `[Source ${index + 1}] ${chunk.source_file} (Page ${chunk.page_number}) - Similarity: ${(chunk.similarity * 100).toFixed(1)}%\n${chunk.text}`
      )
      .join('\n\n---\n\n');

    console.log('Assembled context from', similarChunks.length, 'chunks');

    // Step 4: Generate comprehensive answer using OpenAI with proper context
    const systemPrompt = `You are an AI tutor and subject matter expert. You have been provided with excerpts from the student's course materials. Your job is to:

1. Answer questions based ONLY on the provided course material context
2. Be comprehensive and educational in your explanations  
3. Reference specific sources and page numbers when possible
4. If the context doesn't contain enough information, say so clearly
5. Maintain an encouraging, educational tone
6. Break down complex concepts into understandable parts

Remember: You are an expert on THIS specific course material, not general knowledge.`;

    const userPrompt = `Based on the following excerpts from my course materials, please answer my question comprehensively:

COURSE MATERIAL CONTEXT:
${context}

MY QUESTION: ${query}

Please provide a detailed answer based on the course materials above, and reference the sources when possible.`;

    console.log('Generating AI response...');

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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.3, // Lower temperature for more focused, educational responses
        max_tokens: 1500, // More tokens for comprehensive answers
      }),
    });

    if (!chatResponse.ok) {
      console.log('ERROR: OpenAI chat completion failed:', chatResponse.status);
      const errorText = await chatResponse.text();
      console.log('OpenAI error details:', errorText);
      
      // Fallback to a basic response if OpenAI fails
      const fallbackAnswer = `Based on your course materials, here's what I found:\n\n${context.slice(0, 1000)}...\n\nI'm having trouble generating a detailed response right now, but the above content from your materials should help answer your question about: ${query}`;
      
      return new Response(
        JSON.stringify({ 
          answer: fallbackAnswer,
          sources: similarChunks.map((chunk: any, index: number) => ({
            id: index + 1,
            source_file: chunk.source_file,
            page_number: chunk.page_number,
            chunk_id: chunk.chunk_id,
            similarity: chunk.similarity
          })),
          query: query
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const chatData = await chatResponse.json();
    const answer = chatData.choices[0].message.content;
    responseGenerated = true;

    console.log('Generated comprehensive AI answer based on course materials');

    // Format sources with similarity scores
    const sources = similarChunks.map((chunk: any, index: number) => ({
      id: index + 1,
      source_file: chunk.source_file,
      page_number: chunk.page_number || 1,
      chunk_id: chunk.chunk_id,
      similarity: chunk.similarity
    }));

    const result = {
      answer,
      sources,
      query
    };

    console.log('Returning successful response');

    // Log successful analytics
    await supabase.from('question_analytics').insert({
      user_id: user.id,
      question: query,
      sources_found: sourcesFound,
      response_generated: responseGenerated,
      class_id: classId,
      subject: classSubject
    });

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