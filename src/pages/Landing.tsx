import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/firebase";
import { useAppStore } from "@/store";
import { useNavigate } from "react-router-dom";
import { Brain, Clock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Landing() {
  const { user, setUser } = useAppStore();
  const navigate = useNavigate();
  const [showMockLogin, setShowMockLogin] = useState(false);
  const [mockUser, setMockUser] = useState({ name: '', email: '' });

  const handleSignIn = async () => {
    try {
      // First try real Firebase sign in
      const user = await signIn();
      setUser({ uid: user.uid, displayName: user.displayName, email: user.email });
      navigate('/dashboard');
    } catch (error) {
      // Fallback to manual entry if Firebase is not configured or fails
      setShowMockLogin(true);
    }
  };

  const handleMockLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mockUser.name && mockUser.email) {
      setUser({ uid: 'mock-' + Date.now(), displayName: mockUser.name, email: mockUser.email });
      setShowMockLogin(false);
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-900/20 via-transparent to-transparent">
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Brain className="h-10 w-10" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-light text-white sm:text-5xl" style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
            NEXUS
          </h1>
          <p className="text-xl text-slate-400">
            AI Deadline Guardian
          </p>
          <p className="max-w-[500px] text-slate-400">
            Stop reacting to deadlines. Start owning them. NEXUS breaks your tasks down, carves out your calendar, and nudges you with precision.
          </p>
        </div>

        {user ? (
          <Button 
            size="lg" 
            className="bg-emerald-600 text-white hover:bg-emerald-500 h-12 px-8 text-base shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-full font-bold transition-colors"
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        ) : (
          <Button 
            size="lg" 
            className="bg-white text-black hover:bg-slate-200 h-12 px-8 text-base shadow-[0_0_20px_rgba(255,255,255,0.1)] rounded-full font-bold transition-colors"
            onClick={handleSignIn}
          >
            Sign in with Google
          </Button>
        )}

        <Dialog open={showMockLogin} onOpenChange={setShowMockLogin}>
          <DialogContent className="bg-[#111113] border border-slate-800 text-slate-100 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-light" style={{ fontFamily: "'Georgia', serif" }}>Simulated Google Login</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-400">Since Firebase is running in preview mode, please enter your details to continue.</p>
            <form onSubmit={handleMockLoginSubmit} className="space-y-4 pt-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="name" className="text-[10px] uppercase tracking-widest text-slate-500">Full Name</Label>
                <Input id="name" required value={mockUser.name} onChange={e => setMockUser({...mockUser, name: e.target.value})} className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500 text-slate-100" placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="email" className="text-[10px] uppercase tracking-widest text-slate-500">Email Address</Label>
                <Input id="email" type="email" required value={mockUser.email} onChange={e => setMockUser({...mockUser, email: e.target.value})} className="bg-slate-900 border-slate-800 focus-visible:ring-emerald-500 text-slate-100" placeholder="e.g. john@example.com" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowMockLogin(false)} className="hover:bg-slate-800 text-slate-400">Cancel</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">Continue</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-3 gap-6 pt-12 text-sm text-slate-500">
          <div className="flex flex-col items-center gap-2">
            <Clock className="h-5 w-5" />
            <span>Autonomous Scheduling</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Brain className="h-5 w-5" />
            <span>Task Decomposition</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <span>Context-Aware Nudges</span>
          </div>
        </div>
      </div>
    </div>
  );
}
