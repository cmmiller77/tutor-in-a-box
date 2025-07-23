import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, BookOpen, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

interface ClassItem {
  id: string;
  name: string;
  subject: string;
  description?: string;
  student_count: number;
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

      // Mock data for now - replace with actual database query later
      setClasses([
        { id: "1", name: "Introduction to Biology", subject: "Biology", student_count: 25 },
        { id: "2", name: "Advanced Mathematics", subject: "Mathematics", student_count: 18 },
      ]);
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
      // Mock creation for now - replace with actual database insert later
      const mockClass: ClassItem = {
        id: Date.now().toString(),
        name: newClass.name,
        subject: newClass.subject,
        description: newClass.description,
        student_count: 0,
      };
      
      setClasses(prev => [...prev, mockClass]);
      setShowCreateDialog(false);
      setNewClass({ name: "", subject: "", description: "" });
      
      toast({
        title: "Success!",
        description: "Class created successfully.",
      });
      
      // Navigate to upload materials for this class
      navigate("/dashboard");
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Users className="w-4 h-4" />
                      <span>{classItem.student_count} students</span>
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