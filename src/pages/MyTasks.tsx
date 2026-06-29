import { useAppStore } from "@/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { VoiceOrb } from "@/components/VoiceOrb";
import { useState, useMemo } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Star, 
  Edit3, 
  Trash2, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  Bot, 
  Check, 
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import { Task } from "@/types";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function MyTasks() {
  const navigate = useNavigate();
  const { 
    tasks, 
    addTask, 
    updateTask, 
    deleteTask, 
    primaryFocusTaskId, 
    setPrimaryFocusTaskId,
    geminiApiKey,
    triggerAutoAIPlan 
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"deadline" | "priority" | "createdAt">("deadline");

  // State for Add Task modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    urgency: 5,
    impact: 5,
    effort: 5
  });

  // State for Edit Task modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Filter & Sort Tasks
  const processedTasks = useMemo(() => {
    let result = [...tasks];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(t => t.status === statusFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "deadline") {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      } else if (sortBy === "priority") {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [tasks, searchQuery, statusFilter, sortBy]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.deadline) {
      toast.error("Please provide both title and deadline.");
      return;
    }

    const priority = (newTask.urgency * 0.4) + (newTask.impact * 0.4) + ((11 - newTask.effort) * 0.2);

    const taskData: Task = {
      id: crypto.randomUUID(),
      userId: 'user',
      title: newTask.title,
      description: newTask.description,
      deadline: new Date(newTask.deadline).toISOString(),
      status: 'pending',
      urgency: newTask.urgency,
      impact: newTask.impact,
      effort: newTask.effort,
      priorityScore: priority,
      subtasks: [],
      focusBlocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addTask(taskData);
    toast.success(`Task "${newTask.title}" created! Auto-orchestrating plans...`);
    setIsAddOpen(false);
    setNewTask({ title: '', description: '', deadline: '', urgency: 5, impact: 5, effort: 5 });
  };

  const handleUpdateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title || !editingTask.deadline) {
      toast.error("Title and deadline are required.");
      return;
    }

    const urgency = editingTask.urgency || 5;
    const impact = editingTask.impact || 5;
    const effort = editingTask.effort || 5;
    const priority = (urgency * 0.4) + (impact * 0.4) + ((11 - effort) * 0.2);

    updateTask(editingTask.id, {
      title: editingTask.title,
      description: editingTask.description,
      deadline: new Date(editingTask.deadline).toISOString(),
      status: editingTask.status,
      urgency,
      impact,
      effort,
      priorityScore: priority,
      updatedAt: new Date().toISOString(),
    });

    toast.success("Task updated successfully!");
    setIsEditOpen(false);
    setEditingTask(null);
  };

  const handleDecompose = async (task: Task) => {
    toast.loading("Decomposing task with AI...", { id: 'decompose' });
    try {
      const res = await fetch('/api/agents/decompose', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(geminiApiKey ? { 'x-gemini-api-key': geminiApiKey } : {})
        },
        body: JSON.stringify({ title: task.title, description: task.description, deadline: task.deadline })
      });
      if (!res.ok) throw new Error("AI Agent was unable to break down this task.");
      const data = await res.json();
      
      updateTask(task.id, {
        subtasks: data.subtasks || [],
        urgency: data.urgency,
        impact: data.impact,
        effort: data.effort,
        priorityScore: (data.urgency * 0.4) + (data.impact * 0.3) + (1 / Math.max(data.effort, 1) * 0.1)
      });
      toast.success("Decomposed task into steps!", { id: 'decompose' });
    } catch (e: any) {
      toast.error(e.message || "Failed to decompose task.", { id: 'decompose' });
    }
  };

  const getPriorityColor = (score: number = 0) => {
    if (score >= 8) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (score >= 5) return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  };

  return (
    <div className="mx-auto max-w-5xl p-6 pb-24 space-y-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/20 via-transparent to-transparent min-h-screen">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors mb-2 font-mono"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Plan
          </button>
          <h1 className="text-3xl font-light text-white tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
            My Task Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">Full administration, creation, and priority tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Add Task Button Triggering Dialog */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-5 cursor-pointer">
              <Plus className="h-4 w-4 mr-2" /> Add New Task
            </DialogTrigger>
            <DialogContent className="bg-[#111113] border border-slate-800 text-slate-100 sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-light" style={{ fontFamily: "'Georgia', serif" }}>Create Task Instance</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Title</Label>
                  <Input 
                    id="title" 
                    required 
                    value={newTask.title} 
                    onChange={e => setNewTask({...newTask, title: e.target.value})} 
                    className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-700 focus-visible:ring-emerald-500" 
                    placeholder="e.g. Design app dashboard" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="desc" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Description</Label>
                  <Textarea 
                    id="desc" 
                    value={newTask.description} 
                    onChange={e => setNewTask({...newTask, description: e.target.value})} 
                    className="bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-700 focus-visible:ring-emerald-500 min-h-[80px]" 
                    placeholder="Provide notes, dependencies or context..." 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deadline" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Deadline Date & Time</Label>
                  <Input 
                    id="deadline" 
                    type="datetime-local" 
                    required 
                    value={newTask.deadline} 
                    onChange={e => setNewTask({...newTask, deadline: e.target.value})} 
                    className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500 [color-scheme:dark]" 
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Urgency ({newTask.urgency})</Label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={newTask.urgency} 
                      onChange={e => setNewTask({...newTask, urgency: parseInt(e.target.value)})} 
                      className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Impact ({newTask.impact})</Label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={newTask.impact} 
                      onChange={e => setNewTask({...newTask, impact: parseInt(e.target.value)})} 
                      className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Effort ({newTask.effort})</Label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={newTask.effort} 
                      onChange={e => setNewTask({...newTask, effort: parseInt(e.target.value)})} 
                      className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                  <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="hover:bg-slate-800 text-slate-400">Cancel</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Create Task</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Filters and Search Tools */}
      <Card className="bg-[#111113]/80 border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search tasks..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus-visible:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <button 
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${statusFilter === 'all' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              All
            </button>
            <button 
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${statusFilter === 'pending' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              Pending
            </button>
            <button 
              onClick={() => setStatusFilter("in-progress")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${statusFilter === 'in-progress' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              In Progress
            </button>
            <button 
              onClick={() => setStatusFilter("completed")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${statusFilter === 'completed' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              Completed
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto md:ml-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="deadline">Closest Deadline</option>
              <option value="priority">Priority Score</option>
              <option value="createdAt">Date Created</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Task List Rendering */}
      <div className="grid gap-4">
        <AnimatePresence>
          {processedTasks.map((task) => {
            const isPrimary = primaryFocusTaskId === task.id;
            const completedSub = task.subtasks?.filter(s => s.completed).length || 0;
            const totalSub = task.subtasks?.length || 0;
            const progress = totalSub > 0 ? (completedSub / totalSub) * 100 : 0;
            const deadline = new Date(task.deadline);

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                layout
              >
                <Card className={`bg-[#111113] border rounded-2xl p-5 flex flex-col gap-4 transition-all hover:bg-[#151518] ${
                  isPrimary ? 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-slate-800'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-medium text-lg text-slate-100">{task.title}</h3>
                        
                        {task.priorityScore !== undefined && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className={getPriorityColor(task.priorityScore)}>
                              Score {(task.priorityScore).toFixed(1)}
                            </Badge>
                            {task.urgency !== undefined && (
                              <span className="text-[10px] bg-slate-900 border border-slate-800/80 text-slate-400 rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5" title="Urgency (1-10)">
                                ⚡ Urg: {task.urgency}
                              </span>
                            )}
                            {task.impact !== undefined && (
                              <span className="text-[10px] bg-slate-900 border border-slate-800/80 text-slate-400 rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5" title="Impact (1-10)">
                                🎯 Imp: {task.impact}
                              </span>
                            )}
                            {task.effort !== undefined && (
                              <span className="text-[10px] bg-slate-900 border border-slate-800/80 text-slate-400 rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5" title="Effort (1-10)">
                                🏋️ Eff: {task.effort}
                              </span>
                            )}
                          </div>
                        )}

                        <Badge variant="outline" className={`capitalize ${
                          task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          task.status === 'in-progress' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700/50'
                        }`}>
                          {task.status}
                        </Badge>

                        {isPrimary && (
                          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1 font-mono text-[10px]">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            Primary Focus
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-slate-400 line-clamp-2">{task.description || "No description provided."}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          Deadline: {!isNaN(deadline.getTime()) ? format(deadline, "MMM d, h:mm a") : "N/A"}
                        </span>
                        {!isNaN(deadline.getTime()) && (
                          <span className={isPast(deadline) ? 'text-[#DC2626] font-semibold' : ''}>
                            ({formatDistanceToNow(deadline, { addSuffix: true })})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-start">
                      {/* Edit Button */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="rounded-full text-slate-500 hover:text-emerald-400"
                        onClick={() => {
                          setEditingTask({
                            ...task,
                            deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : ''
                          });
                          setIsEditOpen(true);
                        }}
                        title="Edit Task Settings"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      {/* Complete / Toggle Status Button */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className={`rounded-full ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-500 hover:text-emerald-400'}`}
                        onClick={() => {
                          const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
                          updateTask(task.id, { status: nextStatus });
                          toast.success(`Marked "${task.title}" as ${nextStatus}!`);
                        }}
                        title={task.status === 'completed' ? "Mark Pending" : "Mark Completed"}
                      >
                        <Check className="h-4 w-4" />
                      </Button>

                      {/* Delete Button */}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="rounded-full text-slate-500 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => {
                          deleteTask(task.id);
                          toast.success("Task deleted permanently.");
                        }}
                        title="Delete Task"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Subtask Section */}
                  {totalSub > 0 && (
                    <div className="space-y-2 border-t border-slate-800/60 pt-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                        <span>Planning Progress ({completedSub}/{totalSub} steps)</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1" />
                      
                      <div className="grid gap-1.5 pt-1.5">
                        {task.subtasks?.map((sub, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-xs group">
                            <button 
                              className="text-slate-500 hover:text-emerald-500 transition-colors"
                              onClick={() => {
                                const newSubs = [...(task.subtasks || [])];
                                newSubs[i].completed = !newSubs[i].completed;
                                updateTask(task.id, { subtasks: newSubs });
                              }}
                            >
                              {sub.completed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Circle className="h-3.5 w-3.5" />}
                            </button>
                            <span className={`flex-1 ${sub.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>
                              {sub.title}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">{sub.estimatedMinutes}m</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {processedTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-[#111113]/40 border border-dashed border-slate-800 rounded-2xl">
            <div className="h-12 w-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-slate-300 font-medium">No tasks match criteria</p>
              <p className="text-slate-500 text-xs mt-1">Try adjusting the status filter or create a new task.</p>
            </div>
          </div>
        )}
      </div>

      {/* Editing Dialog Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-[#111113] border border-slate-800 text-slate-100 sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-light" style={{ fontFamily: "'Georgia', serif" }}>Edit Task Properties</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <form onSubmit={handleUpdateTaskSubmit} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-title" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Title</Label>
                <Input 
                  id="edit-title" 
                  required 
                  value={editingTask.title} 
                  onChange={e => setEditingTask({...editingTask, title: e.target.value})} 
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Description</Label>
                <Textarea 
                  id="edit-desc" 
                  value={editingTask.description} 
                  onChange={e => setEditingTask({...editingTask, description: e.target.value})} 
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500 min-h-[80px]" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-deadline" className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Deadline Date & Time</Label>
                <Input 
                  id="edit-deadline" 
                  type="datetime-local" 
                  required 
                  value={editingTask.deadline} 
                  onChange={e => setEditingTask({...editingTask, deadline: e.target.value})} 
                  className="bg-slate-900 border-slate-800 text-slate-100 focus-visible:ring-emerald-500 [color-scheme:dark]" 
                />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Status</Label>
                <select 
                  value={editingTask.status} 
                  onChange={e => setEditingTask({...editingTask, status: e.target.value as any})}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Urgency ({editingTask.urgency || 5})</Label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={editingTask.urgency || 5} 
                    onChange={e => setEditingTask({...editingTask, urgency: parseInt(e.target.value)})} 
                    className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Impact ({editingTask.impact || 5})</Label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={editingTask.impact || 5} 
                    onChange={e => setEditingTask({...editingTask, impact: parseInt(e.target.value)})} 
                    className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase tracking-widest text-slate-500 font-mono">Effort ({editingTask.effort || 5})</Label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={editingTask.effort || 5} 
                    onChange={e => setEditingTask({...editingTask, effort: parseInt(e.target.value)})} 
                    className="w-full accent-emerald-500 bg-slate-800 h-1 rounded" 
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/80">
                <Button type="button" variant="ghost" onClick={() => setIsEditOpen(false)} className="hover:bg-slate-800 text-slate-400">Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <VoiceOrb />
    </div>
  );
}
