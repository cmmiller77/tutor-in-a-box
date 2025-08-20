import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar, MessageSquare, BookOpen, TrendingUp, Users, Activity, Trash2 } from "lucide-react";

interface QuestionData {
  id: string;
  question: string;
  subject: string;
  derived_subject: string;
  derived_topics: string[];
  sources_found: number;
  response_generated: boolean;
  created_at: string;
  user_id: string;
}

interface DailyStats {
  date: string;
  questions: number;
  successful_responses: number;
}

interface SubjectStats {
  subject: string;
  count: number;
  percentage: number;
}

interface TopQuestion {
  question: string;
  frequency: number;
  success_rate: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface QuestionAnalyticsProps {
  classId?: string;
  className?: string;
}

const QuestionAnalytics = ({ classId, className }: QuestionAnalyticsProps) => {
  const [questionData, setQuestionData] = useState<QuestionData[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [clearingHistory, setClearingHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [classId]);

  const fetchAnalyticsData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let query = supabase
        .from('question_analytics')
        .select('*');
      
      // Filter by specific class if classId is provided
      if (classId) {
        query = query.eq('class_id', classId);
      } else {
        // For teachers viewing all classes, we need to check if they own the classes
        // First get the teacher's classes
        const { data: teacherClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('teacher_id', session.user.id);
        
        if (teacherClasses && teacherClasses.length > 0) {
          const classIds = teacherClasses.map(c => c.id);
          query = query.in('class_id', classIds);
        } else {
          // No classes found, return empty data
          setQuestionData([]);
          setTotalQuestions(0);
          setSuccessRate(0);
          setActiveStudents(0);
          setDailyStats([]);
          setSubjectStats([]);
          setTopQuestions([]);
          setLoading(false);
          return;
        }
      }
      
      const { data: questions, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching analytics:", error);
        toast({
          title: "Error",
          description: "Failed to load analytics data.",
          variant: "destructive",
        });
        return;
      }

      const questionsData = questions || [];
      setQuestionData(questionsData);
      setTotalQuestions(questionsData.length);
      
      // Calculate success rate
      const successfulQuestions = questionsData.filter(q => q.response_generated).length;
      setSuccessRate(questionsData.length > 0 ? Math.round((successfulQuestions / questionsData.length) * 100) : 0);

      // Count active students (students who have asked questions)
      const uniqueStudents = new Set(questionsData.map(q => q.user_id)).size;
      setActiveStudents(uniqueStudents);

      // Process daily statistics
      const dailyData = processDailyStats(questionsData);
      setDailyStats(dailyData);

      // Process subject statistics
      const subjectData = processSubjectStats(questionsData);
      setSubjectStats(subjectData);

      // Process top questions
      const topQuestionsData = processTopQuestions(questionsData);
      setTopQuestions(topQuestionsData);

    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processDailyStats = (questions: QuestionData[]): DailyStats[] => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last30Days.map(date => {
      const dayQuestions = questions.filter(q => 
        q.created_at.split('T')[0] === date
      );
      
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        questions: dayQuestions.length,
        successful_responses: dayQuestions.filter(q => q.response_generated).length
      };
    });
  };

  const processSubjectStats = (questions: QuestionData[]): SubjectStats[] => {
    // Use derived topics to create a more detailed subject breakdown
    const topicCounts = questions.reduce((acc, q) => {
      // First, try to use derived topics if available
      if (q.derived_topics && q.derived_topics.length > 0) {
        q.derived_topics.forEach(topic => {
          if (topic && topic.trim()) {
            acc[topic.trim()] = (acc[topic.trim()] || 0) + 1;
          }
        });
      } 
      // Fallback to derived subject if no topics
      else if (q.derived_subject) {
        acc[q.derived_subject] = (acc[q.derived_subject] || 0) + 1;
      }
      // Final fallback to original subject
      else if (q.subject) {
        acc[q.subject] = (acc[q.subject] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const total = Object.values(topicCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(topicCounts)
      .map(([subject, count]) => ({
        subject,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const processTopQuestions = (questions: QuestionData[]): TopQuestion[] => {
    const questionCounts = questions.reduce((acc, q) => {
      const normalized = q.question.toLowerCase().trim();
      if (!acc[normalized]) {
        acc[normalized] = { original: q.question, count: 0, successful: 0 };
      }
      acc[normalized].count++;
      if (q.response_generated) {
        acc[normalized].successful++;
      }
      return acc;
    }, {} as Record<string, { original: string; count: number; successful: number }>);

    return Object.values(questionCounts)
      .filter(item => item.count > 1) // Only show questions asked multiple times
      .map(item => ({
        question: item.original,
        frequency: item.count,
        success_rate: Math.round((item.successful / item.count) * 100)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  };

  const handleClearHistory = async () => {
    if (!classId) return;
    
    setClearingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to clear question history.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke('clear-question-history', {
        body: { classId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to clear question history');
      }

      const { deletedCount } = response.data;
      
      toast({
        title: "Success",
        description: `Cleared ${deletedCount} question records from this class.`,
      });

      // Refresh the analytics data
      fetchAnalyticsData();
      
    } catch (error) {
      console.error("Error clearing history:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear question history.",
        variant: "destructive",
      });
    } finally {
      setClearingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-lg">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const chartConfig = {
    questions: {
      label: "Questions",
      color: "hsl(var(--primary))",
    },
    successful_responses: {
      label: "Successful Responses",
      color: "hsl(var(--secondary))",
    },
  };

  return (
    <div className="space-y-6">
      {className && (
        <div className="mb-4 flex justify-between items-start">
          <div>
            <h3 className="text-xl font-semibold">{className} Analytics</h3>
            <p className="text-muted-foreground">Question analytics for this class</p>
          </div>
          {classId && totalQuestions > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Clear History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Question History</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {totalQuestions} question records for this class. 
                    This action cannot be undone. Students will be able to ask new questions normally, 
                    but all previous analytics data will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearHistory}
                    disabled={clearingHistory}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {clearingHistory ? "Clearing..." : "Clear History"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Questions</p>
                <p className="text-2xl font-bold">{totalQuestions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Students</p>
                <p className="text-2xl font-bold">{activeStudents}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Avg. Daily Questions</p>
                <p className="text-2xl font-bold">
                  {Math.round(dailyStats.reduce((sum, day) => sum + day.questions, 0) / 30)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="space-y-4">
        <TabsList>
          <TabsTrigger value="daily">Daily Activity</TabsTrigger>
          <TabsTrigger value="subjects">Subject Distribution</TabsTrigger>
          <TabsTrigger value="questions">Common Questions</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Question Activity (Last 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="questions" 
                      stroke="var(--color-questions)" 
                      strokeWidth={2}
                      name="Total Questions"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="successful_responses" 
                      stroke="var(--color-successful_responses)" 
                      strokeWidth={2}
                      name="Successful Responses"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Subject Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={subjectStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ subject, percentage }) => `${subject} (${percentage}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {subjectStats.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Subjects by Question Count</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subjectStats} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="subject" type="category" width={80} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Most Common Questions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topQuestions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No frequently asked questions yet. Students need to ask questions multiple times for them to appear here.
                </p>
              ) : (
                <div className="space-y-4">
                  {topQuestions.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-medium">{item.question}</p>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Asked {item.frequency} times</span>
                          <span className={`${item.success_rate >= 80 ? 'text-green-600' : item.success_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {item.success_rate}% success rate
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${(item.frequency / Math.max(...topQuestions.map(q => q.frequency))) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default QuestionAnalytics;