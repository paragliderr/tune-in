import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Upload, User, Cpu, Music, Gamepad2, Film } from "lucide-react";
import { toast } from "sonner";

const HOBBIES = [
  { id: "tech", name: "Tech", icon: Cpu },
  { id: "music", name: "Music", icon: Music },
  { id: "gaming", name: "Gaming", icon: Gamepad2 },
  { id: "movies", name: "Movies & Cinema", icon: Film },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);

  const handleUsernameChange = (value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
    if (clean.length > 0 && clean.length < 3) {
      setUsernameError("Username must be at least 3 characters");
    } else if (clean.length > 20) {
      setUsernameError("Username must be 20 characters or less");
    } else {
      setUsernameError("");
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const toggleHobby = (id: string) => {
    setSelectedHobbies((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    );
  };

  const handleFinish = () => {
    toast.success("Welcome to TUNE-IN!");
    navigate("/home", { replace: true });
  };

  const canProceed = () => {
    if (step === 0) return username.length >= 3 && !usernameError;
    if (step === 3) return selectedHobbies.length >= 1;
    return true;
  };

  const stepContent = [
    // Step 0: Username
    <motion.div
      key="username"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-foreground">
        Choose your username
      </h2>
      <p className="text-muted-foreground text-sm">
        This is how others will find you.
      </p>
      <div className="relative">
        <input
          type="text"
          value={username}
          onChange={(e) => handleUsernameChange(e.target.value)}
          placeholder="your_username"
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {username.length >= 3 && !usernameError && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
        )}
      </div>
      {usernameError && (
        <p className="text-sm text-destructive">{usernameError}</p>
      )}
    </motion.div>,

    // Step 1: Avatar
    <motion.div
      key="avatar"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-foreground">Profile picture</h2>
      <p className="text-muted-foreground text-sm">
        Optional — you can always add one later.
      </p>
      <div className="flex flex-col items-center gap-4 py-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="w-32 h-32 rounded-full border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors"
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
        </motion.div>
        <p className="text-xs text-muted-foreground">Click to upload</p>
      </div>
    </motion.div>,

    // Step 2: Bio
    <motion.div
      key="bio"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-foreground">About you</h2>
      <p className="text-muted-foreground text-sm">
        Optional — tell people what you're about.
      </p>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, 160))}
        placeholder="I love exploring new hobbies..."
        rows={4}
        className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
      />
      <p className="text-xs text-muted-foreground text-right">
        {bio.length}/160
      </p>
    </motion.div>,

    // Step 3: Hobbies
    <motion.div
      key="hobbies"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <h2 className="text-2xl font-bold text-foreground">
        Pick your interests
      </h2>
      <p className="text-muted-foreground text-sm">
        Select at least one to join clubs.
      </p>
      <div className="grid grid-cols-2 gap-4">
        {HOBBIES.map((hobby) => {
          const selected = selectedHobbies.includes(hobby.id);
          const Icon = hobby.icon;
          return (
            <motion.button
              key={hobby.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleHobby(hobby.id)}
              className={`relative p-6 rounded-2xl border backdrop-blur-md flex flex-col items-center gap-3 transition-all duration-300 ${
                selected
                  ? "border-primary bg-primary/15 shadow-[0_0_20px_hsl(270_70%_60%/0.2)]"
                  : "border-border bg-card/40 hover:border-primary/40"
              }`}
            >
              <Icon
                className={`w-8 h-8 ${selected ? "text-primary" : "text-muted-foreground"}`}
              />
              <span
                className={`text-sm font-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}
              >
                {hobby.name}
              </span>
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-foreground text-2xl font-bold tracking-[0.3em] uppercase">
            TUNE-IN
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Set up your profile
          </p>
        </div>

        {/* Progress bars */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8 min-h-[320px] flex flex-col">
          <div className="flex-1">
            <AnimatePresence mode="wait">{stepContent[step]}</AnimatePresence>
          </div>

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-full border border-border text-foreground font-medium text-sm hover:bg-muted/30 transition-all"
              >
                Back
              </button>
            )}
            {step === 1 && !avatarFile && (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 py-3 rounded-full border border-border text-muted-foreground font-medium text-sm hover:bg-muted/30 transition-all"
              >
                Skip
              </button>
            )}
            <button
              onClick={() => {
                if (step < 3) setStep(step + 1);
                else handleFinish();
              }}
              disabled={!canProceed()}
              className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_hsl(270_70%_60%/0.3)]"
            >
              {step < 3 ? "Continue" : "Finish"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;
