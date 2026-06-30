"use strict";
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
var env_1 = require("@next/env");
(0, env_1.loadEnvConfig)(process.cwd());
var firebaseAdmin_1 = require("../src/lib/firebaseAdmin");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var usersSnap, userDoc, userId, sugRef1, sugRef2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, firebaseAdmin_1.adminDb.collection("users").limit(1).get()];
                case 1:
                    usersSnap = _a.sent();
                    if (usersSnap.empty) {
                        console.log("No users found in Firestore!");
                        return [2 /*return*/];
                    }
                    userDoc = usersSnap.docs[0];
                    userId = userDoc.id;
                    console.log("Found user: ".concat(userId, " (").concat(userDoc.data().email, ")"));
                    return [4 /*yield*/, firebaseAdmin_1.adminDb.collection("users").doc(userId).collection("suggestions").add({
                            type: "domain_multiplier",
                            description: "You routinely underestimate Work tasks by 25%. Suggest adjusting Work multiplier to 1.25x.",
                            proposedValue: { domain: "work", multiplier: 1.25 },
                            confidence: 0.85,
                            status: "pending",
                            createdAt: new Date().toISOString()
                        })];
                case 2:
                    sugRef1 = _a.sent();
                    console.log("Created domain suggestion: ".concat(sugRef1.id));
                    return [4 /*yield*/, firebaseAdmin_1.adminDb.collection("users").doc(userId).collection("suggestions").add({
                            type: "attention_span",
                            description: "Your focus sessions show high burnout indicators after 35 minutes. Suggest adjusting attention span to 35 minutes.",
                            proposedValue: 35,
                            confidence: 0.92,
                            status: "pending",
                            createdAt: new Date().toISOString()
                        })];
                case 3:
                    sugRef2 = _a.sent();
                    console.log("Created attention span suggestion: ".concat(sugRef2.id));
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
