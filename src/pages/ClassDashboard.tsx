import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, Users, Copy, BarChart3, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import QuestionAnalytics from "@/components/QuestionAnalytics";
import UploadSection from "@/components/UploadSection";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  description?: string;
  student_count: number;
  class_code: string;
}

const ClassDashboard = () => {
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
      
      // Check if user has teacher role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      
      if (!profile?.role) {
        navigate("/role-selection");
        return;
      }
      
      if (profile.role !== "teacher" && profile.role !== "admin") {
        navigate("/student-dashboard");
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

      // Fetch class data
      const { data: classInfo, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          description,
          class_code,
          enrollments(count)
        `)
        .eq('id', classId)
        .eq('teacher_id', session.user.id)
        .single();

      if (error) {
        console.error("Error fetching class:", error);
        toast({
          title: "Error",
          description: "Failed to load class data.",
          variant: "destructive",
        });
        navigate("/teacher-dashboard");
        return;
      }

      if (!classInfo) {
        toast({
          title: "Error",
          description: "Class not found or you don't have access to it.",
          variant: "destructive",
        });
        navigate("/teacher-dashboard");
        return;
      }

      // Transform data to include student count
      const transformedClass: ClassItem = {
        id: classInfo.id,
        name: classInfo.name,
        subject: classInfo.subject,
        description: classInfo.description,
        class_code: classInfo.class_code,
        student_count: classInfo.enrollments?.length || 0,
      };

      setClassData(transformedClass);
    } catch (error) {
      console.error("Error fetching class:", error);
      toast({
        title: "Error",
        description: "Failed to load class data.",
        variant: "destructive",
      });
      navigate("/teacher-dashboard");
    } finally {
      setLoading(false);
    }
  };

  const copyClassCode = (classCode: string) => {
    navigator.clipboard.writeText(classCode);
    toast({
      title: "Copied!",
      description: "Class code copied to clipboard.",
    });
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
          <Button onClick={() => navigate("/teacher-dashboard")} className="mt-4">
            Back to Dashboard
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
              onClick={() => navigate("/teacher-dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold heading-gradient mb-2">
                {classData.name}
              </h1>
              <p className="text-xl text-muted-foreground mb-2">
                {classData.subject}
              </p>
              {classData.description && (
                <p className="text-muted-foreground">{classData.description}</p>
              )}
            </div>
            
            <Card className="w-64">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Users className="w-4 h-4" />
                  <span>{classData.student_count} students enrolled</span>
                </div>
                <div className="flex items-center justify-between bg-muted p-2 rounded">
                  <div>
                    <span className="text-xs text-muted-foreground">Class Code:</span>
                    <div className="font-mono font-semibold text-sm">{classData.class_code}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyClassCode(classData.class_code)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Materials
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Students
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{classData.student_count}</p>
                    <p className="text-sm text-muted-foreground">Students enrolled</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Materials
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Course materials</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">0</p>
                    <p className="text-sm text-muted-foreground">Questions asked today</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest student interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity. Students will appear here once they start asking questions.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="materials" className="space-y-6">
              <UploadSection classId={classData.id} />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <QuestionAnalytics 
                classId={classData.id} 
                className={classData.name}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Class Settings</CardTitle>
                  <CardDescription>Manage class configuration and preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Class Information</h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">Class Name</label>
                          <p className="text-sm text-muted-foreground">{classData.name}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Subject</label>
                          <p className="text-sm text-muted-foreground">{classData.subject}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Access Control</h4>
                      <div>
                        <label className="text-sm font-medium">Class Code</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-muted px-2 py-1 rounded text-sm">{classData.class_code}</code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyClassCode(classData.class_code)}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ClassDashboard;