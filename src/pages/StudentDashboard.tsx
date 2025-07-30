import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Brain, GraduationCap, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  teacher: string;
  description?: string;
}

const StudentDashboard = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [userSchool, setUserSchool] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/signin");
        return;
      }
      
      // Check if user has student role and get school
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, school")
        .eq("user_id", session.user.id)
        .single();
      
      if (!profile?.role) {
        navigate("/role-selection");
        return;
      }
      
      if (profile.role !== "student" && profile.role !== "admin") {
        navigate("/teacher-dashboard");
        return;
      }
      
      setUserSchool(profile.school || "");
      fetchClasses();
    };
    
    checkAuth();
  }, [navigate]);

  const fetchClasses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch classes the student is enrolled in
      const { data: enrollmentData, error } = await supabase
        .from('enrollments')
        .select(`
          class_id,
          classes!inner (
            id,
            name,
            subject,
            description,
            teacher_id
          )
        `)
        .eq('student_id', session.user.id);

      if (error) {
        console.error("Error fetching classes:", error);
        toast({
          title: "Error",
          description: "Failed to load your classes.",
          variant: "destructive",
        });
        return;
      }

      // Fetch teacher profiles separately
      const teacherIds = enrollmentData?.map((enrollment: any) => enrollment.classes.teacher_id) || [];
      const { data: teacherProfiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', teacherIds);

      // Transform data for display
      const transformedClasses = enrollmentData?.map((enrollment: any) => {
        const classData = enrollment.classes;
        const teacher = teacherProfiles?.find(t => t.user_id === classData.teacher_id);
        return {
          id: classData.id,
          name: classData.name,
          subject: classData.subject,
          description: classData.description,
          teacher: teacher ? `${teacher.first_name} ${teacher.last_name}` : "Unknown Teacher",
        };
      }) || [];

      setClasses(transformedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async () => {
    if (!classCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a class code.",
        variant: "destructive",
      });
      return;
    }

    setJoinLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // First, find the class by code
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name, subject')
        .eq('class_code', classCode.trim().toUpperCase())
        .single();

      if (classError || !classData) {
        toast({
          title: "Error",
          description: "Invalid class code. Please check and try again.",
          variant: "destructive",
        });
        return;
      }

      // Check if already enrolled
      const { data: existingEnrollment, error: checkError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', session.user.id)
        .eq('class_id', classData.id)
        .single();

      if (existingEnrollment) {
        toast({
          title: "Already Enrolled",
          description: "You are already enrolled in this class.",
          variant: "destructive",
        });
        return;
      }

      // Enroll the student
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          student_id: session.user.id,
          class_id: classData.id
        });

      if (enrollError) {
        throw enrollError;
      }

      toast({
        title: "Success!",
        description: `You've joined ${classData.name}!`,
      });

      setShowJoinDialog(false);
      setClassCode("");
      fetchClasses(); // Refresh the classes list
    } catch (error) {
      console.error("Error joining class:", error);
      toast({
        title: "Error",
        description: "Failed to join class. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoinLoading(false);
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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold heading-gradient mb-4">
                Student Dashboard
              </h1>
              <p className="text-xl text-muted-foreground">
                {userSchool && `${userSchool} • `}Access your classes and AI tutors
              </p>
            </div>
            
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogTrigger asChild>
                <Button variant="hero" size="lg" className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="classCode">Class Code *</Label>
                    <Input
                      id="classCode"
                      type="text"
                      placeholder="Enter 6-character class code"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="uppercase font-mono"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Ask your teacher for the class code
                    </p>
                  </div>
                  <Button 
                    onClick={handleJoinClass}
                    disabled={joinLoading}
                    className="w-full"
                    variant="hero"
                  >
                    {joinLoading ? "Joining..." : "Join Class"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {classes.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No classes joined yet</h3>
                <p className="text-muted-foreground mb-6">
                  Ask your teacher for a class code to join your first class
                </p>
                <Button variant="hero" onClick={() => setShowJoinDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Join Your First Class
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((classItem) => (
                <Card key={classItem.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{classItem.name}</span>
                      <BookOpen className="w-5 h-5 text-primary" />
                    </CardTitle>
                    <CardDescription>
                      {classItem.subject} • {classItem.teacher}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground mb-4">{classItem.description}</p>
                    )}
                    <Button 
                      variant="hero" 
                      className="w-full flex items-center gap-2"
                      onClick={() => navigate(`/class/${classItem.id}/ai-tutor`)}
                    >
                      <Brain className="w-4 h-4" />
                      Ask AI Tutor
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;