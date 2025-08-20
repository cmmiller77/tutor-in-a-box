import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
// Import PDF.js for real PDF text extraction
import * as pdfjs from 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== PROCESSING PDF ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Processing PDF Request ===');
    console.log('Content-Type:', req.headers.get('content-type'));
    console.log('Request method:', req.method);
    
    // Parse request body - Supabase functions.invoke automatically handles JSON
    const { filePath, filename } = await req.json();
    console.log('Parsed body:', { filePath, filename });
    
    if (!filePath || !filename) {
      throw new Error('Missing required fields: filePath and filename');
    }
    
    console.log('Processing file:', filePath, filename);
    
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
    
    // Download the PDF file from storage
    console.log('Downloading PDF from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('pdfs')
      .download(filePath);
      
    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      throw new Error('Failed to download PDF file');
    }
    
    console.log('PDF downloaded, size:', fileData.size, 'bytes');
    
    // Extract real text from PDF using PDF.js
    let pdfText = '';
    let totalPages = 0;
    
    try {
      console.log('Starting real PDF text extraction...');
      
      // Convert the file blob to ArrayBuffer
      const arrayBuffer = await fileData.arrayBuffer();
      console.log('PDF ArrayBuffer size:', arrayBuffer.byteLength);
      
      // Load PDF document
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
      }).promise;
      
      totalPages = pdf.numPages;
      console.log(`PDF has ${totalPages} pages`);
      
      // Extract text from each page
      const pageTexts = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Combine text items into readable text
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (pageText.length > 10) { // Only include pages with meaningful content
            pageTexts.push({
              pageNumber: pageNum,
              text: pageText
            });
            console.log(`Page ${pageNum}: extracted ${pageText.length} characters`);
          } else {
            console.log(`Page ${pageNum}: skipped (minimal content)`);
          }
        } catch (pageError) {
          console.error(`Error processing page ${pageNum}:`, pageError.message);
        }
      }
      
      // Combine all page texts
      pdfText = pageTexts.map(p => p.text).join('\n\n');
      console.log(`Total extracted text length: ${pdfText.length} characters`);
      
      // Check if extraction was successful
      if (pdfText.length < 100) {
        console.warn('Very little text extracted - PDF might be scanned or image-based');
        throw new Error('Insufficient text extracted from PDF');
      }
      
    } catch (extractionError) {
      console.error('PDF text extraction failed:', extractionError.message);
      
      // OCR fallback for scanned PDFs
      const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY');
      if (ocrApiKey && fileData.size < 10 * 1024 * 1024) { // Only try OCR for files < 10MB
        try {
          console.log('Attempting OCR fallback...');
          
          const formData = new FormData();
          formData.append('file', fileData, filename);
          formData.append('apikey', ocrApiKey);
          formData.append('language', 'eng');
          formData.append('isOverlayRequired', 'false');
          formData.append('filetype', 'PDF');
          
          const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData,
          });
          
          if (ocrResponse.ok) {
            const ocrResult = await ocrResponse.json();
            if (ocrResult.ParsedResults && ocrResult.ParsedResults[0]) {
              pdfText = ocrResult.ParsedResults[0].ParsedText || '';
              console.log(`OCR extracted ${pdfText.length} characters`);
            }
          }
        } catch (ocrError) {
          console.error('OCR fallback failed:', ocrError.message);
        }
      }
      
      // Final fallback - use filename-based content with clear indication
      if (pdfText.length < 50) {
        console.log('Using fallback content with filename-based hints');
        pdfText = `[Note: This appears to be a ${filename} document. The text extraction may have failed due to the PDF format or encoding. Please try re-uploading the document or contact support.]
        
        Document: ${filename}
        
        This document appears to contain educational content. Due to technical limitations in processing this specific PDF format, the full text content could not be extracted automatically. This may happen with:
        - Scanned documents or image-based PDFs
        - Password-protected PDFs  
        - PDFs with complex formatting or unusual encoding
        
        To get better results:
        1. Try converting the PDF to a text-searchable format
        2. Re-upload the document
        3. Contact support if the issue persists
        
        The system will still attempt to help with questions, but responses may be limited without the full document content.`;
      }
    }
    
    console.log('Extracted text length:', pdfText.length);
    
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