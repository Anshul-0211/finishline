"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mic, Sparkles, FileUp, FileText, Loader2, X, XCircle, Check } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth } from "@/lib/firebase/client";
import { storage } from "@/lib/firebase";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { PillButton } from "@/components/ui/pill-button";
import { ExtractionPreviewCard } from "@/components/extraction-preview-card";
import { ActionPlanPreview } from "@/components/action-plan-preview";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { DomainType } from "@/components/ui/domain-badge";
import { PriorityType } from "@/components/ui/priority-badge";
import { createCommitment, updateCommitment } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";

interface CommitmentDraft {
  title: string;
  description: string;
  domain: DomainType;
  deadline: string | null;
  isLongTermGoal: boolean;
  effortEstimateHours: number;
  priority: PriorityType;
  confidence: number;
  reasoning: string;
}

interface CommitmentDraftFull {
  title: string;
  description: string;
  domain: DomainType;
  deadline: string | null;
  isLongTermGoal: boolean;
  effortEstimateHours: number;
  priority: PriorityType;
  confidence: number;
  reasoning: string;
  difficulty: "easy" | "medium" | "hard" | "expert";
  estimatedCognitiveLoad: "low" | "medium" | "high";
  commitmentType: "assignment" | "exam" | "project" | "meeting" | "event" | "interview" | "other";
  practicalVsTheoretical: "practical" | "theoretical" | "mixed" | null;
  questionCount: number | null;
  recommendedSessions: number;
  prerequisiteKnowledge: string[];
  stakeholderImportance: "low" | "medium" | "high" | "critical";
  requiredResponse: boolean;
  extractedEntities: {
    people: string[];
    locations: string[];
    tools: string[];
  };
}

interface ActionPlanResponse {
  steps: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    suggestedTimeSlot?: string;
    cognitiveIntensity?: "low" | "medium" | "high";
    notes?: string;
  }>;
  totalMinutes: number;
  suggestedSessionLength?: number;
  recommendedDaysSpread?: number;
  aiMeta?: {
    confidence: number;
    confidenceLabel: string;
    reasoning: string;
  };
  requiresUserReview: boolean;
  reviewReason: string | null;
}

