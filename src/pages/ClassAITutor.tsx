import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import AITutor from "@/components/AITutor";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  description?: string;
  class_code: string;
}

const ClassAITutor = () => {
  const { classId } = useParams<{ classId: string }>();
  const [classData, setClassData] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/signin");
        return;
      }
      
      // Check if user has teacher role or is a student enrolled in this class
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      
      if (!profile?.role) {
        navigate("/role-selection");
        return;
      }
      
      fetchClassData();
    };
    
    checkAuth();
  }, [navigate, classId]);

  const fetchClassData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !classId) return;

      // Fetch class data - check if user is teacher or enrolled student
      const { data: classInfo, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          description,
          class_code,
          teacher_id
        `)
        .eq('id', classId)
        .single();

      if (error) {
        console.error("Error fetching class:", error);
        toast({
          title: "Error",
          description: "Failed to load class data.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (!classInfo) {
        toast({
          title: "Error",
          description: "Class not found.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Check if user has access (is teacher or enrolled student)
      const isTeacher = classInfo.teacher_id === session.user.id;
      let hasAccess = isTeacher;

      if (!isTeacher) {
        // Check if student is enrolled
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('id')
          .eq('class_id', classId)
          .eq('student_id', session.user.id)
          .single();
        
        hasAccess = !!enrollment;
      }

      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have access to this class.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setClassData({
        id: classInfo.id,
        name: classInfo.name,
        subject: classInfo.subject,
        description: classInfo.description,
        class_code: classInfo.class_code,
      });
    } catch (error) {
      console.error("Error fetching class:", error);
      toast({
        title: "Error",
        description: "Failed to load class data.",
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Class not found</div>
          <Button onClick={() => navigate("/")} className="mt-4">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/class/${classId}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Class
            </Button>
          </div>

          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold heading-gradient mb-2">
              AI Tutor
            </h1>
            <p className="text-xl text-muted-foreground mb-2">
              {classData.name} - {classData.subject}
            </p>
            <p className="text-muted-foreground">
              Ask questions about your course materials and get instant help from your AI tutor.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat with AI Tutor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AITutor classId={classData.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClassAITutor;