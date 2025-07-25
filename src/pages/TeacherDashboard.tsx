import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, Users, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  description?: string;
  student_count: number;
  class_code: string;
}

const TeacherDashboard = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClass, setNewClass] = useState({ name: "", subject: "", description: "" });
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
      
      if (profile.role !== "teacher") {
        navigate("/student-dashboard");
        return;
      }
      
      fetchClasses();
    };
    
    checkAuth();
  }, [navigate]);

  const fetchClasses = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch classes from database
      const { data: classesData, error } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          subject,
          description,
          class_code,
          enrollments(count)
        `)
        .eq('teacher_id', session.user.id);

      if (error) {
        console.error("Error fetching classes:", error);
        toast({
          title: "Error",
          description: "Failed to load classes.",
          variant: "destructive",
        });
        return;
      }

      // Transform data to include student count
      const transformedClasses = classesData?.map((classItem: any) => ({
        id: classItem.id,
        name: classItem.name,
        subject: classItem.subject,
        description: classItem.description,
        class_code: classItem.class_code,
        student_count: classItem.enrollments?.length || 0,
      })) || [];

      setClasses(transformedClasses);
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!newClass.name || !newClass.subject) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setCreateLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Generate a unique class code
      const { data: classCode, error: codeError } = await supabase.rpc('generate_class_code');
      if (codeError) {
        throw codeError;
      }

      // Insert new class into database
      const { data: newClassData, error } = await supabase
        .from('classes')
        .insert({
          teacher_id: session.user.id,
          name: newClass.name,
          subject: newClass.subject,
          description: newClass.description || null,
          class_code: classCode
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Add the new class to the UI
      const newClassItem: ClassItem = {
        id: newClassData.id,
        name: newClassData.name,
        subject: newClassData.subject,
        description: newClassData.description,
        class_code: newClassData.class_code,
        student_count: 0,
      };
      
      setClasses(prev => [...prev, newClassItem]);
      setShowCreateDialog(false);
      setNewClass({ name: "", subject: "", description: "" });
      
      toast({
        title: "Success!",
        description: `Class created with code: ${classCode}`,
      });
    } catch (error) {
      console.error("Error creating class:", error);
      toast({
        title: "Error",
        description: "Failed to create class. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold heading-gradient mb-4">
                Teacher Dashboard
              </h1>
              <p className="text-xl text-muted-foreground">
                Manage your classes and course materials
              </p>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button variant="hero" size="lg" className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Class</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="className">Class Name *</Label>
                    <Input
                      id="className"
                      type="text"
                      placeholder="e.g., Introduction to Biology"
                      value={newClass.name}
                      onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      type="text"
                      placeholder="e.g., Biology"
                      value={newClass.subject}
                      onChange={(e) => setNewClass(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      type="text"
                      placeholder="Brief description of the class"
                      value={newClass.description}
                      onChange={(e) => setNewClass(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateClass}
                    disabled={createLoading}
                    className="w-full"
                    variant="hero"
                  >
                    {createLoading ? "Creating..." : "Create Class"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {classes.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No classes yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first class to start uploading course materials and training AI tutors
                </p>
                <Button variant="hero" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Class
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((classItem) => (
                <Card key={classItem.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{classItem.name}</span>
                      <BookOpen className="w-5 h-5 text-primary" />
                    </CardTitle>
                    <CardDescription>{classItem.subject}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {classItem.description && (
                      <p className="text-sm text-muted-foreground mb-4">{classItem.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Users className="w-4 h-4" />
                      <span>{classItem.student_count} students</span>
                    </div>
                    <div className="flex items-center justify-between bg-muted p-2 rounded mb-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Class Code:</span>
                        <div className="font-mono font-semibold text-sm">{classItem.class_code}</div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClassCode(classItem.class_code);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => navigate("/dashboard")}
                    >
                      Manage Materials
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

export default TeacherDashboard;