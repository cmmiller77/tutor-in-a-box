import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== REPROCESSING PDF ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceFile } = await req.json();
    console.log('Reprocessing file:', sourceFile);
    
    if (!sourceFile) {
      throw new Error('Missing required field: sourceFile');
    }
    
    // Setup Supabase and authenticate
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }
    
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
    
    // Delete existing chunks for this file
    console.log('Deleting existing chunks for:', sourceFile);
    const { error: deleteError } = await supabase
      .from('chunks')
      .delete()
      .eq('user_id', user.id)
      .eq('source_file', sourceFile);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw new Error('Failed to delete existing chunks');
    }
    
    // Find the file in storage to get the path
    const { data: files, error: listError } = await supabase.storage
      .from('pdfs')
      .list('', {
        search: sourceFile
      });
    
    if (listError || !files || files.length === 0) {
      throw new Error('File not found in storage');
    }
    
    const filePath = files[0].name;
    console.log('Found file path:', filePath);
    
    // Call the process-pdf function to reprocess
    const processResponse = await supabase.functions.invoke('process-pdf', {
      body: {
        filePath: filePath,
        filename: sourceFile
      }
    });
    
    if (processResponse.error) {
      throw new Error(`Reprocessing failed: ${processResponse.error.message}`);
    }
    
    console.log('✅ Reprocessing completed successfully');
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `File ${sourceFile} has been reprocessed successfully. You can now ask questions about the updated content.`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Reprocessing error:', error.message);
    
    return new Response(JSON.stringify({ 
      error: 'Reprocessing failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});