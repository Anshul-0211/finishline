"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Check } from "lucide-react";

interface ExtractionPreviewCardProps {
  initialData: {
    title?: string;
    description?: string;
    domain?: "academic" | "work" | "personal" | "health" | "social" | "family";
    deadline?: string | null;
    isLongTermGoal?: boolean;
    effortEstimateHours?: number;
    priority?: "critical" | "high" | "medium" | "low";
    confidence?: number;
    difficulty?: "easy" | "medium" | "hard" | "expert";
    estimatedCognitiveLoad?: "low" | "medium" | "high";
    commitmentType?: "assignment" | "exam" | "project" | "meeting" | "event" | "interview" | "other";
    practicalVsTheoretical?: "practical" | "theoretical" | "mixed" | null;
    questionCount?: number | null;
    recommendedSessions?: number;
    prerequisiteKnowledge?: string[];
    stakeholderImportance?: "low" | "medium" | "high" | "critical";
    requiredResponse?: boolean;
    extractedEntities?: {
      people: string[];
      locations: string[];
      tools: string[];
    };
  };
  onSave?: (savedCommitment: any) => void;
}

export default function ExtractionPreviewCard({ initialData, onSave }: ExtractionPreviewCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState(initialData.title || "");
  const [description, setDescription] = useState(initialData.description || "");
  const [domain, setDomain] = useState(initialData.domain || "personal");
  const [deadline, setDeadline] = useState(
    initialData.deadline ? new Date(initialData.deadline).toISOString().slice(0, 16) : ""
  );
  const [effortEstimateHours, setEffortEstimateHours] = useState(initialData.effortEstimateHours || 2);
  const [priority, setPriority] = useState(initialData.priority || "medium");
  const [isLongTermGoal, setIsLongTermGoal] = useState(initialData.isLongTermGoal || false);

  const confidence = initialData.confidence !== undefined ? initialData.confidence : 0.8;
  const requiresReview = confidence < 0.75;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const mappedData = {
      title,
      description,
      domain,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      isLongTermGoal,
      effortEstimateHours: Number(effortEstimateHours),
      priority,
      confidence,
      reasoning: "Extracted and approved by user",
      difficulty: initialData.difficulty || "medium",
      estimatedCognitiveLoad: initialData.estimatedCognitiveLoad || "medium",
      commitmentType: initialData.commitmentType || "other",
      practicalVsTheoretical: initialData.practicalVsTheoretical || "mixed",
      questionCount: initialData.questionCount || null,
      recommendedSessions: initialData.recommendedSessions || 1,
      prerequisiteKnowledge: initialData.prerequisiteKnowledge || [],
      stakeholderImportance: initialData.stakeholderImportance || "medium",
      requiredResponse: initialData.requiredResponse || false,
      extractedEntities: initialData.extractedEntities || { people: [], locations: [], tools: [] },
    };

    try {
      const res = await fetch("/api/commitments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappedData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save commitment");
      }

      const result = await res.json();
      if (onSave) {
        onSave(result.commitment);
      } else {
        router.push(`/dashboard/commitments/${result.commitment.id}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while saving");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-6 shadow-md max-w-2xl w-full text-white mx-auto"
    >
      <div className="flex items-center justify-between border-b border-[#30363D] pb-4">
        <div>
          <h3 className="text-lg font-bold">Extraction Preview</h3>
          <p className="text-xs text-[#8B949E] mt-0.5">
            Review and adjust the details extracted by FinishLine AI.
          </p>
        </div>
        {/* Confidence Badge */}
        <div className="text-right flex flex-col items-end">
          <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-semibold">
            AI Confidence
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full border mt-1 ${
              confidence >= 0.75
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}
          >
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {requiresReview && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">Review required:</span> FinishLine has lower confidence in some of these details. Please verify dates and efforts are correct before confirming.
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-4">
        {/* Title */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Title</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col space-y-1.5">
          <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Domain */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Domain</label>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value as any)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition"
            >
              <option value="academic">Academic</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="health">Health</option>
              <option value="social">Social</option>
              <option value="family">Family</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical Priority</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">Deadline</label>
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          {/* Effort */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
              Estimated Effort (Hours)
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                required
                min={0.5}
                step={0.5}
                value={effortEstimateHours}
                onChange={(e) => setEffortEstimateHours(Number(e.target.value))}
                className="w-full bg-[#0D1117] border border-[#30363D] rounded-xl pl-4 pr-16 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none transition"
              />
              <span className="absolute right-4 text-xs text-[#8B949E] font-medium pointer-events-none">
                hours
              </span>
            </div>
          </div>
        </div>

        {/* Long term goal toggle */}
        <div className="flex items-center gap-3 bg-[#0D1117]/50 border border-[#30363D]/50 p-4 rounded-xl">
          <input
            type="checkbox"
            id="isLongTermGoal"
            checked={isLongTermGoal}
            onChange={(e) => setIsLongTermGoal(e.target.checked)}
            className="w-4 h-4 rounded border-[#30363D] bg-[#0D1117] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#161B22] focus:outline-none transition cursor-pointer"
          />
          <div className="flex flex-col text-left">
            <label htmlFor="isLongTermGoal" className="text-sm font-bold text-white cursor-pointer">
              Mark as Long-Term Goal
            </label>
            <span className="text-xs text-[#8B949E]">
              If this does not have a strict timeline and requires routine progress checks.
            </span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 border-t border-[#30363D] pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-white/60 text-white font-bold shadow-md transition duration-200 cursor-pointer text-sm w-full md:w-auto"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Confirm & Schedule</span>
        </button>
      </div>
    </form>
  );
}
