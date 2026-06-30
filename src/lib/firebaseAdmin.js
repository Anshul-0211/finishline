"use strict";
// Self-healing check for GOOGLE_APPLICATION_CREDENTIALS path
if (typeof window === "undefined" && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    var fs = require("fs");
    if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      console.warn('[Init] GOOGLE_APPLICATION_CREDENTIALS points to a non-existent path: "' + process.env.GOOGLE_APPLICATION_CREDENTIALS + '". Unsetting it to allow default fallback (ADC).');
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }
  } catch (e) {
    console.error("Error verifying GOOGLE_APPLICATION_CREDENTIALS:", e);
  }
}
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminMessaging = exports.adminStorage = exports.adminAuth = exports.adminDb = void 0;
var app_1 = require("firebase-admin/app");
var firestore_1 = require("firebase-admin/firestore");
var auth_1 = require("firebase-admin/auth");
var storage_1 = require("firebase-admin/storage");
var messaging_1 = require("firebase-admin/messaging");
var getCredential = function () {
    // 1. Try parsing service account key JSON first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
            var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            return (0, app_1.cert)(serviceAccount);
        }
        catch (e) {
            console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", e);
        }
    }
    // 2. Try individual environment variables
    var privateKey = process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined;
    if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
        return (0, app_1.cert)({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        });
    }
    return null;
};
var adminDb;
var adminAuth;
var adminStorage;
var adminMessaging;
if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    var createMockDoc_1 = function (data, exists) {
        if (exists === void 0) { exists = true; }
        return ({
            exists: exists,
            id: data.id || "mock-doc-id",
            data: function () { return data; },
            get: function (field) { return data[field]; }
        });
    };
    var createMockQuerySnapshot_1 = function (docsData) { return ({
        docs: docsData.map(function (d) { return createMockDoc_1(d); }),
        size: docsData.length,
        forEach: function (cb) { return docsData.map(function (d) { return createMockDoc_1(d); }).forEach(cb); }
    }); };
    var mockFirestore = {
        collection: function (colName) {
            var colMock = {
                doc: function (docId) {
                    var docMock = {
                        get: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                if (colName === "users") {
                                    return [2 /*return*/, createMockDoc_1({
                                            id: docId,
                                            calendarLastFetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                                            preferences: { timezone: "UTC", workingHours: { start: 9, end: 18 } },
                                            learningCoefficients: {
                                                preferredWorkHours: [9, 10, 14, 15, 20, 21],
                                                underestimationFactor: 1.2,
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
                                        })];
                                }
                                if (colName === "commitments") {
                                    return [2 /*return*/, createMockDoc_1({
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
                                        })];
                                }
                                return [2 /*return*/, createMockDoc_1({}, false)];
                            });
                        }); },
                        update: function (updates) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                console.log("[Mock DB] Document ".concat(colName, "/").concat(docId, " updated:"), updates);
                                return [2 /*return*/, {}];
                            });
                        }); },
                        set: function (data) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                console.log("[Mock DB] Document ".concat(colName, "/").concat(docId, " set:"), data);
                                return [2 /*return*/, {}];
                            });
                        }); },
                        delete: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                console.log("[Mock DB] Document ".concat(colName, "/").concat(docId, " deleted"));
                                return [2 /*return*/, {}];
                            });
                        }); },
                        collection: function (subColName) {
                            var subColMock = {
                                doc: function (subDocId) {
                                    var subDocMock = {
                                        get: function () { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                if (subColName === "commitments") {
                                                    return [2 /*return*/, createMockDoc_1({
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
                                                        })];
                                                }
                                                return [2 /*return*/, createMockDoc_1({}, false)];
                                            });
                                        }); },
                                        update: function (updates) { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                console.log("[Mock DB] Document ".concat(colName, "/").concat(docId, "/").concat(subColName, "/").concat(subDocId, " updated:"), updates);
                                                return [2 /*return*/, {}];
                                            });
                                        }); },
                                        set: function (data) { return __awaiter(void 0, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                console.log("[Mock DB] Document ".concat(colName, "/").concat(docId, "/").concat(subColName, "/").concat(subDocId, " set:"), data);
                                                return [2 /*return*/, {}];
                                            });
                                        }); }
                                    };
                                    return subDocMock;
                                },
                                where: function (field, op, val) {
                                    return subColMock;
                                },
                                get: function () { return __awaiter(void 0, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        if (subColName === "commitments") {
                                            return [2 /*return*/, createMockQuerySnapshot_1([
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
                                                    }
                                                ])];
                                        }
                                        if (subColName === "renegotiations") {
                                            return [2 /*return*/, createMockQuerySnapshot_1([
                                                    {
                                                        userMessage: "I need more time",
                                                        failureReason: "Got busy",
                                                        accepted: true
                                                    }
                                                ])];
                                        }
                                        return [2 /*return*/, createMockQuerySnapshot_1([])];
                                    });
                                }); }
                            };
                            return subColMock;
                        }
                    };
                    return docMock;
                },
                where: function (field, op, val) {
                    return colMock;
                },
                get: function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (colName === "users") {
                            return [2 /*return*/, createMockQuerySnapshot_1([
                                    { id: "mock-user-id", email: "mock@example.com" }
                                ])];
                        }
                        return [2 /*return*/, createMockQuerySnapshot_1([])];
                    });
                }); }
            };
            return colMock;
        }
    };
    exports.adminDb = adminDb = mockFirestore;
    exports.adminAuth = adminAuth = {
        verifyIdToken: function (token) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, ({ uid: "mock-user-id", email: "mock@example.com" })];
        }); }); }
    };
    exports.adminStorage = adminStorage = {};
    exports.adminMessaging = adminMessaging = {};
}
else {
    if ((0, app_1.getApps)().length === 0) {
        var credential = getCredential();
        if (credential) {
            (0, app_1.initializeApp)({
                credential: credential,
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        }
        else {
            (0, app_1.initializeApp)({
                projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            });
        }
    }
    exports.adminDb = adminDb = (0, firestore_1.getFirestore)("default");
    exports.adminAuth = adminAuth = (0, auth_1.getAuth)();
    exports.adminStorage = adminStorage = (0, storage_1.getStorage)();
    exports.adminMessaging = adminMessaging = (0, messaging_1.getMessaging)();
}
