import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";

const getCredential = () => {
  // 1. Try parsing service account key JSON first
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return cert(serviceAccount);
    } catch (e) {
      console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  // 2. Try individual environment variables
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  }

  return null;
};

let adminDb: any;
let adminAuth: any;
let adminStorage: any;
let adminMessaging: any;

if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
  const createMockDoc = (data: any, exists = true) => ({
    exists,
    id: data.id || "mock-doc-id",
    data: () => data,
    get: (field: string) => data[field]
  });

  const createMockQuerySnapshot = (docsData: any[]) => ({
    docs: docsData.map(d => createMockDoc(d)),
    size: docsData.length,
    forEach: (cb: any) => docsData.map(d => createMockDoc(d)).forEach(cb)
  });

  const mockFirestore = {
    batch: () => {
      const operations: (() => Promise<any>)[] = [];
      const batchMock = {
        update: (docRef: any, updates: any) => {
          operations.push(() => docRef.update(updates));
          return batchMock;
        },
        set: (docRef: any, data: any) => {
          operations.push(() => docRef.set(data));
          return batchMock;
        },
        delete: (docRef: any) => {
          operations.push(() => docRef.delete());
          return batchMock;
        },
        commit: async () => {
          console.log(`[Mock DB] Committing batch of ${operations.length} operations`);
          for (const op of operations) {
            await op();
          }
          return {};
        }
      };
      return batchMock;
    },
    collection: (colName: string) => {
      const colMock: any = {
        doc: (docId: string) => {
          const docMock: any = {
            get: async () => {
              if (colName === "users") {
                return createMockDoc({
                  id: docId,
                  calendarLastFetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                  preferences: { timezone: "UTC", workingHours: { start: 9, end: 18 } },
                  learningCoefficients: {
                    preferredWorkHours: [9, 10, 14, 15, 20, 21],
                    underestimationFactor: 1.2,
                    domainEffortMultipliers: {
                      work: 1.5,
                      academic: 1.8,
                      personal: 1.0,
                      health: 1.0
                    },
                    averageAttentionSpanMinutes: 50,
                    lastUpdated: new Date()
                  },
                  stats: {
                    stressScore: 45,
                    stressScoreComputedAt: new Date(),
                    currentStreak: 5,
                    longestStreak: 10
                  },
                  lastReflectionGeneratedAt: new Date(),
                  longTermGoalsReviewedAt: new Date()
                });
              }
              if (colName === "commitments") {
                return createMockDoc({
                  id: docId,
                  title: "Mock Commitment",
                  description: "Mock Description",
                  domain: "work",
                  deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
                  isLongTermGoal: false,
                  effortEstimateHours: 4,
                  adjustedEffortHours: 4.8,
                  priority: "high",
                  status: "active",
                  riskScore: 50,
                  riskTrend: "stable",
                  completionPercentage: 10,
                  scheduledBlocks: []
                });
              }
              return createMockDoc({}, false);
            },
            update: async (updates: any) => {
              console.log(`[Mock DB] Document ${colName}/${docId} updated:`, updates);
              return {};
            },
            set: async (data: any) => {
              console.log(`[Mock DB] Document ${colName}/${docId} set:`, data);
              return {};
            },
            delete: async () => {
              console.log(`[Mock DB] Document ${colName}/${docId} deleted`);
              return {};
            },
            collection: (subColName: string) => {
              const subColMock: any = {
                add: async (data: any) => {
                  console.log(`[Mock DB] Added document to subcollection ${colName}/${docId}/${subColName}:`, data);
                  return { id: "mock-sub-doc-id" };
                },
                doc: (subDocId: string) => {
                  const subDocMock: any = {
                    get: async () => {
                      if (subColName === "commitments") {
                        return createMockDoc({
                          id: subDocId,
                          title: subDocId === "os-assignment" ? "OS Assignment" : "Amazon OA Invitation",
                          description: "Commitment description",
                          domain: "academic",
                          deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
                          isLongTermGoal: subDocId === "long-term-goal",
                          effortEstimateHours: 6,
                          adjustedEffortHours: 7.2,
                          priority: "high",
                          status: "active",
                          riskScore: 65,
                          riskTrend: "stable",
                          completionPercentage: 20,
                          scheduledBlocks: []
                        });
                      }
                      if (subColName === "suggestions") {
                        if (subDocId === "mock-attention-suggestion") {
                          return createMockDoc({
                            id: subDocId,
                            type: 'attention_span',
                            proposedValue: 45,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            confidence: 0.85
                          });
                        }
                        if (subDocId === "mock-multiplier-suggestion") {
                          return createMockDoc({
                            id: subDocId,
                            type: 'domain_multiplier',
                            proposedValue: { domain: 'academic', multiplier: 1.5 },
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            confidence: 0.9
                          });
                        }
                        return createMockDoc({}, false);
                      }
                      return createMockDoc({}, false);
                    },
                    update: async (updates: any) => {
                      console.log(`[Mock DB] Document ${colName}/${docId}/${subColName}/${subDocId} updated:`, updates);
                      return {};
                    },
                    set: async (data: any) => {
                      console.log(`[Mock DB] Document ${colName}/${docId}/${subColName}/${subDocId} set:`, data);
                      return {};
                    }
                  };
                  return subDocMock;
                },
                where: (field: string, op: string, val: any) => {
                  return subColMock;
                },
                get: async () => {
                  if (subColName === "commitments") {
                    return createMockQuerySnapshot([
                      {
                        id: "os-assignment",
                        title: "OS Assignment",
                        description: "Operating Systems CPU Scheduling assignment",
                        domain: "academic",
                        deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
                        isLongTermGoal: false,
                        effortEstimateHours: 6,
                        adjustedEffortHours: 7.2,
                        priority: "high",
                        status: "active",
                        riskScore: 65,
                        riskTrend: "stable",
                        completionPercentage: 20,
                        scheduledBlocks: []
                      },
                      {
                        id: "birthday-party",
                        title: "Birthday Party",
                        description: "Friend's birthday dinner",
                        domain: "social",
                        deadline: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
                        isLongTermGoal: false,
                        effortEstimateHours: 2,
                        priority: "medium",
                        status: "active",
                        scheduledBlocks: []
                      },
                      {
                        id: "completed-assignment",
                        title: "Completed Assignment",
                        description: "Past academic assignment",
                        domain: "academic",
                        deadline: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
                        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
                        isLongTermGoal: false,
                        effortEstimateHours: 4,
                        completedEffortHours: 8,
                        priority: "high",
                        status: "completed",
                        scheduledBlocks: []
                      }
                    ]);
                  }
                  if (subColName === "renegotiations") {
                    return createMockQuerySnapshot([
                      {
                        userMessage: "I need more time",
                        failureReason: "Got busy",
                        accepted: true
                      }
                    ]);
                  }
                  return createMockQuerySnapshot([]);
                }
              };
              return subColMock;
            }
          };
          return docMock;
        },
        where: (field: string, op: string, val: any) => {
          return colMock;
        },
        get: async () => {
          if (colName === "users") {
            return createMockQuerySnapshot([
              { id: "mock-user-id", email: "mock@example.com" }
            ]);
          }
          return createMockQuerySnapshot([]);
        }
      };
      return colMock;
    }
  };

  adminDb = mockFirestore;
  adminAuth = {
    verifyIdToken: async (token: string) => ({ uid: "mock-user-id", email: "mock@example.com" })
  };
  adminStorage = {};
  adminMessaging = {};
} else {
  if (getApps().length === 0) {
    const credential = getCredential();
    if (credential) {
      initializeApp({
        credential,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  }

  adminDb = getFirestore("default");
  adminAuth = getAuth();
  adminStorage = getStorage();
  adminMessaging = getMessaging();
}

export { adminDb, adminAuth, adminStorage, adminMessaging };
