import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Save, User as UserIcon } from "lucide-react";

export default function AccountSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  const [profileId, setProfileId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          navigate("/login");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error) throw error;

        setProfileId(data.id);
        setUsername(data.username || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || null);
      } catch (err: any) {
        toast.error("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileId) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${profileId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', profileId);

      if (updateError) throw updateError;

      setAvatarUrl(data.publicUrl);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Error uploading avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.trim(),
          bio: bio.trim(),
        })
        .eq('id', profileId);

      if (error) {
        if (error.code === '23505') { 
          throw new Error("This username is already taken.");
        }
        throw error;
      }

      toast.success("Profile updated successfully!");
      // Navigate back to their profile to see the changes
      navigate(`/user/${username.trim()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  const initials = username?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden pb-16 md:pb-0">
      {/* ── Top Header ── */}
      <header className="h-14 border-b border-border flex items-center px-5 gap-4 flex-shrink-0 bg-background/80 backdrop-blur-xl z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-semibold truncate">Account Settings</span>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-xl mx-auto px-4 py-8">
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-6 sm:p-8 shadow-sm"
          >
            <form onSubmit={handleSave} className="space-y-8">
              
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group cursor-pointer">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover ring-4 ring-background shadow-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium ring-4 ring-background shadow-xl">
                      <span className="text-2xl">{initials}</span>
                    </div>
                  )}
                  
                  <label className="absolute inset-0 bg-black/50 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                    {uploadingAvatar ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Click to upload a new avatar</p>
              </div>

              <div className="space-y-4">
                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    Username
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                      className="w-full bg-muted/30 border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Bio Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the world about yourself..."
                    className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none h-32"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || uploadingAvatar}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving Changes..." : "Save Changes"}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}