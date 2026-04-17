import { Toaster } from "@/components/ui/toaster";
import ScrollToTop from "@/components/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import AuthGuard from "@/components/AuthGuard";
import About from "./pages/About";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard"; 
import TuneInDashboard from "./pages/TuneInDashboard.tsx";

// <-- Added AccountSettings Import -->
import AccountSettings from "./pages/AccountSettings"; 

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route
            path="/home"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />
          <Route
            path="/c/:slug"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />
          <Route
              path="/tune-in"
              element={
                <AuthGuard>
                  <TuneInDashboard />
                </AuthGuard>
              }
            />
          <Route
            path="/user/:username"
            element={
              <AuthGuard>
                <Profile />
              </AuthGuard>
            }
          />

          {/* <-- Added Leaderboard Route --> */}
          <Route
            path="/leaderboard"
            element={
              <AuthGuard>
                <Leaderboard />
              </AuthGuard>
            }
          />

          {/* <-- Added Account Settings Route --> */}
          <Route
            path="/settings"
            element={
              <AuthGuard>
                <AccountSettings />
              </AuthGuard>
            }
          />

          <Route
            path="/c/:slug/:postId"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />

          <Route
            path="/cinema"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />

          <Route
            path="/games"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />
          <Route
            path="/messages/:messageUsername?"
            element={
              <AuthGuard>
                <Home />
              </AuthGuard>
            }
          />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;