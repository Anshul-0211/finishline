import { calculateRiskScore, calculateProbability } from "./riskEngine";
import { Commitment, User } from "../types";

// Helper to create a base mock user
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    uid: "test-user-123",
    email: "priya@example.com",
    displayName: "Priya",
    photoURL: "",
    googleAccessToken: "",
    googleRefreshToken: "",
    tokenExpiry: null,
    preferences: {
      defaultDomain: "academic",
      workingHours: { start: 9, end: 18 },
      theme: "dark",
      notificationsEnabled: true,
      fcmToken: "",
    },
    learningCoefficients: {
      underestimationFactor: 1.2,
      preferredWorkHours: [9, 10, 14, 15, 20, 21],
      avgProcrastinationBuffer: 2,
      lastUpdated: null,
    },
    stats: {
      totalCommitmentsCreated: 5,
      totalCompleted: 3,
      totalMissed: 1,
      currentStreak: 2,
      longestStreak: 4,
      stressScore: 40,
    },
    createdAt: new Date(),
    lastActiveAt: new Date(),
    ...overrides,
  };
}

// Helper to create a base mock commitment
function createMockCommitment(overrides: Partial<Commitment> = {}): Commitment {
  const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
  const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const effortEstimateHours = 10;
  const adjustedEffortHours = effortEstimateHours * 1.2; // using user's factor 1.2

  return {
    id: "test-commitment-abc",
    title: "OS Assignment",
    description: "Implement simple shell",
    domain: "academic",
    status: "active",
    priority: "high",
    deadline,
    effortEstimateHours,
    adjustedEffortHours,
    completedEffortHours: 0,
    completionPercentage: 0,
    riskScore: 0,
    riskTrend: "stable",
    probabilityCurrentPath: 50,
    probabilityRecommendedPath: 70,
    source: "manual",
    sourceFileUrl: null,
    gmailMessageId: null,
    actionPlan: null,
    calendarEventIds: [],
    scheduledBlocks: [],
    nextCheckInAt: null,
    lastCheckInAt: new Date(),
    checkInHistory: [],
    isLongTermGoal: false,
    lastResurfacedAt: null,
    tags: [],
    createdAt,
    updatedAt: new Date(),
    extractedByAI: false,
    extractionConfidence: 1,
    ...overrides,
  };
}

