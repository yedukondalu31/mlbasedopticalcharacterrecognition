import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Filter, Eye, Calendar, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Evaluation {
  id: string;
  roll_number: string | null;
  subject_code: string | null;
  score: number;
  total_questions: number;
  accuracy: number;
  confidence: string | null;
  created_at: string;
  extracted_answers: string[];
  correct_answers: string[];
  detailed_results: any;
  image_url: string;
}

const History = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [filteredEvaluations, setFilteredEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRollNumber, setSearchRollNumber] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate('/auth');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) navigate('/auth');
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session) {
      fetchEvaluations();
    }
  }, [session]);

  useEffect(() => {
    applyFilters();
  }, [searchRollNumber, selectedSubject, selectedDate, evaluations]);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('evaluations')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setEvaluations(data || []);
      setFilteredEvaluations(data || []);
    } catch (error) {
      console.error("Error fetching evaluations:", error);
      toast({
        title: "Error",
        description: "Failed to load evaluation history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...evaluations];

    // Filter by roll number
    if (searchRollNumber) {
      filtered = filtered.filter(e => 
        e.roll_number?.toLowerCase().includes(searchRollNumber.toLowerCase())
      );
    }

    // Filter by subject code
    if (selectedSubject && selectedSubject !== "all") {
      filtered = filtered.filter(e => e.subject_code === selectedSubject);
    }

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter(e => {
        const evalDate = format(new Date(e.created_at), 'yyyy-MM-dd');
        return evalDate === selectedDate;
      });
    }

    setFilteredEvaluations(filtered);
  };

  const getUniqueSubjects = () => {
    const subjects = evaluations
      .map(e => e.subject_code)
      .filter((value, index, self) => value && self.indexOf(value) === index)
      .sort();
    return subjects as string[];
  };

  const handleViewDetails = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setDialogOpen(true);
  };

  const getConfidenceBadge = (confidence: string | null) => {
    if (!confidence) return <Badge variant="secondary">Unknown</Badge>;
    
    const variant = confidence === "high" ? "default" : 
                   confidence === "medium" ? "secondary" : "destructive";
    
    return <Badge variant={variant}>{confidence.toUpperCase()}</Badge>;
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-hero text-primary-foreground py-6 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">Evaluation History</h1>
                <p className="text-sm text-primary-foreground/80">View and filter past evaluations</p>
              </div>
            </div>
            <div className="text-sm">
              <span className="text-primary-foreground/80">Total: </span>
              <span className="font-bold">{filteredEvaluations.length}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Filter evaluations by roll number, subject, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Roll Number Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Roll Number</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search roll number..."
                    value={searchRollNumber}
                    onChange={(e) => setSearchRollNumber(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Subject Code Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Code</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All subjects</SelectItem>
                    {getUniqueSubjects().map(subject => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {(searchRollNumber || selectedSubject !== "all" || selectedDate) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setSearchRollNumber("");
                  setSelectedSubject("all");
                  setSelectedDate("");
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Evaluations</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : `Showing ${filteredEvaluations.length} of ${evaluations.length} evaluations`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading evaluations...</div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No evaluations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Roll Number</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvaluations.map((evaluation) => (
                      <TableRow key={evaluation.id}>
                        <TableCell className="text-sm">
                          {format(new Date(evaluation.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {evaluation.roll_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{evaluation.subject_code || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {evaluation.score}/{evaluation.total_questions}
                        </TableCell>
                        <TableCell>
                          <Badge variant={evaluation.accuracy >= 80 ? "default" : evaluation.accuracy >= 60 ? "secondary" : "destructive"}>
                            {evaluation.accuracy.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getConfidenceBadge(evaluation.confidence)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleViewDetails(evaluation)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Evaluation Details
              {selectedEvaluation?.roll_number && (
                <Badge variant="outline" className="ml-2">
                  {selectedEvaluation.roll_number}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedEvaluation && format(new Date(selectedEvaluation.created_at), 'MMMM dd, yyyy HH:mm')}
            </DialogDescription>
          </DialogHeader>

          {selectedEvaluation && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedEvaluation.score}/{selectedEvaluation.total_questions}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Accuracy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {selectedEvaluation.accuracy.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Confidence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {getConfidenceBadge(selectedEvaluation.confidence)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Subject</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="outline">{selectedEvaluation.subject_code || 'N/A'}</Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Answer Sheet Image */}
              {selectedEvaluation.image_url && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Answer Sheet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <img 
                      src={selectedEvaluation.image_url} 
                      alt="Answer sheet" 
                      className="w-full rounded-lg border"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Detailed Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Answer Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {selectedEvaluation.extracted_answers.map((extracted, index) => {
                      const correct = selectedEvaluation.correct_answers[index];
                      const isCorrect = extracted === correct;
                      
                      return (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect 
                              ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                              : 'border-red-500 bg-red-50 dark:bg-red-950'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">Q{index + 1}</div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold">{extracted || '-'}</span>
                            <span className="text-xs text-muted-foreground">/ {correct}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;
