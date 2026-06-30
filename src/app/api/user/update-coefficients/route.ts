import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/auth/authVerification";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const decoded = await verifyAuth(req);
    const userId = decoded.uid;

    const body = await req.json();
    const { suggestionId, status } = body;

    if (!suggestionId || !['accepted', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: "Invalid suggestionId or status" }, { status: 400 });
    }

    const suggestionRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("suggestions")
      .doc(suggestionId);

    const docSnap = await suggestionRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    const suggestionData = docSnap.data()!;

    if (status === 'accepted') {
      const type = suggestionData.type;
      const proposedValue = suggestionData.proposedValue;

      const userRef = adminDb.collection("users").doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ error: "User profile not found" }, { status: 404 });
      }

      const userData = userSnap.data()!;
      const currentCoefficients = userData.learningCoefficients || {};
      
      const updates: Record<string, any> = {
        "learningCoefficients.lastUpdated": FieldValue.serverTimestamp()
      };

      if (type === 'attention_span') {
        const spanMinutes = Number(proposedValue);
        if (isNaN(spanMinutes) || spanMinutes <= 0) {
          return NextResponse.json({ error: "Invalid proposed attention span value" }, { status: 400 });
        }
        updates["learningCoefficients.averageAttentionSpanMinutes"] = spanMinutes;
      } else if (type === 'domain_multiplier') {
        let domain = "";
        let multiplier = 1.0;

        if (proposedValue && typeof proposedValue === 'object') {
          if ('domain' in proposedValue && 'multiplier' in proposedValue) {
            domain = proposedValue.domain;
            multiplier = Number(proposedValue.multiplier);
          } else {
            // Assume format { domainName: multiplierValue }
            const keys = Object.keys(proposedValue);
            if (keys.length > 0) {
              domain = keys[0];
              multiplier = Number(proposedValue[keys[0]]);
            }
          }
        }

        if (!domain || isNaN(multiplier) || multiplier <= 0) {
          return NextResponse.json({ error: "Invalid proposed domain multiplier value" }, { status: 400 });
        }

        // Initialize domainEffortMultipliers map if it doesn't exist
        const currentMultipliers = currentCoefficients.domainEffortMultipliers || {};
        const updatedMultipliers = {
          ...currentMultipliers,
          [domain]: multiplier
        };

        updates["learningCoefficients.domainEffortMultipliers"] = updatedMultipliers;
        // Backward compatibility: also sync the global underestimationFactor to this value
        updates["learningCoefficients.underestimationFactor"] = multiplier;
      } else {
        return NextResponse.json({ error: "Unsupported suggestion type" }, { status: 400 });
      }

      // Update both the user's coefficients and the suggestion status in a batch
      const batch = adminDb.batch();
      batch.update(userRef, updates);
      batch.update(suggestionRef, { status: 'accepted' });
      await batch.commit();

      return NextResponse.json({ success: true, status: 'accepted' }, { status: 200 });
    } else {
      // status === 'dismissed'
      await suggestionRef.update({ status: 'dismissed' });
      return NextResponse.json({ success: true, status: 'dismissed' }, { status: 200 });
    }

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[update-coefficients] Failed to update coefficients:", msg);
    return NextResponse.json({ error: "Failed to update coefficients", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
