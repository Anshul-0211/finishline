"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Sparkles, FileUp, FileText, Loader2, X, XCircle, Check } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { PillButton } from "@/components/ui/pill-button";
import { ExtractionPreviewCard } from "@/components/extraction-preview-card";
import { DomainType } from "@/components/ui/domain-badge";
import { PriorityType } from "@/components/ui/priority-badge";

interface ExtractedItem {
  id: string;
  title: string;
  domain: DomainType;
  priority: PriorityType;
  deadline: string | null;
  effortEstimateHours: number;
  confidence: number;
  checked: boolean;
  requiresUserReview?: boolean;
}

export default function AddCommitmentPage() {
  const router = useRouter();
  const { user, userProfile } = useUserStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");

  // Text/Voice states
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ExtractedItem[]>([]);
  const [showReviewList, setShowReviewList] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event: any) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setInputText((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setFileError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file: File) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setFileError("Invalid file type. Only PDF, JPG, and PNG files are supported.");
      return;
    }

    setSelectedFile(file);
    startMockUpload(file);
  };

  const startMockUpload = (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setReviewItems([]);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          startMockAnalysis(file);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const startMockAnalysis = (file: File) => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setShowReviewList(true);
      
      // Inject mock extracted commitment items based on mock type
      const mockResult: ExtractedItem[] = [
        {
          id: `ext-${Date.now()}-1`,
          title: "Finish OS Memory Allocator Project Submission",
          domain: "academic",
          priority: "critical",
          deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
          effortEstimateHours: 6,
          confidence: 0.94,
          checked: true,
        },
        {
          id: `ext-${Date.now()}-2`,
          title: "Setup Amazon OA Mock sessions panel reviews",
          domain: "work",
          priority: "high",
          deadline: null,
          effortEstimateHours: 4,
          confidence: 0.62,
          checked: true,
          requiresUserReview: true,
        },
      ];
      setReviewItems(mockResult);
    }, 2500);
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setUploading(false);
    setAnalyzing(false);
    setUploadProgress(0);
    setReviewItems([]);
    setShowReviewList(false);
  };

  const handleToggleCheck = (id: string) => {
    setReviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleDismissItem = (id: string) => {
    setReviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddSelected = () => {
    const selectedCount = reviewItems.filter((item) => item.checked).length;
    alert(`Successfully added ${selectedCount} commitment(s) to dashboard!`);
    router.push("/dashboard");
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";
  const selectedItemsCount = reviewItems.filter((item) => item.checked).length;

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-1/2 mx-auto px-6 py-6 flex flex-col gap-6 font-sans relative min-h-[calc(100vh-140px)]">
        {/* Header Navigation */}
        <header className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Go back to Dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[26px] font-bold text-on-surface tracking-[-0.01em] leading-none">
            Add Commitment
          </h1>
        </header>

        {/* Tab Row Selector */}
        <div className="flex border-b border-outline-variant w-full">
          <button
            onClick={() => {
              setActiveTab("text");
              handleCancelUpload();
            }}
            className={`flex-1 py-3 text-[16px] font-semibold text-center transition-all duration-200 outline-none
              ${
                activeTab === "text"
                  ? "text-primary border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            Text / Voice
          </button>
          <button
            onClick={() => setActiveTab("file")}
            className={`flex-1 py-3 text-[16px] font-semibold text-center transition-all duration-200 outline-none
              ${
                activeTab === "file"
                  ? "text-primary border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
          >
            Upload File
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 flex flex-col">
          {activeTab === "text" ? (
            /* Tab 1: Text / Voice input */
            <div className="flex flex-col gap-6 w-full">
              <div className="flex flex-col gap-1.5">
                {isListening && (
                  <span className="text-[12px] font-bold text-error animate-pulse flex items-center gap-1.5 mb-0.5">
                    <span className="w-2 h-2 bg-error rounded-full" />
                    Listening...
                  </span>
                )}

                <div className="relative w-full">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="What do you need to finish? Try: 'OS Assignment due Friday, need 6 hours'"
                    className="w-full min-h-[140px] bg-surface-container-lowest border border-outline-variant rounded-lg p-4 pb-14 text-on-surface placeholder-text-outline text-[16px] resize-none focus:border-2 focus:border-primary focus:ring-2 focus:ring-primary/12 focus:outline-none transition duration-200"
                  />

                  {speechSupported && (
                    <motion.button
                      type="button"
                      onClick={toggleListening}
                      animate={isListening ? { scale: [1, 1.15, 1] } : {}}
                      transition={isListening ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : {}}
                      className={`absolute bottom-3.5 right-3.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 outline-none
                        ${
                          isListening
                            ? "bg-error text-on-error shadow-[0_0_0_8px_rgba(219,68,85,0.2)]"
                            : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
                        }`}
                      title={isListening ? "Stop listening" : "Start voice input"}
                      aria-label={isListening ? "Stop listening" : "Start voice input"}
                    >
                      <Mic className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </div>

              <PillButton
                variant="primary"
                disabled={!inputText.trim()}
                onClick={() => alert(`Starting AI commitment extraction for text: "${inputText}"`)}
                className="w-full h-[52px] text-[16px] font-semibold tracking-wide flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <span>Extract with AI</span>
              </PillButton>
            </div>
          ) : (
            /* Tab 2: File Upload drag drop */
            <div className="flex flex-col gap-6 w-full flex-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="application/pdf, image/jpeg, image/png"
                className="hidden"
              />

              {/* Drag Drop zone box */}
              {!selectedFile && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full h-[220px] mx-auto flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-[24px] cursor-pointer transition-all duration-200 select-none shadow-card
                    ${
                      dragActive
                        ? "border-primary bg-primary/4 scale-[1.01]"
                        : "border-outline-variant bg-surface-container-lowest hover:border-primary/50"
                    }`}
                >
                  <FileUp className="w-12 h-12 text-outline mb-4" />
                  <p className="text-[16px] font-bold text-on-surface font-sans text-center">
                    Drop your PDF or image here
                  </p>
                  <p className="text-primary text-[14px] font-semibold mt-1 hover:underline">
                    or tap to browse
                  </p>
                </div>
              )}

              {/* Error messages banner */}
              {fileError && (
                <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-xl text-xs font-semibold font-label w-full mx-auto mt-2">
                  <XCircle className="w-4 h-4 text-error flex-shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Progress and Analysis screens */}
              {selectedFile && (uploading || analyzing) && (
                <div
                  className={`w-full mx-auto p-6 bg-surface-container-lowest border border-outline-variant rounded-[24px] shadow-card flex flex-col gap-4 transition-all duration-200
                    ${analyzing ? "ring-2 ring-primary/12" : ""}`}
                >
                  {/* File label top bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-[14px] font-semibold text-on-surface truncate max-w-[200px]">
                        {selectedFile.name}
                      </span>
                      <span className="text-[11px] font-medium text-outline flex-shrink-0">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      onClick={handleCancelUpload}
                      className="text-outline hover:text-on-surface transition-colors p-1"
                      aria-label="Cancel upload"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {uploading ? (
                    /* Progress Bar fill */
                    <div className="space-y-2">
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-150 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[12px] font-semibold font-label">
                        <span className="text-on-surface-variant">Uploading document...</span>
                        <span className="text-primary">{uploadProgress}%</span>
                      </div>
                    </div>
                  ) : (
                    /* Analyzing spinning overlay */
                    <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <div className="space-y-0.5">
                        <p className="text-[15px] font-bold text-on-surface font-sans">
                          Gemini is reading your document...
                        </p>
                        <p className="text-[11px] font-semibold font-label text-on-surface-variant">
                          Extracting effort plans & schedule milestones
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Review Section List display */}
              {showReviewList && reviewItems.length > 0 && (
                <div className="space-y-4 pb-24 mt-2">
                  <header className="border-b border-outline-variant/30 pb-2">
                    <h3 className="text-[18px] font-bold text-on-surface font-sans leading-none">
                      Found {reviewItems.length} commitment(s)
                    </h3>
                    <p className="text-xs text-on-surface-variant font-label font-semibold mt-1">
                      extracted from {selectedFile?.name}
                    </p>
                  </header>

                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {reviewItems.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0, marginBottom: 0, overflow: "hidden" }}
                          transition={{ duration: 0.2 }}
                          className="relative"
                        >
                          <ExtractionPreviewCard
                            title={item.title}
                            domain={item.domain}
                            priority={item.priority}
                            deadline={item.deadline}
                            effortEstimateHours={item.effortEstimateHours}
                            confidence={item.confidence}
                            requiresUserReview={item.requiresUserReview}
                            onConfirm={() => handleToggleCheck(item.id)}
                            onEdit={() => alert(`Edit item: ${item.title}`)}
                            onClose={() => handleDismissItem(item.id)}
                          />

                          {/* Checkbox placement top-right */}
                          <div className="absolute top-5 right-[56px] z-20">
                            <button
                              onClick={() => handleToggleCheck(item.id)}
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-200 outline-none
                                ${
                                  item.checked
                                    ? "bg-primary border-primary text-on-primary"
                                    : "border-outline-variant bg-surface-container-lowest"
                                }`}
                              aria-label={`Select ${item.title}`}
                            >
                              {item.checked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Review Empty State list */}
              {showReviewList && reviewItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <FileText className="w-12 h-12 text-outline" />
                  <p className="text-[16px] font-bold text-on-surface-variant font-sans">
                    No commitments detected
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky add selected bottom bar */}
        {activeTab === "file" && reviewItems.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant p-4 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
            <div className="max-w-[720px] mx-auto">
              <PillButton
                variant="primary"
                onClick={handleAddSelected}
                disabled={selectedItemsCount === 0}
                className={`w-full h-12 text-sm font-semibold transition-colors duration-200
                  ${selectedItemsCount === 0 ? "bg-surface-dim text-on-surface/30 cursor-not-allowed" : ""}`}
              >
                Add Selected ({selectedItemsCount})
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </NavShell>
  );
}
