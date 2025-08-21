import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper function to extract relevant excerpts from document content using paragraph windows
function extractRelevantExcerpts(content: string, searchTerms: string[], maxLength: number = 1200): string {
  // Split content into paragraphs and create overlapping windows
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 30);
  const windows: { text: string; score: number; index: number }[] = [];
  
  // Expand search terms with common synonyms and related terms
  const expandedTerms = [...searchTerms];
  searchTerms.forEach(term => {
    const lower = term.toLowerCase();
    // Add mathematical synonyms
    if (lower.includes('derivative') || lower.includes('differentiat')) {
      expandedTerms.push('partial', 'gradient', 'slope', 'rate of change', 'tangent');
    }
    if (lower.includes('integral') || lower.includes('integrat')) {
      expandedTerms.push('antiderivative', 'area under', 'accumulation');
    }
    if (lower.includes('limit')) {
      expandedTerms.push('approaches', 'tends to', 'converges');
    }
    if (lower.includes('equation') || lower.includes('solve')) {
      expandedTerms.push('formula', 'expression', 'calculate', 'find');
    }
  });
  
  // Create overlapping windows of 2-3 paragraphs
  for (let i = 0; i < paragraphs.length; i++) {
    const windowSize = Math.min(3, paragraphs.length - i);
    for (let size = 1; size <= windowSize; size++) {
      const windowText = paragraphs.slice(i, i + size).join('\n\n');
      const lowerWindow = windowText.toLowerCase();
      
      let score = 0;
      expandedTerms.forEach(term => {
        const termCount = (lowerWindow.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
        score += termCount * (term.length + (term.includes(' ') ? 5 : 0)); // Bonus for phrases
      });
      
      if (score > 0) {
        windows.push({ text: windowText.trim(), score, index: i });
      }
    }
  }
  
  // Sort by score, then by position
  windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  
  let result = '';
  let currentLength = 0;
  const usedIndices = new Set();
  
  for (const window of windows) {
    // Avoid overlapping content
    if (usedIndices.has(window.index)) continue;
    
    const addition = (result ? '\n\n---\n\n' : '') + window.text;
    if (currentLength + addition.length > maxLength && result) break;
    
    result += addition;
    currentLength += addition.length;
    usedIndices.add(window.index);
  }
  
  return result || content.slice(0, maxLength) + '...';
}

