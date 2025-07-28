import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import RoleSelection from "./pages/RoleSelection";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassDashboard from "./pages/ClassDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import AITutorDashboard from "./pages/AITutorDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
          <Route path="/class/:classId" element={<ClassDashboard />} />
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/ai-tutor" element={<AITutorDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;