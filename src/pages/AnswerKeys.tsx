import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { SavedAnswerKey, useSavedAnswerKeys } from "@/hooks/useSavedAnswerKeys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Key,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  Save,
  Calendar,
  Hash,
  Grid3X3,
  Filter,
  X,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SortField = "name" | "questions" | "updated_at";
type SortOrder = "asc" | "desc";

const AnswerKeys = () => {
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();
  const { savedKeys, loading, saveAnswerKey, deleteAnswerKey, updateAnswerKey, refreshKeys } = useSavedAnswerKeys();

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRollNumber, setFilterRollNumber] = useState<"all" | "yes" | "no">("all");
  const [filterSubjectCode, setFilterSubjectCode] = useState<"all" | "yes" | "no">("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<SavedAnswerKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editAnswers, setEditAnswers] = useState<string[]>([]);
  const [editDetectRollNumber, setEditDetectRollNumber] = useState(true);
  const [editDetectSubjectCode, setEditDetectSubjectCode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<SavedAnswerKey | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) navigate("/auth");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) navigate("/auth");
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Filtered and sorted keys
  const filteredKeys = useMemo(() => {
    let result = savedKeys.filter((key) => {
      // Search filter
      const matchesSearch =
        key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.answers.length.toString().includes(searchQuery);

      // Roll number filter
      const matchesRoll =
        filterRollNumber === "all" ||
        (filterRollNumber === "yes" && key.detect_roll_number) ||
        (filterRollNumber === "no" && !key.detect_roll_number);

      // Subject code filter
      const matchesSubject =
        filterSubjectCode === "all" ||
        (filterSubjectCode === "yes" && key.detect_subject_code) ||
        (filterSubjectCode === "no" && !key.detect_subject_code);

      return matchesSearch && matchesRoll && matchesSubject;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "questions":
          comparison = a.answers.length - b.answers.length;
          break;
        case "updated_at":
          comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [savedKeys, searchQuery, filterRollNumber, filterSubjectCode, sortField, sortOrder]);

  const hasActiveFilters = filterRollNumber !== "all" || filterSubjectCode !== "all";

  const clearFilters = () => {
    setFilterRollNumber("all");
    setFilterSubjectCode("all");
    setSearchQuery("");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleEditClick = (key: SavedAnswerKey) => {
    setEditingKey(key);
    setEditName(key.name);
    setEditAnswers([...key.answers]);
    setEditDetectRollNumber(key.detect_roll_number ?? true);
    setEditDetectSubjectCode(key.detect_subject_code ?? true);
    setEditDialogOpen(true);
  };

  const handleEditAnswerChange = (index: number, value: string) => {
    const upperValue = value.toUpperCase();
    if (upperValue === "" || /^[A-E]$/.test(upperValue)) {
      setEditAnswers((prev) => {
        const newAnswers = [...prev];
        newAnswers[index] = upperValue;
        return newAnswers;
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingKey) return;

    if (!editName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the answer key",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await updateAnswerKey(editingKey.id, {
      name: editName.trim(),
      answers: editAnswers,
      detect_roll_number: editDetectRollNumber,
      detect_subject_code: editDetectSubjectCode,
    });
    setIsSaving(false);
    setEditDialogOpen(false);
    setEditingKey(null);
  };

  const handleDuplicate = async (key: SavedAnswerKey) => {
    const gridConfig =
      key.grid_rows && key.grid_columns
        ? { rows: key.grid_rows, columns: key.grid_columns }
        : undefined;

    await saveAnswerKey(
      `${key.name} (Copy)`,
      key.answers,
      gridConfig,
      key.detect_roll_number ?? true,
      key.detect_subject_code ?? true
    );
  };

  const handleDeleteClick = (key: SavedAnswerKey) => {
    setKeyToDelete(key);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (keyToDelete) {
      await deleteAnswerKey(keyToDelete.id);
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Key className="h-6 w-6 text-primary" />
                Answer Keys
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your saved answer keys
              </p>
            </div>
            <Badge variant="secondary" className="text-base px-4 py-2">
              {savedKeys.length} key{savedKeys.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or question count..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={filterRollNumber}
                  onValueChange={(v) => setFilterRollNumber(v as "all" | "yes" | "no")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Roll Number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roll No.</SelectItem>
                    <SelectItem value="yes">With Roll No.</SelectItem>
                    <SelectItem value="no">No Roll No.</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select
                value={filterSubjectCode}
                onValueChange={(v) => setFilterSubjectCode(v as "all" | "yes" | "no")}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Subject Code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="yes">With Subject</SelectItem>
                  <SelectItem value="no">No Subject</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading answer keys...</p>
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">
                {savedKeys.length === 0 ? "No answer keys yet" : "No matching keys"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {savedKeys.length === 0
                  ? "Save an answer key from the grading page to see it here"
                  : "Try adjusting your search or filters"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("questions")}
                    >
                      <div className="flex items-center gap-1">
                        Questions
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Grid</TableHead>
                    <TableHead>Detection</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("updated_at")}
                    >
                      <div className="flex items-center gap-1">
                        Last Updated
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.map((key) => (
                    <TableRow key={key.id} className="group">
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Hash className="h-3 w-3" />
                          {key.answers.length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {key.grid_rows && key.grid_columns ? (
                          <Badge variant="outline" className="gap-1">
                            <Grid3X3 className="h-3 w-3" />
                            {key.grid_rows}×{key.grid_columns}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {key.detect_roll_number && (
                            <Badge variant="outline" className="text-xs">
                              Roll
                            </Badge>
                          )}
                          {key.detect_subject_code && (
                            <Badge variant="outline" className="text-xs">
                              Subject
                            </Badge>
                          )}
                          {!key.detect_roll_number && !key.detect_subject_code && (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(key.updated_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(key)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(key)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(key)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Results summary */}
        {!loading && filteredKeys.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredKeys.length} of {savedKeys.length} answer key
            {savedKeys.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Answer Key</DialogTitle>
            <DialogDescription>
              Modify the name, answers, and settings for this saved answer key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key-name">Name</Label>
              <Input
                id="edit-key-name"
                placeholder="e.g., Math Final Exam 2024"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Detection Settings */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-detect-roll"
                  checked={editDetectRollNumber}
                  onCheckedChange={(checked) => setEditDetectRollNumber(checked === true)}
                />
                <Label htmlFor="edit-detect-roll" className="text-sm">
                  Detect Roll Number
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-detect-subject"
                  checked={editDetectSubjectCode}
                  onCheckedChange={(checked) => setEditDetectSubjectCode(checked === true)}
                />
                <Label htmlFor="edit-detect-subject" className="text-sm">
                  Detect Subject Code
                </Label>
              </div>
            </div>

            {/* Answer Grid */}
            <div className="space-y-2">
              <Label>Answers ({editAnswers.length} questions)</Label>
              <Card className="p-3 bg-muted/30">
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-64 overflow-y-auto">
                  {editAnswers.map((answer, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground mb-1">{index + 1}</span>
                      <Input
                        value={answer}
                        onChange={(e) => handleEditAnswerChange(index, e.target.value)}
                        maxLength={1}
                        className="w-10 h-10 text-center text-lg font-bold p-0"
                      />
                    </div>
                  ))}
                </div>
              </Card>
              <p className="text-xs text-muted-foreground">
                Valid answers: A, B, C, D, E (case insensitive)
              </p>
            </div>

            {editingKey?.grid_rows && editingKey?.grid_columns && (
              <Card className="p-3 bg-muted/50">
                <p className="text-sm">
                  <span className="font-medium">Grid Configuration:</span>{" "}
                  {editingKey.grid_rows} × {editingKey.grid_columns}
                </p>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Answer Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{keyToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnswerKeys;
