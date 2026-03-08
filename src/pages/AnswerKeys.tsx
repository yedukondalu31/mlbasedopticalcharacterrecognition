import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { Textarea } from "@/components/ui/textarea";
import AuthGuard from "@/components/AuthGuard";
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
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  Calendar,
  Hash,
  Grid3X3,
  Filter,
  X,
  ArrowUpDown,
  ClipboardPaste,
  List,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SortField = "name" | "questions" | "updated_at";
type SortOrder = "asc" | "desc";

const AnswerKeysContent = ({ session }: { session: Session }) => {
  const navigate = useNavigate();
  const { savedKeys, loading, saveAnswerKey, deleteAnswerKey, updateAnswerKey, refreshKeys } = useSavedAnswerKeys();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRollNumber, setFilterRollNumber] = useState<"all" | "yes" | "no">("all");
  const [filterSubjectCode, setFilterSubjectCode] = useState<"all" | "yes" | "no">("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<SavedAnswerKey | null>(null);
  const [editName, setEditName] = useState("");
  const [editAnswers, setEditAnswers] = useState<string[]>([]);
  const [editDetectRollNumber, setEditDetectRollNumber] = useState(true);
  const [editDetectSubjectCode, setEditDetectSubjectCode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editEntryMode, setEditEntryMode] = useState<"individual" | "bulk">("individual");
  const [editBulkText, setEditBulkText] = useState("");
  const [editDragIndex, setEditDragIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<SavedAnswerKey | null>(null);

  const filteredKeys = useMemo(() => {
    let result = savedKeys.filter((key) => {
      const matchesSearch =
        key.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.answers.length.toString().includes(searchQuery);
      const matchesRoll =
        filterRollNumber === "all" ||
        (filterRollNumber === "yes" && key.detect_roll_number) ||
        (filterRollNumber === "no" && !key.detect_roll_number);
      const matchesSubject =
        filterSubjectCode === "all" ||
        (filterSubjectCode === "yes" && key.detect_subject_code) ||
        (filterSubjectCode === "no" && !key.detect_subject_code);
      return matchesSearch && matchesRoll && matchesSubject;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name": comparison = a.name.localeCompare(b.name); break;
        case "questions": comparison = a.answers.length - b.answers.length; break;
        case "updated_at": comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break;
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
    setEditEntryMode("individual");
    setEditBulkText(key.answers.join(', '));
    setEditDragIndex(null);
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
      toast({ title: "Name required", description: "Please enter a name for the answer key", variant: "destructive" });
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
    const gridConfig = key.grid_rows && key.grid_columns ? { rows: key.grid_rows, columns: key.grid_columns } : undefined;
    await saveAnswerKey(`${key.name} (Copy)`, key.answers, gridConfig, key.detect_roll_number ?? true, key.detect_subject_code ?? true);
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

  const handleEditBulkApply = () => {
    const parsed = editBulkText.toUpperCase().split(/[\s,;]+/).map(s => s.trim()).filter(s => /^[A-E]$/.test(s));
    if (parsed.length === 0) {
      toast({ title: "No valid answers", description: "Enter A-E separated by commas or spaces", variant: "destructive" });
      return;
    }
    setEditAnswers(parsed);
    toast({ title: `${parsed.length} answers applied` });
    setEditEntryMode("individual");
  };

  const moveEditQuestion = (from: number, to: number) => {
    if (to < 0 || to >= editAnswers.length) return;
    const arr = [...editAnswers];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setEditAnswers(arr);
  };

  return (
    <div className="min-h-screen bg-background">
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
              <p className="text-sm text-muted-foreground">Manage your saved answer keys</p>
            </div>
            <Badge variant="secondary" className="text-base px-4 py-2">
              {savedKeys.length} key{savedKeys.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or question count..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterRollNumber} onValueChange={(v) => setFilterRollNumber(v as any)}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Roll Number" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roll No.</SelectItem>
                    <SelectItem value="yes">With Roll No.</SelectItem>
                    <SelectItem value="no">No Roll No.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={filterSubjectCode} onValueChange={(v) => setFilterSubjectCode(v as any)}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Subject Code" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  <SelectItem value="yes">With Subject</SelectItem>
                  <SelectItem value="no">No Subject</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-3 w-3" />Clear
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading answer keys...</p>
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="p-12 text-center">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">{savedKeys.length === 0 ? "No answer keys yet" : "No matching keys"}</h3>
              <p className="text-muted-foreground mb-4">{savedKeys.length === 0 ? "Save an answer key from the grading page to see it here" : "Try adjusting your search or filters"}</p>
              {hasActiveFilters && <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">Name<ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("questions")}>
                      <div className="flex items-center gap-1">Questions<ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead>Grid</TableHead>
                    <TableHead>Detection</TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("updated_at")}>
                      <div className="flex items-center gap-1">Last Updated<ArrowUpDown className="h-3 w-3" /></div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKeys.map((key) => (
                    <TableRow key={key.id} className="group">
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="gap-1"><Hash className="h-3 w-3" />{key.answers.length}</Badge></TableCell>
                      <TableCell>
                        {key.grid_rows && key.grid_columns ? (
                          <Badge variant="outline" className="gap-1"><Grid3X3 className="h-3 w-3" />{key.grid_rows}×{key.grid_columns}</Badge>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {key.detect_roll_number && <Badge variant="outline" className="text-xs">Roll</Badge>}
                          {key.detect_subject_code && <Badge variant="outline" className="text-xs">Subject</Badge>}
                          {!key.detect_roll_number && !key.detect_subject_code && <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Calendar className="h-3 w-3" />{format(new Date(key.updated_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(key)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(key)}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteClick(key)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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

        {!loading && filteredKeys.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            Showing {filteredKeys.length} of {savedKeys.length} answer key{savedKeys.length !== 1 ? "s" : ""}
          </p>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Answer Key</DialogTitle>
            <DialogDescription>Update the name, answers, and detection settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Answer key name" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={editDetectRollNumber} onCheckedChange={(c) => setEditDetectRollNumber(!!c)} id="edit-roll" />
                <Label htmlFor="edit-roll">Detect Roll Number</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={editDetectSubjectCode} onCheckedChange={(c) => setEditDetectSubjectCode(!!c)} id="edit-subject" />
                <Label htmlFor="edit-subject">Detect Subject Code</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant={editEntryMode === "individual" ? "default" : "ghost"} size="sm" onClick={() => setEditEntryMode("individual")} className="gap-1.5"><List className="h-3.5 w-3.5" />Individual</Button>
              <Button variant={editEntryMode === "bulk" ? "default" : "ghost"} size="sm" onClick={() => setEditEntryMode("bulk")} className="gap-1.5"><ClipboardPaste className="h-3.5 w-3.5" />Bulk</Button>
            </div>
            {editEntryMode === "bulk" ? (
              <div className="space-y-2">
                <Textarea value={editBulkText} onChange={(e) => setEditBulkText(e.target.value)} placeholder="A, B, C, D..." className="font-mono" />
                <Button size="sm" onClick={handleEditBulkApply}>Apply</Button>
              </div>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                {editAnswers.map((answer, index) => (
                  <div key={index} className="flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:border-border hover:bg-muted/30">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono w-8 text-right shrink-0">Q{index + 1}</span>
                    <div className="flex gap-1">
                      {['A', 'B', 'C', 'D', 'E'].map(opt => (
                        <button key={opt} type="button" onClick={() => handleEditAnswerChange(index, opt)}
                          className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${answer === opt ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEditQuestion(index, index - 1)} disabled={index === 0}><ArrowUp className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEditQuestion(index, index + 1)} disabled={index === editAnswers.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Answer Key</DialogTitle>
            <DialogDescription>Are you sure you want to delete "{keyToDelete?.name}"? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AnswerKeys = () => (
  <AuthGuard>
    {(session) => <AnswerKeysContent session={session} />}
  </AuthGuard>
);

export default AnswerKeys;
