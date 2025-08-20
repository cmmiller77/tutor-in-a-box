import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';

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
    console.log('=== PDF PROCESSING STARTED ===');
    
    const { filePath, filename } = await req.json();
    console.log('Processing file:', filename, 'at path:', filePath);
    
    if (!filePath || !filename) {
      console.error('❌ Missing required fields:', { filePath, filename });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: filePath and filename' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
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

    // Download the PDF file from storage
    console.log('📄 Downloading PDF from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);
      
    if (downloadError || !fileData) {
      console.error('❌ Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download PDF file' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    console.log('✅ PDF downloaded, size:', fileData.size, 'bytes');
    
    // Convert file data to buffer for PDF.js
    const pdfBuffer = await fileData.arrayBuffer();
    let extractedText = '';
    let extractedPages = 0;
    let totalPages = 0;
    
    try {
      console.log('🔄 Starting PDF text extraction...');
      
      // Configure PDF.js properly for Deno environment
      const pdf = await pdfjsLib.getDocument({
        data: pdfBuffer,
        useSystemFonts: true,
        disableFontFace: true,
        useWorkerFetch: false,
        isEvalSupported: false,
      }).promise;
      
      totalPages = pdf.numPages;
      console.log(`📄 PDF loaded with ${totalPages} pages`);

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .trim();
          
          if (pageText && pageText.length > 10) { // Only count meaningful text
            extractedText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
            extractedPages++;
            console.log(`✅ Page ${pageNum}: ${pageText.length} characters extracted`);
          } else {
            console.log(`⚠️  Page ${pageNum}: No meaningful text found (possibly scanned)`);
          }
        } catch (pageError) {
          console.error(`❌ Error processing page ${pageNum}:`, pageError);
        }
      }
      
      console.log(`📊 Extraction summary: ${extractedPages}/${totalPages} pages with text`);
    } catch (pdfError) {
      console.error('❌ PDF text extraction failed:', pdfError);
    }

    // Validate extraction results  
    if (!extractedText || extractedText.trim().length < 100) {
      console.log(`⚠️  Minimal text extracted (${extractedText.length} chars), this may be a scanned PDF`);
      
      // Provide diagnostic information instead of failing
      extractedText = `Document processing summary for ${filename}:
      
Total pages: ${totalPages}
Pages with extractable text: ${extractedPages}
Extraction method: PDF.js native text extraction

This document appears to contain primarily scanned images rather than extractable text. 
To process this document:
1. Use the "Extract text locally" option in the upload interface
2. Or convert the PDF to text format using external tools
3. Or upload the document as .txt, .docx, or .md format

Note: This placeholder text has been indexed to prevent errors, but the actual document content is not searchable until properly processed.`;
    } else {
      console.log(`✅ Successfully extracted ${extractedText.length} characters from ${extractedPages}/${totalPages} pages`);
      
      // Add a summary header to help with diagnostics
      const summary = `Document: ${filename}
Pages processed: ${extractedPages}/${totalPages}
Extraction method: PDF.js native text extraction
Content length: ${extractedText.length} characters

=== DOCUMENT CONTENT ===`;
      
      extractedText = summary + extractedText;
    }

    // Check OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    // Split text into semantic chunks (800-1200 characters each)
    console.log('Creating text chunks...');
    const chunks = [];
    const chunkSize = 1000; // Optimal size for embeddings
    const overlapSize = 100; // Overlap to maintain context
    
    // Split by paragraphs first, then by sentences if needed
    const paragraphs = pdfText.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    
    let currentChunk = '';
    let chunkIndex = 1;
    let estimatedPage = 1;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      
      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 200) {
        // Save current chunk
        chunks.push({
          chunk_id: `${filename.replace('.pdf', '')}_chunk_${chunkIndex}`,
          text: currentChunk.trim(),
          page_number: estimatedPage,
          source_file: filename
        });
        
        // Start new chunk with overlap from previous chunk
        const sentences = currentChunk.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const overlapText = sentences.slice(-2).join('.') + '.'; // Keep last 2 sentences for context
        
        currentChunk = overlapText + ' ' + paragraph;
        chunkIndex++;
        
        // Estimate page numbers (assuming ~3000 chars per page)
        estimatedPage = Math.ceil((chunkIndex * chunkSize) / 3000) || 1;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add final chunk if there's remaining text
    if (currentChunk.trim().length > 100) {
      chunks.push({
        chunk_id: `${filename.replace('.pdf', '')}_chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        page_number: estimatedPage,
        source_file: filename
      });
    }
    
    console.log(`Created ${chunks.length} text chunks`);
    
    // Process chunks with embeddings (with better rate limiting)
    let successCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.chunk_id}`);
        
        // Generate embedding with exponential backoff
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
            console.log(`✅ Successfully got embedding for chunk ${i + 1}`);
            break;
          } else if (embeddingResponse.status === 429) {
            console.log(`⏳ Rate limited on attempt ${attempts}, waiting before retry...`);
            if (attempts < maxAttempts) {
              // Exponential backoff: 1s, 4s, 9s
              const waitTime = Math.pow(attempts, 2) * 1000;
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          } else {
            console.error(`❌ OpenAI error for chunk ${i + 1}: ${embeddingResponse.status}`);
            const errorText = await embeddingResponse.text();
            console.error('Error details:', errorText);
            throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
          }
        }

        if (!embeddingResponse.ok) {
          console.error(`❌ Failed to get embedding for chunk ${i + 1} after ${maxAttempts} attempts`);
          continue; // Skip this chunk but continue with others
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;
        console.log(`📝 Got embedding for chunk ${i + 1}, storing in database...`);

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
          console.error(`❌ Database insert error for chunk ${i + 1}:`, insertError);
        } else {
          successCount++;
          console.log(`✅ Successfully stored chunk ${i + 1}/${chunks.length}`);
        }
        
        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (chunkError) {
        console.error(`❌ Error processing chunk ${i + 1}:`, chunkError.message);
      }
    }
    
    console.log(`🎉 Processing complete. Stored ${successCount} chunks out of ${chunks.length} total.`);
    
    return new Response(JSON.stringify({ 
      success: true,
      chunksProcessed: successCount,
      totalChunks: chunks.length,
      message: `PDF processed successfully! Generated ${successCount} text chunks. You can now ask questions about your document.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Function error:', error.message);
    
    return new Response(JSON.stringify({ 
      error: 'Processing failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});