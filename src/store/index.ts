import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, UserPreferences } from '../types';

interface AppState {
  user: any | null;
  preferences: UserPreferences | null;
  tasks: Task[];
  insights: string[];
  isVoiceListening: boolean;
  geminiApiKey: string | null;
  primaryFocusTaskId: string | null;
  emergencyMode: boolean;
  setUser: (user: any | null) => void;
  setPreferences: (prefs: UserPreferences) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  setTasks: (tasks: Task[]) => void;
  setInsights: (insights: string[]) => void;
  setVoiceListening: (isListening: boolean) => void;
  setGeminiApiKey: (key: string | null) => void;
  setPrimaryFocusTaskId: (id: string | null) => void;
  setEmergencyMode: (active: boolean) => void;
  triggerAutoAIPlan: () => Promise<void>;
  autoEvaluatePrioritiesAndFocus: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      preferences: null,
      tasks: [],
      insights: [],
      isVoiceListening: false,
      geminiApiKey: null,
      primaryFocusTaskId: null,
      emergencyMode: false,
      setUser: (user) => set({ user }),
      setPreferences: (preferences) => set({ preferences }),
      addTask: (task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        get().autoEvaluatePrioritiesAndFocus();
        get().triggerAutoAIPlan();
      },
      updateTask: (taskId, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        }));
        get().autoEvaluatePrioritiesAndFocus();
        // Trigger auto AI planning if the updates include changing status/title/deadline
        const coreKeys = ['title', 'status', 'deadline', 'description'];
        const hasCoreChange = Object.keys(updates).some(key => coreKeys.includes(key));
        if (hasCoreChange) {
          get().triggerAutoAIPlan();
        }
      },
      deleteTask: (taskId) => {
        set((state) => ({ 
          tasks: state.tasks.filter((t) => t.id !== taskId),
          primaryFocusTaskId: state.primaryFocusTaskId === taskId ? null : state.primaryFocusTaskId
        }));
        get().autoEvaluatePrioritiesAndFocus();
        get().triggerAutoAIPlan();
      },
      setTasks: (tasks) => {
        set({ tasks });
        get().autoEvaluatePrioritiesAndFocus();
      },
      setInsights: (insights) => set({ insights }),
      setVoiceListening: (isVoiceListening) => set({ isVoiceListening }),
      setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
      setPrimaryFocusTaskId: (primaryFocusTaskId) => set({ primaryFocusTaskId }),
      setEmergencyMode: (emergencyMode) => set({ emergencyMode }),
      autoEvaluatePrioritiesAndFocus: () => {
        const currentTasks = get().tasks;
        const pending = currentTasks.filter(t => t.status !== 'completed');
        if (pending.length === 0) {
          set({ primaryFocusTaskId: null });
          return;
        }

        // 1. Identify the task with the smallest (earliest) deadline
        const sortedByDeadline = [...pending].sort((a, b) => {
          const ad = new Date(a.deadline).getTime();
          const bd = new Date(b.deadline).getTime();
          return ad - bd;
        });

        const smallestDeadlineTask = sortedByDeadline[0];

        // 2. Assign highest priority to the task with the smaller deadline.
        // Index 0 gets highest score (10.0), and others get lower scores dynamically.
        // This ensures every pending task has a priority score assigned and the smallest deadline task always wins.
        const updatedTasks = currentTasks.map(t => {
          if (t.status === 'completed') return t;
          const idx = sortedByDeadline.findIndex(st => st.id === t.id);
          if (idx !== -1) {
            const score = Math.max(1.0, 10.0 - idx * 1.5);
            return {
              ...t,
              priorityScore: score,
              urgency: Math.max(1, Math.round(10 - idx * 1.5)),
              impact: Math.max(1, Math.round(9 - idx * 1.0)),
              effort: t.effort || 3,
            };
          }
          return t;
        });

        set({
          tasks: updatedTasks,
          primaryFocusTaskId: smallestDeadlineTask.id
        });
      },
      triggerAutoAIPlan: async () => {
        const currentTasks = get().tasks;
        const geminiApiKey = get().geminiApiKey;
        const pending = currentTasks.filter(t => t.status !== 'completed');
        if (pending.length === 0) return;

        try {
          const res = await fetch('/api/agents/reprioritize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(geminiApiKey ? { 'x-gemini-api-key': geminiApiKey } : {})
            },
            body: JSON.stringify({ tasks: currentTasks })
          });
          if (!res.ok) {
            console.warn("Auto AI Prioritization error status:", res.status);
            return;
          }
          const data = await res.json();
          if (data.tasks && Array.isArray(data.tasks)) {
            const updated = get().tasks.map(t => {
              const aiUpdate = data.tasks.find((at: any) => at.id === t.id);
              if (aiUpdate) {
                return {
                  ...t,
                  priorityScore: aiUpdate.priorityScore,
                  urgency: aiUpdate.urgency,
                  impact: aiUpdate.impact,
                  effort: aiUpdate.effort,
                  subtasks: t.subtasks && t.subtasks.length > 0 ? t.subtasks : aiUpdate.subtasks || t.subtasks
                };
              }
              return t;
            });
            // Perform silent state update to avoid loops
            set({ tasks: updated });
            
            // Automatically select the highest priority pending task as primary focus
            const updatedPending = updated.filter(t => t.status !== 'completed');
            if (updatedPending.length > 0) {
              updatedPending.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
              set({ primaryFocusTaskId: updatedPending[0].id });
            }
            
            if (data.globalPlanInsight) {
              const currentInsights = get().insights || [];
              const alreadyExists = currentInsights.includes(data.globalPlanInsight);
              if (!alreadyExists) {
                set({ insights: [data.globalPlanInsight, ...currentInsights.slice(0, 4)] });
              }
            }
          }
        } catch (err) {
          console.warn("Auto AI Prioritization fetch failed:", err);
        }
      }
    }),
    {
      name: 'nexus-storage',
    }
  )
);
