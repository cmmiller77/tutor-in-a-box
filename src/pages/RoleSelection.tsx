import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain, GraduationCap, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";

const RoleSelection = () => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/signin");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleRoleSelection = async () => {
    if (!selectedRole) return;
    
    setLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/signin");
        return;
      }

      // Update user profile with role
      const { error } = await supabase
        .from("profiles")
        .update({ role: selectedRole })
        .eq("user_id", session.user.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update profile. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Navigate based on role
      if (selectedRole === "teacher") {
        navigate("/teacher-dashboard");
      } else {
        navigate("/student-dashboard");
      }

      toast({
        title: "Success!",
        description: `Welcome! You're all set as a ${selectedRole}.`,
      });
    } catch (error) {
      console.error("Role selection error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Brain className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold heading-gradient mb-4">
              Welcome to Grad.ai!
            </h1>
            <p className="text-xl text-muted-foreground">
              Let's get you set up. Are you a teacher or a student?
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card 
              className={`cursor-pointer transition-all hover:scale-105 ${
                selectedRole === "teacher" ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onClick={() => setSelectedRole("teacher")}
            >
              <CardHeader className="text-center">
                <GraduationCap className="w-12 h-12 text-primary mx-auto mb-2" />
                <CardTitle>I'm a Teacher</CardTitle>
                <CardDescription>
                  Upload course materials and create AI tutors for your classes
                </CardDescription>
              </CardHeader>
            </Card>

            <Card 
              className={`cursor-pointer transition-all hover:scale-105 ${
                selectedRole === "student" ? "ring-2 ring-primary bg-primary/5" : ""
              }`}
              onClick={() => setSelectedRole("student")}
            >
              <CardHeader className="text-center">
                <BookOpen className="w-12 h-12 text-primary mx-auto mb-2" />
                <CardTitle>I'm a Student</CardTitle>
                <CardDescription>
                  Access AI tutors for your classes and get personalized help
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              onClick={handleRoleSelection}
              disabled={!selectedRole || loading}
              variant="hero"
              size="lg"
              className="px-8"
            >
              {loading ? "Setting up..." : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;