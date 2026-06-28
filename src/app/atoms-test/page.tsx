"use client";

import React, { useState } from "react";
import { DomainBadge, DomainType } from "@/components/ui/domain-badge";
import { RiskBadge } from "@/components/ui/risk-badge";
import { ConfidenceBadge, ConfidenceType } from "@/components/ui/confidence-badge";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PriorityBadge, PriorityType } from "@/components/ui/priority-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { SideAccent, SideAccentStatus } from "@/components/ui/side-accent";
import { StressArc } from "@/components/ui/stress-arc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PillButton } from "@/components/ui/pill-button";
import { CommitmentCard } from "@/components/commitment-card";
import { ExtractionPreviewCard } from "@/components/extraction-preview-card";
import { LifeBalanceRadar } from "@/components/life-balance-radar";
import { CollisionBanner } from "@/components/collision-banner";
import { RiskExplanationModal } from "@/components/risk-explanation-modal";
import { NavShell } from "@/components/nav-shell";
import { GmailSuggestionCard } from "@/components/gmail-suggestion-card";
import { ActionPlanPreview } from "@/components/action-plan-preview";
import { ProposedScheduleCard } from "@/components/proposed-schedule-card";
import { MessageInput } from "@/components/message-input";

export default function AtomsTestPage() {
  const domains: DomainType[] = ["academic", "work", "personal", "health", "social", "family"];
  const riskScores = [12, 45, 75, 95];
  const confidences: ConfidenceType[] = ["very_high", "high", "medium", "low"];
  const priorities: PriorityType[] = ["critical", "high", "medium", "low"];
  const sideAccentStatuses: SideAccentStatus[] = ["in-progress", "done", "overdue"];
  const stressScores = [20, 55, 85];

  const dummyCommitments = [
    { id: "c1", domain: "academic", title: "OS Memory Allocator Assignment" },
    { id: "c2", domain: "work", title: "Amazon OA Prep Session" },
    { id: "c3", domain: "social", title: "Sarah's Birthday Celebration" },
    { id: "c4", domain: "health", title: "Blood Test Submission" },
    { id: "c5", domain: "academic", title: "Maths Revision Class" },
    { id: "c6", domain: "family", title: "Sunday Dinner plans" },
  ];

  const [collisionList, setCollisionList] = useState([
    { id: "c1", title: "OS Assignment", collisionDetails: "Overlaps with Sarah's birthday celebration on Wednesday evening." },
    { id: "c2", title: "Amazon OA Review deck", collisionDetails: "Overlaps with weekly club meeting on Thursday afternoon." },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  const [planLoading, setPlanLoading] = useState(false);

  const logAction = (name: string) => {
    console.log(`Action triggered: ${name}`);
  };

  const handleRenegotiate = (id: string) => {
    alert(`Renegotiate triggered for commitment ID: ${id}`);
  };

  const handleDismissCollision = (id: string) => {
    setCollisionList((prev) => prev.filter((c) => c.id !== id));
  };

  const dummySteps = [
    { id: "s1", title: "Review OS Memory layout specs and notes", estimatedMinutes: 45, suggestedTimeSlot: "morning" as const, cognitiveIntensity: "medium" as const },
    { id: "s2", title: "Write memory pool block headers allocation structs", estimatedMinutes: 120, suggestedTimeSlot: "afternoon" as const, cognitiveIntensity: "high" as const },
    { id: "s3", title: "Debug leaks & test allocation boundary fits", estimatedMinutes: 90, suggestedTimeSlot: "evening" as const, cognitiveIntensity: "high" as const },
    { id: "s4", title: "Generate review documents & write up project report", estimatedMinutes: 60, suggestedTimeSlot: "any" as const, cognitiveIntensity: "low" as const },
  ];

  const dummyScheduleBlocks = [
    { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString().split("T")[0], durationMinutes: 120, goal: "Write core block allocators structure" },
    { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().split("T")[0], durationMinutes: 90, goal: "Integrate debug hooks and edge tests" },
  ];

  return (
    <NavShell displayName="Priya Sharma" avatarUrl="">
      {/* Collision Banner Top Bar */}
      <CollisionBanner
        commitments={collisionList}
        onRenegotiateClick={handleRenegotiate}
        onDismiss={handleDismissCollision}
      />

      <div className="max-w-4xl mx-auto p-8 space-y-12">
        <header className="border-b border-outline-variant pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-on-surface font-sans tracking-tight">
              FinishLine Verification Dashboard
            </h1>
            <p className="text-sm text-on-surface-variant mt-2 font-label tracking-wide">
              Theme-Safe Component Preview Suite
            </p>
          </div>
        </header>

        {/* Modal Controls Section */}
        <section className="space-y-4 bg-surface-container-lowest rounded-xl p-5 border border-outline-variant">
          <h2 className="text-xl font-bold text-on-surface">Interactive Risk Explanation Modal</h2>
          <div className="flex flex-wrap gap-4 items-center mt-3">
            <PillButton variant="primary" onClick={() => setIsModalOpen(true)}>
              Launch Risk Modal
            </PillButton>
            <label className="flex items-center gap-2 text-sm text-on-surface font-semibold select-none cursor-pointer">
              <input
                type="checkbox"
                checked={isModalLoading}
                onChange={(e) => setIsModalLoading(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              Mock loading state inside modal
            </label>
          </div>
        </section>

        {/* Gmail Suggestions Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-on-surface">GmailSuggestionCard Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GmailSuggestionCard
              sender="prof.aravind@university.edu"
              subject="URGENT: Resubmission deadline for OS Assignment memory allocators project"
              commitmentTitle="OS Assignment resubmission draft writeup"
              deadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString()}
              urgencyLevel="immediate"
              senderImportance="professor"
              requiresResponse={true}
              onAdd={() => alert("Added professor suggestion!")}
              onDismiss={() => alert("Dismissed professor suggestion!")}
            />
            <GmailSuggestionCard
              sender="hr-recruiting@google.com"
              subject="Google Software Engineering Intern: technical interview schedule dates"
              commitmentTitle="Schedule Google technical mock sessions"
              deadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString()}
              urgencyLevel="this_week"
              senderImportance="recruiter"
              requiresResponse={false}
              onAdd={() => alert("Added recruiter suggestion!")}
              onDismiss={() => alert("Dismissed recruiter suggestion!")}
            />
          </div>
        </section>

        {/* Action Plan Preview Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-on-surface">ActionPlanPreview</h2>
            <label className="flex items-center gap-2 text-sm text-on-surface font-semibold select-none cursor-pointer">
              <input
                type="checkbox"
                checked={planLoading}
                onChange={(e) => setPlanLoading(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              Mock loading plan
            </label>
          </div>
          <ActionPlanPreview
            steps={dummySteps}
            totalMinutes={315}
            requiresUserReview={true}
            reviewReason="Plan requires 5+ hours of high intensity cognitive tasks. Consider splitting."
            aiMeta={{
              confidence: 0.92,
              confidenceLabel: "high",
              reasoning: "Allocating 5.25 hours of focused tasks over the next 48 hours is highly optimized.",
            }}
            loading={planLoading}
            onAccept={() => alert("Plan Accepted")}
            onRegenerate={() => alert("Regenerating Plan...")}
          />
        </section>

        {/* Proposed Schedule Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-on-surface">ProposedScheduleCard</h2>
          <ProposedScheduleCard
            summary="Gemini proposed adjusting your weekly schedule blocks to mitigate overlapping stress peaks. Here is the conflict-free recommendation:"
            blocks={dummyScheduleBlocks}
            newDeadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString()}
            conflictsAvoided={["OS Assignment overlap with Sarah's birthday", "Club review meeting delay"]}
            requiresUserReview={false}
            onConfirm={() => alert("Schedule confirmed")}
            onSuggestAlternative={() => alert("Alternative request sent")}
            aiMeta={{
              confidence: 0.89,
              confidenceLabel: "high",
              reasoning: "By delaying the deadline by 2 days, we free up critical slots on Tuesday and Wednesday.",
            }}
          />
        </section>

        {/* Message Input Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-on-surface">MessageInput (Sticky Footer Demo)</h2>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
            <div className="p-4 h-24 text-sm text-on-surface-variant font-label flex items-center justify-center">
              Send a query to renegotiate schedule rules or parameters...
            </div>
            <MessageInput
              onSend={(msg) => alert(`Message typed: "${msg}"`)}
              placeholder="Ask FinishLine to restructure schedule..."
            />
          </div>
        </section>

        {/* Complex Layout: Radar alongside Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-4 border-t border-outline-variant/30">
          {/* LifeBalanceRadar Column */}
          <div className="md:col-span-1 flex">
            <div className="w-full flex flex-col justify-stretch">
              <LifeBalanceRadar commitments={dummyCommitments} stressScore={55} />
            </div>
          </div>

          {/* CommitmentCard Column */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <CommitmentCard
              id="c1"
              title="Finish OS Memory Allocator Implementation Assignment"
              domain="academic"
              deadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()}
              riskScore={92}
              riskTrend="worsening"
              completionPercentage={15}
              status="active"
              priority="critical"
              onWhyClick={() => setIsModalOpen(true)}
              onFocusClick={() => logAction("OS Assignment Focus")}
            />
          </div>
        </div>

        {/* AI Extraction Preview Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-on-surface">AI Extraction Preview</h2>
          <div className="space-y-6">
            <ExtractionPreviewCard
              title="System Design Mock Interview and prep feedback session"
              domain="work"
              priority="high"
              deadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()}
              effortEstimateHours={4}
              confidence={0.94}
              onConfirm={() => logAction("System Design Confirm")}
              onEdit={() => logAction("System Design Edit")}
              onClose={() => logAction("System Design Close")}
            />
          </div>
        </section>

        {/* Risk Explanation Modal Integration */}
        <RiskExplanationModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          commitmentTitle="Finish OS Memory Allocator Implementation Assignment"
          loading={isModalLoading}
          primaryFactor="Multiple overlapping commitments on Tuesday and Wednesday evening"
          suggestedAction="Renegotiate birthday dinner or shift OS assignment prep block to Monday morning."
          requiresUserReview={true}
          reviewReason="System detected a scheduling collision with Sarah's Birthday Celebration."
          aiMeta={{
            confidence: 0.88,
            confidenceLabel: "high",
            reasoning: "Your weekly schedule is heavily loaded with overlapping assignments. The OS Memory Allocator requires roughly 6 hours of high-concentration effort, but your calendar is fully booked on Tuesday evening with Sarah's birthday celebration and Thursday afternoon with a club review meeting, creating a high-stress bottleneck.",
          }}
        />
      </div>
    </NavShell>
  );
}
