"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/useUserStore";
import { storage } from "@/lib/firebase/client";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import ExtractionPreviewCard from "@/components/commitments/ExtractionPreviewCard";
import {
  Mic,
  MicOff,
  Upload,
  Mail,
  Loader2,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddCommitmentPage() {
  const { user } = useUserStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"text" | "file" | "gmail">("text");
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "text" || tab === "file" || tab === "gmail") {
        setActiveTab(tab);
      }
    }
  }, []);

  // Tab 1: Text / Voice State
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Tab 2: Upload File State
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Tab 3: Gmail Scan State
  const [gmailSuggestions, setGmailSuggestions] = useState<any[]>([]);

  // ----------------------------------------------------
  // VOICE RECORDING (Web Speech API)
  // ----------------------------------------------------
  const startRecording = () => {
    setError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN"; // Set to Indian English (recognizes Hinglish/Hindi pronunciations)
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInputText((prev) => (prev ? prev + " " + finalTranscript : finalTranscript));
      }
    };

    recognition.onerror = (err: any) => {
      console.error(err);
      setError("Voice recording failed: " + err.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  // ----------------------------------------------------
  // SUBMIT TEXT / VOICE EXTRACTION
  // ----------------------------------------------------
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const res = await fetch("/api/ai/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, userId: user?.uid }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to extract text");
      }

      const data = await res.json();
      setExtractedData(data);
    } catch (err: any) {
      setError(err.message || "Failed to parse text. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // UPLOAD FILE & EXTRACTION
  // ----------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user?.uid) return;

    setLoading(true);
    setError(null);
    setExtractedData(null);
    setUploadProgress(0);

    try {
      // 1. Upload to Firebase Storage
      const timestamp = Date.now();
      const storageRef = ref(storage, `uploads/${user.uid}/${timestamp}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (err) => {
            reject(err);
          },
          async () => {
            resolve();
          }
        );
      });

      const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);

      // 2. Call Extract API
      const res = await fetch("/api/ai/extract-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl,
          mimeType: file.type,
          userId: user.uid,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to extract file");
      }

      const data = await res.json();
      // file API returns an array (since a document can yield multiple commitments)
      // For now, let's take the first one or prompt a view. If it's an array, let's select the first
      const singleCommitmentDraft = Array.isArray(data) ? data[0] : data;
      if (!singleCommitmentDraft) {
        throw new Error("No commitments could be extracted from this document.");
      }
      setExtractedData(singleCommitmentDraft);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process document. Make sure it contains text.");
    } finally {
      setLoading(false);
      setFile(null);
      setUploadProgress(0);
    }
  };

  // ----------------------------------------------------
  // GMAIL SCAN
  // ----------------------------------------------------
  const handleGmailScan = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    setGmailSuggestions([]);

    try {
      const res = await fetch(`/api/gmail/scan/${user.uid}`);
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 403) {
          throw new Error("PERMISSION_DENIED");
        }
        throw new Error(err.message || "Scan failed");
      }
      const data = await res.json();
      setGmailSuggestions(data);
    } catch (err: any) {
      if (err.message === "PERMISSION_DENIED") {
        setError("GMAIL_PERMISSION_DENIED");
      } else {
        setError(err.message || "Gmail inbox scan failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGmail = async (suggestionId: string) => {
    try {
      const res = await fetch("/api/gmail/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, userId: user?.uid }),
      });
      if (res.ok) {
        setGmailSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      }
    } catch (err) {
      console.error("Failed to approve gmail suggestion:", err);
    }
  };

  const handleRejectGmail = async (suggestionId: string) => {
    try {
      const res = await fetch("/api/gmail/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, userId: user?.uid }),
      });
      if (res.ok) {
        setGmailSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      }
    } catch (err) {
      console.error("Failed to reject gmail suggestion:", err);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Add Commitment
        </h1>
        <p className="text-sm text-[#8B949E]">
          FinishLine can extract tasks from voice recordings, files, emails, or typed notes.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#30363D] w-full max-w-lg mx-auto">
        {(["text", "file", "gmail"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setExtractedData(null);
              setError(null);
            }}
            className={`flex-1 text-center py-3 text-sm font-semibold border-b-2 transition select-none cursor-pointer ${
              activeTab === tab
                ? "border-blue-500 text-blue-400 font-bold"
                : "border-transparent text-[#8B949E] hover:text-white"
            }`}
          >
            {tab === "text" && "Type / Speak"}
            {tab === "file" && "Upload Document"}
            {tab === "gmail" && "Scan Gmail"}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="w-full max-w-xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Tab 1: Type or Speak */}
            {activeTab === "text" && !extractedData && (
              <form onSubmit={handleTextSubmit} className="space-y-4">
                <div className="bg-[#161B22] border border-[#30363D] p-5 rounded-2xl relative shadow-sm">
                  <textarea
                    rows={4}
                    required
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Describe your commitment... (Hinglish ok: 'kal submission hai yaar')"
                    className="w-full bg-transparent border-0 text-white text-sm focus:ring-0 focus:outline-none resize-none pb-12"
                  />
                  {/* Microphone & speech indicator */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-3">
                    {isRecording && (
                      <span className="text-[10px] text-red-500 font-bold tracking-wider uppercase animate-pulse">
                        Recording...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`p-3 rounded-full flex items-center justify-center border transition transform duration-200 cursor-pointer ${
                        isRecording
                          ? "bg-red-500 border-red-400 text-white scale-110 shadow-lg"
                          : "bg-[#21262D] border-[#30363D] text-[#8B949E] hover:text-white"
                      }`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-white/60 text-white font-bold shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Extract Commitment</span>
                </button>
              </form>
            )}

            {/* Tab 2: Upload Document */}
            {activeTab === "file" && !extractedData && (
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-8 text-center flex flex-col items-center justify-center border-dashed border-2 relative hover:border-[#8b949e]/50 transition min-h-[220px]">
                  <input
                    type="file"
                    required
                    accept="application/pdf, image/*, .docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
                    <Upload className="w-6 h-6" />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-sm">{file.name}</p>
                      <p className="text-xs text-[#8B949E] mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-white font-bold text-sm">Drag & drop your document</p>
                      <p className="text-xs text-[#8B949E] mt-1">
                        Accepts PDF, JPG, PNG, and DOCX (Max 10MB)
                      </p>
                    </div>
                  )}
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#8B949E]">
                      <span>Uploading document...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-[#21262D] rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-white/60 text-white font-bold shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Reading document..." : "Analyze & Extract"}</span>
                </button>
              </form>
            )}

            {/* Tab 3: Gmail Scan */}
            {activeTab === "gmail" && !extractedData && (
              <div className="space-y-6 text-center">
                {gmailSuggestions.length === 0 && !loading && (
                  <div className="bg-[#161B22] border border-[#30363D] p-8 rounded-2xl flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">Check your inbox for tasks</h4>
                      <p className="text-xs text-[#8B949E] mt-1 max-w-sm mx-auto">
                        Scan your unread emails from the past week to automatically suggest commitments.
                      </p>
                    </div>
                    <button
                      onClick={handleGmailScan}
                      className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md transition duration-200 cursor-pointer"
                    >
                      Scan Recent Emails
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-sm text-[#8B949E] font-medium">
                      Scanning your inbox and classifying emails...
                    </span>
                  </div>
                )}

                {/* Gmail Suggestion List */}
                <div className="space-y-4">
                  {gmailSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 text-left space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
                            Gmail Suggestion
                          </span>
                          <h4 className="text-base font-bold text-white mt-2 truncate">
                            {suggestion.title}
                          </h4>
                          <p className="text-xs text-[#8B949E] mt-1">
                            From: <span className="text-white">{suggestion.sender}</span>
                          </p>
                          <p className="text-xs text-[#8B949E]">
                            Subject: <span className="italic">{suggestion.subject}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold">
                            Confidence
                          </span>
                          <div className="text-xs font-bold text-green-400 mt-0.5">
                            {Math.round(suggestion.confidence * 100)}%
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#8B949E] border-t border-[#30363D]/50 pt-3">
                        {suggestion.deadline && (
                          <span>
                            Deadline:{" "}
                            <span className="text-white font-medium">
                              {new Date(suggestion.deadline).toLocaleString()}
                            </span>
                          </span>
                        )}
                        {suggestion.effort && (
                          <span>
                            Effort:{" "}
                            <span className="text-white font-medium">
                              {suggestion.effort} hours
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-1">
                        <button
                          onClick={() => handleRejectGmail(suggestion.id)}
                          className="py-1.5 px-4 rounded-lg bg-transparent border border-red-500/30 hover:border-red-500 text-red-500 hover:bg-red-500/10 text-xs font-semibold transition cursor-pointer"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveGmail(suggestion.id)}
                          className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Schedule</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Error States */}
        {error && (
          <div className="mt-6">
            {error === "GMAIL_PERMISSION_DENIED" ? (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-5 rounded-2xl text-center space-y-3">
                <AlertCircle className="w-8 h-8 mx-auto" />
                <div>
                  <h4 className="font-bold text-sm text-white">Gmail authorization required</h4>
                  <p className="text-xs text-[#8B949E] mt-1 max-w-xs mx-auto">
                    Calendar and Gmail API scope authorizations are required to fetch inbox suggestions.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/dashboard/profile")}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Open Profile / Settings
                </button>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton shimmer (when AI is loading extraction) */}
        {loading && !file && (
          <div className="space-y-4 mt-6">
            <div className="h-6 w-1/3 bg-[#161B22] rounded-lg animate-pulse" />
            <div className="h-32 bg-[#161B22] rounded-2xl animate-pulse" />
            <div className="h-10 bg-[#161B22] rounded-xl animate-pulse" />
          </div>
        )}

        {/* Extraction Preview Card */}
        {extractedData && (
          <div className="mt-8">
            <ExtractionPreviewCard
              initialData={extractedData}
              onSave={() => {
                setExtractedData(null);
                setInputText("");
                router.push("/dashboard");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
