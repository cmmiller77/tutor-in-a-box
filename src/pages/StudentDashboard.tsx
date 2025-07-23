import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Brain, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [userSchool, setUserSchool] = useState("");
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
      
      if (profile.role !== "student") {
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
      // Mock data for now - replace with actual database query later
      setClasses([
        { 
          id: "1", 
          name: "Introduction to Biology", 
          subject: "Biology", 
          teacher: "Dr. Smith",
          description: "Basic principles of biology and life sciences"
        },
        { 
          id: "2", 
          name: "Advanced Mathematics", 
          subject: "Mathematics", 
          teacher: "Prof. Johnson",
          description: "Calculus and advanced mathematical concepts"
        },
        { 
          id: "3", 
          name: "World History", 
          subject: "History", 
          teacher: "Ms. Davis",
          description: "Comprehensive overview of world historical events"
        },
      ]);
    } catch (error) {
      console.error("Error fetching classes:", error);
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

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold heading-gradient mb-4">
              Student Dashboard
            </h1>
            <p className="text-xl text-muted-foreground">
              {userSchool && `${userSchool} • `}Access your classes and AI tutors
            </p>
          </div>

          {classes.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <GraduationCap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No classes available</h3>
                <p className="text-muted-foreground">
                  Your teachers haven't added any classes yet. Check back later!
                </p>
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
                      onClick={() => navigate("/ai-tutor")}
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