serve(async (req) => {
  console.log('=== ASK FUNCTION START (with document search) ===');
  
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

    // Step 1: Try vector search first, then fallback to text search
    console.log('Searching documents for relevant content...');
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 2);
    let relevantDocs = [];
    
    // First try semantic search with embeddings
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
        const queryEmbedding = embeddingData.data[0].embedding;
        
        console.log('Generated query embedding, searching chunks...');
        
        // Search chunks using vector similarity
        const { data: chunks, error: chunksError } = await supabase.rpc('match_chunks', {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 10,
          user_id: user.id
        });
        
        if (!chunksError && chunks && chunks.length > 0) {
          console.log(`Found ${chunks.length} relevant chunks via vector search`);
          
          // Group chunks by document and get unique documents
          const docIds = [...new Set(chunks.map((chunk: any) => chunk.source_file))];
          const { data: docs, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', user.id)
            .in('filename', docIds);
          
          if (!docsError && docs) {
            relevantDocs = docs;
            console.log('Vector search found relevant documents');
          }
        }
      }
    } catch (embeddingError) {
      console.log('Vector search failed, falling back to text search:', embeddingError);
    }
    
    // Fallback to text search if vector search didn't work or found no results
    if (relevantDocs.length === 0 && searchTerms.length > 0) {
      console.log('Using text search fallback...');
      
      // Expand search terms with synonyms for better matching
      const expandedSearchTerms = [...searchTerms];
      searchTerms.forEach(term => {
        const lower = term.toLowerCase();
        if (lower.includes('derivative') || lower.includes('partial')) {
          expandedSearchTerms.push('gradient', 'differentiation', 'slope');
        }
        if (lower.includes('integral')) {
          expandedSearchTerms.push('integration', 'antiderivative');
        }
        if (lower.includes('equation')) {
          expandedSearchTerms.push('formula', 'expression', 'solve');
        }
      });
      
      // Use PostgreSQL full-text search with expanded terms
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .textSearch('content', expandedSearchTerms.slice(0, 8).join(' | '), {
          type: 'websearch',
          config: 'english'
        })
        .limit(5);
        
      if (error) {
        console.log('Full-text search error, trying ILIKE search:', error);
        // Fallback to ILIKE search with multiple terms
        const ilike_conditions = expandedSearchTerms
          .slice(0, 5)
          .map(term => `content.ilike.%${term}%`)
          .join(',');
          
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .or(ilike_conditions)
          .limit(3);
          
        if (fallbackError) {
          console.log('ERROR: All search methods failed:', fallbackError);
        } else {
          relevantDocs = fallbackData || [];
        }
      } else {
        relevantDocs = data || [];
      }
    }

    if (!relevantDocs || relevantDocs.length === 0) {
      console.log('No relevant documents found with full-text search, trying broader search...');
      
      // Enhanced fallback: try multi-keyword ILIKE search with OR conditions
      if (searchTerms.length > 0) {
        const filters = searchTerms
          .filter(term => term.length > 2)
          .slice(0, 5) // Limit to 5 terms to avoid too complex queries
          .map(term => `content.ilike.%${term}%`)
          .join(',');
        
        if (filters) {
          const { data: broadData, error: broadError } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', user.id)
            .or(filters)
            .limit(3);
            
          if (!broadError && broadData && broadData.length > 0) {
            relevantDocs = broadData;
            console.log(`Found ${relevantDocs.length} documents with broader search`);
          }
        }
      }
      
      // Final fallback: get the most recent document if still no results
      if (!relevantDocs || relevantDocs.length === 0) {
        const { data: recentData, error: recentError } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (!recentError && recentData && recentData.length > 0) {
          relevantDocs = recentData;
          console.log('Using most recent document as fallback');
        }
      }
      
      // If still no documents, return no-content message
      if (!relevantDocs || relevantDocs.length === 0) {
        console.log('No documents found at all for this user');
        
        // Log analytics for no results found
        const { error: logError } = await supabase
          .from('question_analytics')
          .insert({
            user_id: user.id,
            question: query,
            class_id: classId,
            subject: classSubject,
            derived_subject: null,
            derived_topics: [],
            sources_found: 0,
            response_generated: false
          });

        if (logError) {
          console.log('Warning: Failed to log question analytics:', logError);
        }

        return new Response(
          JSON.stringify({ 
            answer: 'I don\'t have any course materials uploaded for you yet. Please upload a PDF textbook or course material first, then ask your questions!',
            sources: [],
            query: query
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`Found ${relevantDocs.length} relevant documents`);
    sourcesFound = relevantDocs.length;

    // Step 2: Create context from relevant documents with smarter excerpts
    const context = relevantDocs
      .map((doc: any, index: number) => {
        // Extract relevant excerpts using paragraph windows
        const excerpts = extractRelevantExcerpts(doc.content, searchTerms, 1200);
        return `[Source ${index + 1}] ${doc.filename}\n${excerpts}`;
      })
      .join('\n\n===\n\n');

    console.log('Assembled context from', relevantDocs.length, 'documents');

    // Step 3: Generate comprehensive answer using OpenAI with improved context
    const systemPrompt = `You are an AI tutor and subject matter expert with access to the student's course materials. Your job is to:

1. Answer questions comprehensively based on the provided course material context
2. The course materials contain relevant information - look carefully through all sections
3. Provide detailed, educational explanations with step-by-step breakdowns when appropriate
4. Reference specific sources when citing information
5. If you need to clarify or elaborate on concepts from the materials, do so helpfully
6. Maintain an encouraging, educational tone that builds understanding
7. Break down complex concepts into clear, understandable parts

IMPORTANT: The course materials provided contain the information needed to answer the question. Look through all sections carefully before concluding information is missing.`;

    const userPrompt = `Based on the following excerpts from my course materials, please answer my question comprehensively:

COURSE MATERIAL CONTEXT:
${context}

MY QUESTION: ${query}

Please provide a detailed answer based on the course materials above, and reference the sources when possible.`;

    console.log('Generating AI response...');

    // Try GPT-5 first, then GPT-4o as fallback
    let chatResponse;
    let modelUsed = 'gpt-5-2025-08-07';
    
    const tryModel = async (model: string) => {
      console.log(`Trying model: ${model}`);
      const requestBody: any = {
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      };

      // Use different parameters for different model families
      if (model.startsWith('gpt-5') || model.startsWith('gpt-4.1') || model.startsWith('o3') || model.startsWith('o4')) {
        requestBody.max_completion_tokens = 1500;
      } else {
        requestBody.max_tokens = 1500;
        requestBody.temperature = 0.7;
      }

      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    };

    // First attempt with GPT-5
    try {
      chatResponse = await tryModel('gpt-5-2025-08-07');
      if (chatResponse.ok) {
        const testData = await chatResponse.json();
        const testAnswer = testData.choices[0].message.content;
        // Check if response is meaningful (not empty or too short)
        if (testAnswer && testAnswer.trim().length > 50) {
          console.log('GPT-5 response successful');
          modelUsed = 'gpt-5-2025-08-07';
        } else {
          console.log('GPT-5 response too short, trying fallback');
          throw new Error('Response too short');
        }
      } else {
        console.log(`GPT-5 failed with status: ${chatResponse.status}`);
        throw new Error(`GPT-5 failed with status: ${chatResponse.status}`);
      }
    } catch (error) {
      console.log('GPT-5 failed, trying GPT-4o fallback:', error.message);
      try {
        chatResponse = await tryModel('gpt-4o');
        modelUsed = 'gpt-4o';
        console.log('Using GPT-4o fallback');
      } catch (fallbackError) {
        console.log('Both models failed:', fallbackError.message);
        chatResponse = null;
      }
    }

    if (!chatResponse || !chatResponse.ok) {
      console.log('ERROR: All OpenAI models failed');
      let errorText = '';
      if (chatResponse) {
        console.log(`OpenAI response status: ${chatResponse.status}`);
        errorText = await chatResponse.text();
        console.log('OpenAI error details:', errorText);
      }
      
      // Fallback to a basic response if OpenAI fails
      const fallbackAnswer = `Based on your course materials, here's what I found:\n\n${context.slice(0, 1000)}...\n\nI'm having trouble generating a detailed response right now, but the above content from your materials should help answer your question about: ${query}`;
      
      return new Response(
        JSON.stringify({ 
          answer: fallbackAnswer,
          sources: relevantDocs.map((doc: any, index: number) => ({
            id: index + 1,
            source_file: doc.filename,
            page_number: 1,
            document_id: doc.id
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

    console.log(`Generated comprehensive AI answer using ${modelUsed}`);

    // Step 4: Classify question topics using AI
    console.log('Classifying question topics...');
    let derivedSubject = null;
    let derivedTopics = [];

    try {
      const classificationPrompt = `Analyze this student question and the provided course materials to extract the specific academic topics and subject areas being discussed.

QUESTION: ${query}

COURSE MATERIALS CONTEXT:
${context.slice(0, 2000)}

Please provide:
1. The main subject area (e.g., "Mathematics", "Physics", "Computer Science", "Biology", etc.)
2. Specific topics within that subject (e.g., "partial derivatives", "integration by parts", "neural networks", "cell division", etc.)

Respond in JSON format:
{
  "subject": "Main Subject Area",
  "topics": ["specific topic 1", "specific topic 2", "specific topic 3"]
}

Focus on the actual academic concepts being discussed, not generic terms.`;

      const classificationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Use fast model for classification
          messages: [
            {
              role: 'system',
              content: 'You are an academic subject classifier. Extract specific academic topics and subjects from questions and course materials.'
            },
            {
              role: 'user',
              content: classificationPrompt
            }
          ],
          max_tokens: 200,
          temperature: 0.3,
        }),
      });

      if (classificationResponse.ok) {
        const classificationData = await classificationResponse.json();
        const classificationText = classificationData.choices[0].message.content;
        
        try {
          const parsed = JSON.parse(classificationText);
          derivedSubject = parsed.subject;
          derivedTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
          console.log('Classified subject:', derivedSubject);
          console.log('Classified topics:', derivedTopics);
        } catch (parseError) {
          console.log('Failed to parse classification JSON, extracting manually');
          // Fallback: try to extract subject and topics manually
          const subjectMatch = classificationText.match(/"subject":\s*"([^"]+)"/);
          const topicsMatch = classificationText.match(/"topics":\s*\[(.*?)\]/);
          
          if (subjectMatch) derivedSubject = subjectMatch[1];
          if (topicsMatch) {
            try {
              derivedTopics = JSON.parse(`[${topicsMatch[1]}]`);
            } catch (e) {
              console.log('Failed to parse topics array');
            }
          }
        }
      } else {
        console.log('Classification request failed:', classificationResponse.status);
      }
    } catch (classificationError) {
      console.log('Topic classification failed:', classificationError.message);
    }

    // Format sources
    const sources = relevantDocs.map((doc: any, index: number) => ({
      id: index + 1,
      source_file: doc.filename,
      page_number: 1,
      document_id: doc.id,
      title: doc.title
    }));

    const result = {
      answer,
      sources,
      query
    };

    // Log analytics with enhanced data
    try {
      const { error: logError } = await supabase
        .from('question_analytics')
        .insert({
          user_id: user.id,
          question: query,
          class_id: classId,
          subject: classSubject,
          derived_subject: derivedSubject,
          derived_topics: derivedTopics,
          sources_found: sourcesFound,
          response_generated: responseGenerated
        });

      if (logError) {
        console.log('Warning: Failed to log question analytics:', logError);
      } else {
        console.log('✅ Analytics logged successfully');
      }
    } catch (analyticsError) {
      console.log('Analytics logging error:', analyticsError);
    }

    console.log('=== ASK FUNCTION COMPLETE ===');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Ask function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process question',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});