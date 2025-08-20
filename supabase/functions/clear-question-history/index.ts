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
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const { classId } = await req.json();
    
    if (!classId) {
      return new Response(
        JSON.stringify({ error: 'Class ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Clearing question history for class ${classId} by user ${user.id}`);

    // Verify that the user is the teacher of this class
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('teacher_id')
      .eq('id', classId)
      .single();

    if (classError) {
      console.error('Error fetching class:', classError);
      return new Response(
        JSON.stringify({ error: 'Class not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (classData.teacher_id !== user.id) {
      console.error(`User ${user.id} is not the teacher of class ${classId}`);
      return new Response(
        JSON.stringify({ error: 'You are not authorized to clear this class\'s question history' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Delete all question analytics for this class
    const { error: deleteError, count } = await supabase
      .from('question_analytics')
      .delete()
      .eq('class_id', classId);

    if (deleteError) {
      console.error('Error deleting question analytics:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to clear question history' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Successfully cleared ${count || 0} question records for class ${classId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleared ${count || 0} question records`,
        deletedCount: count || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});