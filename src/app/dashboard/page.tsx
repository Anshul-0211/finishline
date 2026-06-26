"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, collection, onSnapshot, updateDoc } from "firebase/firestore";
import StressGaugeCard from "@/components/dashboard/StressGaugeCard";
import PriorityStack from "@/components/dashboard/PriorityStack";
import AgentStatusBar from "@/components/dashboard/AgentStatusBar";
import CollisionBanner from "@/components/dashboard/CollisionBanner";

export default function Dashboard() {
  const { user } = useUserStore();
  const router = useRouter();

  const [stressScore, setStressScore] = useState(0);
  const [commitments, setCommitments] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;

    // 1. Subscribe to user document (for stressScore)
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStressScore(data?.stats?.stressScore || 0);
        }
      },
      (error) => {
        console.error("Error subscribing to user doc:", error);
      }
    );

    // 2. Subscribe to user commitments
    const commitmentsRef = collection(db, "users", user.uid, "commitments");
    const unsubscribeCommitments = onSnapshot(
      commitmentsRef,
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((doc) => {
          const data = doc.data();
          if (data.status === "active") {
            list.push({ id: doc.id, ...data });
          }
        });
        setCommitments(list);
      },
      (error) => {
        console.error("Error subscribing to commitments:", error);
      }
    );

    // 3. Subscribe to user alerts (unread collisions)
    const alertsRef = collection(db, "users", user.uid, "alerts");
    const unsubscribeAlerts = onSnapshot(
      alertsRef,
      (querySnap) => {
        const list: any[] = [];
        querySnap.forEach((doc) => {
          const data = doc.data();
          if (!data.read) {
            list.push({ id: doc.id, ...data });
          }
        });
        setAlerts(list);
      },
      (error) => {
        console.error("Error subscribing to alerts:", error);
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeCommitments();
      unsubscribeAlerts();
    };
  }, [user]);

  const handleDismissAlert = async (alertId: string) => {
    if (!user?.uid) return;
    try {
      const alertRef = doc(db, "users", user.uid, "alerts", alertId);
      await updateDoc(alertRef, { read: true });
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Overview
        </h1>
        <p className="text-sm text-[#8B949E]">
          Here is how your commitments are tracking this week.
        </p>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        {/* Left Side: Stress Gauge & Agent heartbeat */}
        <div className="xl:col-span-1 space-y-6">
          <StressGaugeCard value={stressScore} />
          {user?.uid && <AgentStatusBar userId={user.uid} />}
        </div>

        {/* Right Side: Collision Alerts & Commitments Stack */}
        <div className="xl:col-span-2 space-y-6">
          <CollisionBanner alerts={alerts} onDismiss={handleDismissAlert} />
          <PriorityStack commitments={commitments} />
        </div>
      </div>
    </div>
  );
}