export default function AddCommitmentPage() {
  const router = useRouter();
  const { user, setUser, userProfile } = useUserStore();

  // Tab State
  const [activeTab, setActiveTab] = useState<"text" | "file">("text");

  // Text/Voice states
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // AI extraction & Action Plan states
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionDataList, setExtractionDataList] = useState<Array<CommitmentDraft & { id: string }>>([]);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planData, setPlanData] = useState<ActionPlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [savedCommitmentId, setSavedCommitmentId] = useState<string | null>(null);

  // Sequential confirmations & manual edits
  const [confirmingIndex, setConfirmingIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDomain, setEditedDomain] = useState<DomainType>("work");
  const [editedPriority, setEditedPriority] = useState<PriorityType>("medium");
  const [editedDeadline, setEditedDeadline] = useState("");
  const [editedEffort, setEditedEffort] = useState(1);

  // File Upload states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [fileExtractionLoading, setFileExtractionLoading] = useState(false);
  const [fileExtractions, setFileExtractions] = useState<CommitmentDraftFull[]>([]);
  const [selectedExtractedIds, setSelectedExtractedIds] = useState<Set<number>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        router.push("/");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribeAuth();
  }, [router, setUser]);

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
        rec.lang = "en-US";

        rec.onresult = (event: any) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInputText(transcript);
          }
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
          isListeningRef.current = false;
          if (event.error === "network") {
            setVoiceError("Google speech service network error. Please check your connection or type manually.");
          } else if (event.error === "not-allowed") {
            setVoiceError("Microphone permission denied. Enable microphone access in browser settings.");
          } else {
            setVoiceError(`Voice input error: ${event.error}.`);
          }
        };

        rec.onend = () => {
          setIsListening(false);
          isListeningRef.current = false;
        };

        recognitionRef.current = rec;
      }
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  // Voice Extraction Trigger
  const prevIsListening = useRef(isListening);
  useEffect(() => {
    if (prevIsListening.current && !isListening && inputText.trim()) {
      handleVoiceExtraction(inputText);
    }
    prevIsListening.current = isListening;
  }, [isListening, inputText]);

  const toggleListening = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setVoiceError(null);
    if (isListening) {
      isListeningRef.current = false;
      rec.stop();
      setIsListening(false);
    } else {
      try {
        isListeningRef.current = true;
        setIsListening(true);
        rec.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        isListeningRef.current = false;
        setIsListening(false);
      }
    }
  };

  // Text Extraction Handler
  const handleTextExtraction = async () => {
    console.log("[Frontend] handleTextExtraction triggered. Input text:", inputText, "User state:", user);
    if (!user) {
      console.warn("[Frontend] handleTextExtraction aborted: user object is null or undefined.");
      setExtractionError("User authentication is loading. Please wait a moment and try again.");
      return;
    }
    setExtractionLoading(true);
    setExtractionDataList([]);
    setExtractionError(null);
    setPlanData(null);
    setSavedCommitmentId(null);
    setEditingIndex(null);
    setConfirmingIndex(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Fetching /api/ai/extract-text...");
      const res = await fetch("/api/ai/extract-text", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, input: inputText }),
      });
      console.log("[Frontend] /api/ai/extract-text response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] /api/ai/extract-text returned data:", data);
      const list = Array.isArray(data) ? data : [data];
      const enriched = list.map((item, idx) => ({
        ...item,
        id: `ext-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`
      }));
      setExtractionDataList(enriched);
    } catch (e: any) {
      console.error("[Frontend] handleTextExtraction failed:", e);
      setExtractionError(e.message ?? "Extraction failed. Try again.");
    } finally {
      setExtractionLoading(false);
    }
  };

  // Voice Extraction Handler
  const handleVoiceExtraction = async (transcript: string) => {
    console.log("[Frontend] handleVoiceExtraction triggered. Transcript:", transcript, "User state:", user);
    if (!user) {
      console.warn("[Frontend] handleVoiceExtraction aborted: user object is null or undefined.");
      setExtractionError("User authentication is loading. Please wait a moment and try again.");
      return;
    }
    setExtractionLoading(true);
    setExtractionDataList([]);
    setExtractionError(null);
    setPlanData(null);
    setSavedCommitmentId(null);
    setEditingIndex(null);
    setConfirmingIndex(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Fetching /api/ai/extract-voice...");
      const res = await fetch("/api/ai/extract-voice", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, transcript }),
      });
      console.log("[Frontend] /api/ai/extract-voice response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] /api/ai/extract-voice returned data:", data);
      const list = Array.isArray(data) ? data : [data];
      const enriched = list.map((item, idx) => ({
        ...item,
        id: `ext-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 9)}`
      }));
      setExtractionDataList(enriched);
    } catch (e: any) {
      console.error("[Frontend] handleVoiceExtraction failed:", e);
      setExtractionError(e.message ?? "Voice extraction failed. Try again.");
    } finally {
      setExtractionLoading(false);
    }
  };

  const startEditingCard = (index: number) => {
    const item = extractionDataList[index];
    if (!item) return;
    setEditingIndex(index);
    setEditedTitle(item.title || "");
    setEditedDomain(item.domain || "work");
    setEditedPriority(item.priority || "medium");
    setEditedDeadline(item.deadline ? item.deadline.split("T")[0] : "");
    setEditedEffort(item.effortEstimateHours ?? 1);
  };

  // Confirm Extraction & Generate Action Plan Handler
  const handleConfirmExtraction = async (index: number) => {
    const item = extractionDataList[index];
    console.log("[Frontend] handleConfirmExtraction triggered. Index:", index, "Item:", item, "User state:", user);
    if (!item || !user) {
      console.warn("[Frontend] handleConfirmExtraction aborted: item or user missing.");
      return;
    }
    setConfirmingIndex(index);
    setExtractionLoading(true);
    setPlanError(null);
    try {
      const isEdited = editingIndex === index;
      const title = isEdited ? editedTitle : item.title;
      const domain = isEdited ? editedDomain : item.domain;
      const priority = isEdited ? editedPriority : item.priority;
      const deadline = isEdited 
        ? (editedDeadline ? new Date(editedDeadline).toISOString() : (item.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()))
        : (item.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString());
      const effort = isEdited ? editedEffort : item.effortEstimateHours;

      console.log("[Frontend] Creating commitment in Firestore with details:", { title, domain, priority, deadline, effort });
      const commitmentId = await createCommitment(user.uid, {
        title,
        description: item.description || "",
        domain,
        deadline,
        isLongTermGoal: item.isLongTermGoal || false,
        effortEstimateHours: effort,
        priority,
        status: "active",
        completionPercentage: 0,
        createdAt: serverTimestamp() as any,
      });
      console.log("[Frontend] Firestore commitment successfully created with ID:", commitmentId);
      setSavedCommitmentId(commitmentId);
      setExtractionLoading(false);

      // Generate action plan
      const idToken = await user.getIdToken();
      console.log("[Frontend] Fetching /api/ai/generate-action-plan...");
      setPlanLoading(true);
      const planRes = await fetch("/api/ai/generate-action-plan", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, commitmentId }),
      });
      console.log("[Frontend] /api/ai/generate-action-plan response status:", planRes.status);
      if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`);
      const planDataJson = await planRes.json();
      console.log("[Frontend] Action plan response returned data:", planDataJson);
      setPlanData(planDataJson);
    } catch (e: any) {
      console.error("[Frontend] handleConfirmExtraction failed:", e);
      setPlanError(e.message ?? "Plan generation failed. Try again.");
    } finally {
      setExtractionLoading(false);
      setPlanLoading(false);
    }
  };

  // Accept Action Plan & Save to Firestore
  const handleAcceptPlan = async () => {
    if (!savedCommitmentId || !planData || !user) return;
    setPlanLoading(true);
    try {
      // 1. Save action plan to Firestore
      await updateCommitment(savedCommitmentId, {
        actionPlan: {
          steps: planData.steps.map((s) => ({ ...s, completed: false })),
          totalMinutes: planData.totalMinutes,
          generatedAt: serverTimestamp() as any,
        },
        status: "active",
      });

      // 2. Map action plan steps to scheduled blocks for Google Calendar
      const blocks = planData.steps
        .filter((s) => s.suggestedTimeSlot)
        .map((s) => {
          const start = new Date(s.suggestedTimeSlot!);
          const end = new Date(start.getTime() + s.estimatedMinutes * 60000);
          return {
            start: start.toISOString(),
            end: end.toISOString()
          };
        });

      const idToken = await user.getIdToken();

      if (blocks.length > 0) {
        console.log(`[Frontend] Writing ${blocks.length} blocks to Google Calendar...`);
        const writeRes = await fetch("/api/calendar/write-blocks", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            userId: user.uid,
            commitmentId: savedCommitmentId,
            blocks,
          }),
        });
        if (!writeRes.ok) {
          console.warn("[Frontend] Failed to write action plan blocks to Google Calendar.");
        }
      }

      // 3. Automatically trigger a calendar sync to calculate collisions and update stats immediately
      console.log("[Frontend] Triggering post-add calendar sync...");
      await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      const indexToRemove = confirmingIndex !== null ? confirmingIndex : 0;
      const remaining = extractionDataList.filter((_, idx) => idx !== indexToRemove);
      setExtractionDataList(remaining);

      // Reset planning view variables
      setPlanData(null);
      setSavedCommitmentId(null);
      setConfirmingIndex(null);
      setEditingIndex(null);

      // If no cards left to review, redirect back to dashboard
      if (remaining.length === 0) {
        router.push("/dashboard");
      }
    } catch (e: any) {
      setPlanError(e.message ?? "Failed to save action plan.");
    } finally {
      setPlanLoading(false);
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
      setFileError("Only PDF, JPG, or PNG files are supported");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    uploadFileToFirebase(file);
  };

  const uploadFileToFirebase = (file: File) => {
    if (!user) {
      setFileError("User is not authenticated. Please log in first.");
      return;
    }
    setFileError(null);
    setUploadProgress(0);
    setUploadedFileUrl(null);
    setFileExtractions([]);
    setSelectedExtractedIds(new Set());

    console.log("[Frontend] Uploading file to same-origin backend proxy:", file.name);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user.uid);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-file", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        setUploadProgress(percentComplete);
        console.log(`[Frontend] Proxy upload progress: ${Math.round(percentComplete)}%`);
      }
    };

    xhr.onload = async () => {
      setUploadProgress(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          console.log("[Frontend] Proxy upload complete. URL:", response.fileUrl);
          setUploadedFileUrl(response.fileUrl);
          handleFileExtraction(response.fileUrl, file.type);
        } catch (err: any) {
          console.error("[Frontend] Failed to parse upload response:", err);
          setFileError("Failed to parse upload response.");
          setSelectedFile(null);
        }
      } else {
        let errMsg = `Upload failed with status ${xhr.status}`;
        try {
          const response = JSON.parse(xhr.responseText);
          errMsg = response.error || errMsg;
        } catch (e) {}
        console.error("[Frontend] Upload failed:", errMsg);
        setFileError(errMsg);
        setSelectedFile(null);
      }
    };

    xhr.onerror = () => {
      console.error("[Frontend] Network error during upload");
      setFileError("Network error during upload.");
      setSelectedFile(null);
    };

    xhr.send(formData);
  };

  const handleFileExtraction = async (fileUrl: string, mimeType: string) => {
    if (!user) return;
    setFileExtractionLoading(true);
    setFileError(null);
    console.log("[Frontend] Fetching /api/ai/extract-file with payload:", { userId: user.uid, fileUrl, mimeType });
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai/extract-file", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, fileUrl, mimeType }),
      });
      console.log("[Frontend] /api/ai/extract-file status code:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CommitmentDraftFull[] = await res.json();
      console.log("[Frontend] /api/ai/extract-file returned data:", data);
      setFileExtractions(data);
      setSelectedExtractedIds(new Set(data.map((_, i) => i)));
    } catch (e: any) {
      console.error("[Frontend] handleFileExtraction failed:", e);
      setFileError(e.message ?? "Extraction failed. Try again.");
    } finally {
      setFileExtractionLoading(false);
    }
  };

  const handleToggleFileCheckbox = (index: number) => {
    setSelectedExtractedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleDismissFileItem = (index: number) => {
    setFileExtractions((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedExtractedIds((prev) => {
      const next = new Set<number>();
      prev.forEach((val) => {
        if (val < index) {
          next.add(val);
        } else if (val > index) {
          next.add(val - 1);
        }
      });
      return next;
    });
  };

  const handleAddSelectedFiles = async () => {
    if (!user || selectedExtractedIds.size === 0) return;
    try {
      const indices = Array.from(selectedExtractedIds);
      console.log("[Frontend] Adding selected commitments from files:", indices);
      for (const i of indices) {
        const ext = fileExtractions[i];
        if (!ext) continue;
        console.log("[Frontend] Creating commitment for:", ext.title);
        await createCommitment(user.uid, {
          title: ext.title,
          domain: ext.domain,
          deadline: ext.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          effortEstimateHours: ext.effortEstimateHours,
          priority: ext.priority,
          difficulty: ext.difficulty === "expert" ? "hard" : ext.difficulty,
          estimatedCognitiveLoad: ext.estimatedCognitiveLoad,
          commitmentType: ext.commitmentType,
          recommendedSessions: ext.recommendedSessions,
          stakeholderImportance: ext.stakeholderImportance === "critical" ? "high" : ext.stakeholderImportance,
          status: "active",
          completionPercentage: 0,
        });
      }
      router.push("/dashboard");
    } catch (err: any) {
      console.error("[Frontend] handleAddSelectedFiles failed:", err);
      setFileError(err.message || "Failed to add selected commitments.");
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadedFileUrl(null);
    setFileExtractionLoading(false);
    setFileExtractions([]);
    setSelectedExtractedIds(new Set());
    setFileError(null);
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

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
                    disabled={extractionLoading || planLoading}
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
                      disabled={extractionLoading || planLoading}
                    >
                      <Mic className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </div>

              {voiceError && (
                <div className="flex items-center justify-between gap-3 p-4 bg-error-container text-on-error-container rounded-lg text-[13px] font-semibold font-sans">
                  <span>{voiceError}</span>
                  <button
                    onClick={() => setVoiceError(null)}
                    className="text-primary hover:underline outline-none"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {!extractionLoading && !planLoading && extractionDataList.length === 0 && !planData && (
                <PillButton
                  variant="primary"
                  disabled={!inputText.trim()}
                  onClick={handleTextExtraction}
                  className="w-full h-[52px] text-[16px] font-semibold tracking-wide flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5 flex-shrink-0" />
                  <span>Extract with AI</span>
                </PillButton>
              )}

              {extractionError && (
                <div className="flex items-center justify-between gap-3 p-4 bg-error-container text-on-error-container rounded-lg text-[13px] font-semibold font-sans">
                  <span>{extractionError}</span>
                  <button
                    onClick={() => {
                      setExtractionError(null);
                      handleTextExtraction();
                    }}
                    className="text-primary hover:underline outline-none"
                  >
                    Retry
                  </button>
                </div>
              )}

              {extractionLoading && (
                <div className="space-y-4">
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                </div>
              )}

              {extractionDataList.length > 0 && !planLoading && !planData && (
                <div className="space-y-6">
                  <header className="border-b border-outline-variant/30 pb-2">
                    <h3 className="text-[18px] font-bold text-on-surface font-sans leading-none">
                      AI Extracted {extractionDataList.length} commitment(s)
                    </h3>
                  </header>
                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {extractionDataList.map((item, index) => {
                        const isEditing = editingIndex === index;
                        if (isEditing) {
                          return (
                            <motion.div
                              key={item.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-surface-container-low rounded-[24px] border border-outline-variant/30 p-6 space-y-4 shadow-card"
                            >
                              <div className="flex justify-between items-center">
                                <h3 className="text-[16px] font-bold text-on-surface font-sans">
                                  Edit Details
                                </h3>
                                <button
                                  onClick={() => setEditingIndex(null)}
                                  className="text-outline hover:text-on-surface p-1 rounded-full hover:bg-surface-container-high transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="space-y-4 text-[14px]">
                                <div className="flex flex-col gap-1.5">
                                  <label className="font-semibold text-on-surface-variant font-label text-[12px] tracking-wide uppercase">Title</label>
                                  <input
                                    type="text"
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex flex-col gap-1.5">
                                    <label className="font-semibold text-on-surface-variant font-label text-[12px] tracking-wide uppercase">Domain</label>
                                    <select
                                      value={editedDomain}
                                      onChange={(e) => setEditedDomain(e.target.value as DomainType)}
                                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    >
                                      <option value="academic">Academic</option>
                                      <option value="work">Work</option>
                                      <option value="personal">Personal</option>
                                      <option value="health">Health</option>
                                      <option value="social">Social</option>
                                      <option value="family">Family</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-col gap-1.5">
                                    <label className="font-semibold text-on-surface-variant font-label text-[12px] tracking-wide uppercase">Priority</label>
                                    <select
                                      value={editedPriority}
                                      onChange={(e) => setEditedPriority(e.target.value as PriorityType)}
                                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    >
                                      <option value="critical">Critical</option>
                                      <option value="high">High</option>
                                      <option value="medium">Medium</option>
                                      <option value="low">Low</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex flex-col gap-1.5">
                                    <label className="font-semibold text-on-surface-variant font-label text-[12px] tracking-wide uppercase">Deadline</label>
                                    <input
                                      type="date"
                                      value={editedDeadline}
                                      onChange={(e) => setEditedDeadline(e.target.value)}
                                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1.5">
                                    <label className="font-semibold text-on-surface-variant font-label text-[12px] tracking-wide uppercase">Effort (Hours)</label>
                                    <input
                                      type="number"
                                      min={0.5}
                                      step={0.5}
                                      value={editedEffort}
                                      onChange={(e) => setEditedEffort(Number(e.target.value) || 1)}
                                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col sm:flex-row gap-3 pt-3">
                                <PillButton
                                  variant="primary"
                                  onClick={() => handleConfirmExtraction(index)}
                                  className="flex-1 text-sm font-semibold h-11"
                                >
                                  Confirm and Generate Plan
                                </PillButton>
                                <PillButton
                                  variant="outline"
                                  onClick={() => setEditingIndex(null)}
                                  className="text-sm font-semibold h-11"
                                >
                                  Cancel
                                </PillButton>
                              </div>
                            </motion.div>
                          );
                        }

                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <ExtractionPreviewCard
                              title={item.title}
                              domain={item.domain}
                              priority={item.priority}
                              deadline={item.deadline}
                              effortEstimateHours={item.effortEstimateHours}
                              confidence={item.confidence}
                              requiresUserReview={item.confidence < 0.50}
                              onConfirm={() => handleConfirmExtraction(index)}
                              onEdit={() => startEditingCard(index)}
                              onClose={() => setExtractionDataList(prev => prev.filter((_, idx) => idx !== index))}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {planLoading && (
                <div className="space-y-4">
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                </div>
              )}

              {planError && (
                <div className="flex items-center justify-between gap-3 p-4 bg-error-container text-on-error-container rounded-lg text-[13px] font-semibold font-sans">
                  <span>{planError}</span>
                  <button
                    onClick={() => {
                      setPlanError(null);
                      handleConfirmExtraction(confirmingIndex !== null ? confirmingIndex : 0);
                    }}
                    className="text-primary hover:underline outline-none"
                  >
                    Retry
                  </button>
                </div>
              )}

              {planData && (() => {
                const mappedSteps = planData.steps.map((s) => ({
                  id: s.id,
                  title: s.title,
                  estimatedMinutes: s.estimatedMinutes,
                  suggestedTimeSlot: ((s.suggestedTimeSlot === "morning" || s.suggestedTimeSlot === "afternoon" || s.suggestedTimeSlot === "evening" || s.suggestedTimeSlot === "any")
                    ? s.suggestedTimeSlot
                    : "any") as any,
                  cognitiveIntensity: ((s.cognitiveIntensity === "low" || s.cognitiveIntensity === "medium" || s.cognitiveIntensity === "high")
                    ? s.cognitiveIntensity
                    : "medium") as any,
                  notes: s.notes || null,
                }));

                const mappedAiMeta = planData.aiMeta ? {
                  confidence: planData.aiMeta.confidence,
                  confidenceLabel: (planData.aiMeta.confidenceLabel === "low" || planData.aiMeta.confidenceLabel === "medium" || planData.aiMeta.confidenceLabel === "high" || planData.aiMeta.confidenceLabel === "very_high")
                    ? planData.aiMeta.confidenceLabel
                    : "high",
                  reasoning: planData.aiMeta.reasoning,
                } : undefined;

                return (
                  <ActionPlanPreview
                    steps={mappedSteps}
                    totalMinutes={planData.totalMinutes}
                    requiresUserReview={planData.requiresUserReview || (planData.aiMeta?.confidence !== undefined && planData.aiMeta.confidence < 0.5)}
                    reviewReason={planData.reviewReason || (planData.aiMeta?.confidence !== undefined && planData.aiMeta.confidence < 0.5 ? `Low AI Confidence (${Math.round(planData.aiMeta.confidence * 100)}%): ${planData.aiMeta.reasoning}` : null)}
                    aiMeta={mappedAiMeta as any}
                    loading={planLoading}
                    onAccept={handleAcceptPlan}
                    onRegenerate={() => {
                      setPlanData(null);
                      handleConfirmExtraction(confirmingIndex !== null ? confirmingIndex : 0);
                    }}
                  />
                );
              })()}
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
              {selectedFile && (uploadProgress < 100 || fileExtractionLoading || uploadedFileUrl === null) && (
                <div
                  className={`w-full mx-auto p-6 bg-surface-container-lowest border border-outline-variant rounded-[24px] shadow-card flex flex-col gap-4 transition-all duration-200
                    ${(fileExtractionLoading || uploadProgress >= 100) ? "ring-2 ring-primary/12" : ""}`}
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

                  {uploadProgress < 100 ? (
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
                        <span className="text-primary">{Math.round(uploadProgress)}%</span>
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
              {!fileExtractionLoading && fileExtractions.length > 0 && (
                <div className="space-y-4 pb-24 mt-2">
                  <header className="border-b border-outline-variant/30 pb-2 flex justify-between items-end">
                    <div>
                      <h3 className="text-[18px] font-bold text-on-surface font-sans leading-none">
                        Found {fileExtractions.length} commitment(s)
                      </h3>
                      <p className="text-xs text-on-surface-variant font-label font-semibold mt-1">
                        extracted from {selectedFile?.name}
                      </p>
                    </div>
                    <button
                      onClick={handleCancelUpload}
                      className="text-outline hover:text-on-surface font-label text-xs font-semibold"
                    >
                      Clear File
                    </button>
                  </header>

                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {fileExtractions.map((item, index) => {
                        const isChecked = selectedExtractedIds.has(index);
                        const derivedConfidence = 
                          item.stakeholderImportance === "critical" ? 0.9 :
                          item.stakeholderImportance === "high" ? 0.8 :
                          item.stakeholderImportance === "medium" ? 0.6 : 0.4;
                        const requiresReview = item.stakeholderImportance === "critical" || item.difficulty === "expert";

                        return (
                          <motion.div
                            key={index}
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
                              confidence={derivedConfidence}
                              requiresUserReview={requiresReview}
                              onConfirm={() => handleToggleFileCheckbox(index)}
                              onEdit={() => alert("Manual editing is not available during bulk upload reviews.")}
                              onClose={() => handleDismissFileItem(index)}
                            />

                            {/* Checkbox placement top-right */}
                            <div className="absolute top-5 right-[56px] z-20">
                              <button
                                onClick={() => handleToggleFileCheckbox(index)}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-200 outline-none
                                  ${
                                    isChecked
                                      ? "bg-primary border-primary text-on-primary"
                                      : "border-outline-variant bg-surface-container-lowest"
                                  }`}
                                aria-label={`Select ${item.title}`}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Review Empty State list */}
              {!fileExtractionLoading && selectedFile && uploadedFileUrl && fileExtractions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <FileText className="w-12 h-12 text-outline" />
                  <p className="text-[16px] font-bold text-on-surface-variant font-sans">
                    No commitments detected
                  </p>
                  <button
                    onClick={handleCancelUpload}
                    className="text-primary hover:underline font-semibold text-sm"
                  >
                    Try another file
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky add selected bottom bar */}
        {activeTab === "file" && fileExtractions.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant p-4 z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
            <div className="max-w-[720px] mx-auto">
              <PillButton
                variant="primary"
                onClick={handleAddSelectedFiles}
                disabled={selectedExtractedIds.size === 0}
                className={`w-full h-12 text-sm font-semibold transition-colors duration-200
                  ${selectedExtractedIds.size === 0 ? "bg-surface-dim text-on-surface/30 cursor-not-allowed" : ""}`}
              >
                Add Selected ({selectedExtractedIds.size})
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </NavShell>
  );
}
