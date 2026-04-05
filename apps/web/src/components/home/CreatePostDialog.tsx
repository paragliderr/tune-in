import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createPostViaApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ImagePlus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubSlug: string | null;
  onCreated: () => void;
}

export default function CreatePostDialog({
  open,
  onOpenChange,
  clubSlug,
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  /* ⭐ prevent body scroll jump */
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [open]);

  const resetDraft = () => {
    setTitle("");
    setContent("");
    setFile(null);
  };

  const handleCreate = async () => {
    if (!clubSlug) return;

    if (!title.trim()) {
      toast.error("Title required");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: club } = await supabase
        .from("clubs")
        .select("id, name")
        .eq("slug", clubSlug)
        .single();

      let image_url: string | null = null;

      if (file && user) {
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;

        const { error } = await supabase.storage
          .from("posts")
          .upload(path, file);

        if (error) throw error;

        const { data } = supabase.storage.from("posts").getPublicUrl(path);
        image_url = data.publicUrl;
      }

      if (!user?.id || !club?.id) {
        throw new Error("Missing user or club");
      }

      await createPostViaApi({
        title,
        content,
        club_id: club.id,
        user_id: user.id,
        image_url,
      });

      toast.success("Post created 🚀");

      resetDraft();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error("Failed to create post");
      console.error(e);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
        bg-card/95 backdrop-blur-xl border-border
        max-w-xl w-full
        h-[85vh]
        rounded-2xl
        flex flex-col
        overflow-hidden
      "
      >
        {/* HEADER */}
        <DialogHeader className="p-6 pb-3 border-b border-border">
          <DialogTitle className="text-xl font-semibold">
            Create Post
          </DialogTitle>

          <p className="text-sm text-muted-foreground">
            Posting in{" "}
            <span className="text-primary font-medium">
              {clubSlug ?? "club"}
            </span>
          </p>
        </DialogHeader>

        {/* ⭐ SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
          {/* TITLE */}
          <input
            className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
            placeholder="Post title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* CONTENT */}
          <textarea
            className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
            placeholder="Write something amazing..."
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          {/* IMAGE PICK */}
          <motion.label
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 cursor-pointer text-sm text-muted-foreground border border-border rounded-xl px-4 py-3 bg-background hover:border-primary/50 transition"
          >
            <ImagePlus size={18} />
            {file ? file.name : "Add Image"}

            <input
              type="file"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </motion.label>

          {/* IMAGE PREVIEW */}
          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                <img
                  src={URL.createObjectURL(file)}
                  className="rounded-xl max-h-72 w-full object-cover"
                />

                {/* REMOVE IMAGE */}
                <button
                  onClick={() => setFile(null)}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-border flex gap-3">
          {/* DISCARD */}
          <button
            onClick={() => {
              resetDraft();
              onOpenChange(false);
            }}
            className="flex-1 border border-border rounded-xl py-3 flex items-center justify-center gap-2 hover:bg-muted/40 transition"
          >
            <Trash2 size={16} />
            Discard
          </button>

          {/* CREATE */}
          <button
            disabled={loading}
            onClick={handleCreate}
            className="flex-[2] bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-medium hover:scale-[1.02] active:scale-95 transition"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Create Post
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