function runTests() {
  console.log("=== RUNNING RISK SCORE ENGINE TESTS ===");
  let failures = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ Passed: ${message}`);
    } else {
      console.error(`✗ Failed: ${message}`);
      failures++;
    }
  }

  const user = createMockUser();

  // Scenario 1: Deadline has passed (should return 100)
  try {
    const deadlinePassed = createMockCommitment({
      deadline: new Date(Date.now() - 1000), // passed 1 second ago
    });
    const score = calculateRiskScore(deadlinePassed, user);
    assert(score === 100, `Deadline passed returns risk score 100 (got ${score})`);
  } catch (e: any) {
    console.error("Error in Scenario 1:", e);
    failures++;
  }

  // Scenario 2: 80% completion with 5 days left (should return < 30)
  try {
    const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days left
    const lowRiskCommitment = createMockCommitment({
      deadline,
      effortEstimateHours: 10,
      adjustedEffortHours: 12,
      completedEffortHours: 9.6,
      completionPercentage: 80,
      lastCheckInAt: new Date(), // fresh check in
      scheduledBlocks: [
        {
          start: new Date(Date.now() + 10000),
          end: new Date(Date.now() + 3_600_000 * 3), // 3 hours scheduled
          calendarEventId: "evt-1",
        }
      ],
      actionPlan: {
        steps: [
          { id: "1", title: "Step 1", estimatedMinutes: 60, completed: true, completedAt: new Date() },
          { id: "2", title: "Step 2", estimatedMinutes: 60, completed: false, completedAt: null },
        ],
        generatedAt: new Date(),
      }
    });

    const score = calculateRiskScore(lowRiskCommitment, user);
    assert(score < 30, `80% complete & 5 days left returns score < 30 (got ${score})`);
  } catch (e: any) {
    console.error("Error in Scenario 2:", e);
    failures++;
  }

  // Scenario 3: High workload & calendar availability gap (should be high risk)
  try {
    const deadline = new Date(Date.now() + 6 * 3600 * 1000); // 6 hours left
    const highRiskCommitment = createMockCommitment({
      deadline,
      effortEstimateHours: 10,
      adjustedEffortHours: 12,
      completedEffortHours: 0,
      completionPercentage: 0,
      scheduledBlocks: [], // No calendar blocks scheduled! Big penalty!
      actionPlan: {
        steps: [
          { id: "1", title: "Step 1", estimatedMinutes: 300, completed: false, completedAt: null },
          { id: "2", title: "Step 2", estimatedMinutes: 300, completed: false, completedAt: null },
        ],
        generatedAt: new Date(),
      }
    });

    const score = calculateRiskScore(highRiskCommitment, user);
    // workloadRatio = 12 / 6 = 2. Math.min(2 * 40, 60) = 60.
    // calendarGap = 12. calendarPenalty = 1. Penalty = 20.
    // overdueSteps = 2/2 = 1. subtaskPenalty = 0.2. Penalty = 20.
    // stalePenalty = 0 (checkin is fresh).
    // Raw score should be around 60 + 20 + 20 = 100.
    assert(score > 75, `High workload & no slots returns high risk score (got ${score})`);
  } catch (e: any) {
    console.error("Error in Scenario 3:", e);
    failures++;
  }

  // Scenario 4: Overdue subtask and check-in staleness penalty
  try {
    const deadline = new Date(Date.now() + 48 * 3600 * 1000); // 48 hours left
    const staleCommitment = createMockCommitment({
      deadline,
      effortEstimateHours: 5,
      adjustedEffortHours: 6,
      completedEffortHours: 1,
      completionPercentage: 15,
      lastCheckInAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // check-in was 4 days ago (stale > 3 days!)
      scheduledBlocks: [
        {
          start: new Date(Date.now() + 3600 * 1000),
          end: new Date(Date.now() + 3600 * 6000), // 5 hours scheduled
          calendarEventId: "evt-2"
        }
      ],
      actionPlan: {
        steps: [
          { id: "1", title: "Step 1", estimatedMinutes: 120, completed: false, completedAt: null },
          { id: "2", title: "Step 2", estimatedMinutes: 120, completed: false, completedAt: null },
        ],
        generatedAt: new Date(),
      }
    });

    const score = calculateRiskScore(staleCommitment, user);
    assert(score > 30, `Staleness & overdue steps increase risk score (got ${score})`);
  } catch (e: any) {
    console.error("Error in Scenario 4:", e);
    failures++;
  }

  // Scenario 5: Probability Simulator (current path vs recommended path)
  try {
    const deadline = new Date(Date.now() + 10 * 3600 * 1000); // 10 hours left
    const testProbCommitment = createMockCommitment({
      deadline,
      createdAt: new Date(Date.now() - 20 * 3600 * 1000), // created 20 hours ago
      effortEstimateHours: 8,
      adjustedEffortHours: 9.6,
      completedEffortHours: 4, // worked 4 hours in 20 hours -> rate = 0.2 hrs/hr
      completionPercentage: 40,
    });

    // 6 hours of available calendar slots
    const probs = calculateProbability(testProbCommitment, user, 6);
    assert(probs.currentPath >= 5, `Current path probability is >= 5% (got ${probs.currentPath}%)`);
    assert(probs.recommendedPath >= probs.currentPath + 10, `Recommended path probability improves over current (got Current: ${probs.currentPath}%, Recommended: ${probs.recommendedPath}%)`);
  } catch (e: any) {
    console.error("Error in Scenario 5:", e);
    failures++;
  }

  if (failures > 0) {
    console.error(`\nTest suite finished with ${failures} failure(s).`);
    process.exit(1);
  } else {
    console.log("\n✓ All risk engine tests passed successfully!");
  }
}

runTests();
