"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useAtom } from "jotai";
import { themeAtom } from "@/lib/atoms/themeAtom";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { 
  User as UserIcon, 
  Settings, 
  ShieldCheck, 
  ShieldAlert, 
  LogOut, 
  Sun, 
  Moon, 
  Monitor, 
  Check, 
  Sparkles,
  Link2
} from "lucide-react";

export default function ProfilePage() {
  const { user, login, logout, setError } = useUserStore();
  const router = useRouter();
  const [theme, setTheme] = useAtom(themeAtom);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Subscribe to user doc to check if Google Tokens exist and get user statistics
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsGoogleConnected(!!data?.googleRefreshToken);
        setStats(data?.stats || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleConnectGoogle = async () => {
    try {
      await login();
    } catch (err: any) {
      console.error("Google connection failed:", err);
      setError(err.message || "Failed to connect Google account.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Account & Settings</h1>
        <p className="text-sm text-[#8B949E] mt-1">
          Manage your profile details, integration permissions, and appearance theme.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left Column - User Info */}
        <div className="md:col-span-1 bg-[#161B22] border border-[#30363D] rounded-2xl p-6 flex flex-col items-center text-center space-y-4 shadow-sm">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User avatar"}
              className="w-24 h-24 rounded-full object-cover border-2 border-blue-500/20 shadow-md"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-600/10 border-2 border-blue-500/20 flex items-center justify-center text-blue-400">
              <UserIcon className="w-12 h-12" />
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold">{user?.displayName || "FinishLine User"}</h3>
            <p className="text-xs text-[#8B949E] mt-0.5">{user?.email}</p>
          </div>

          {stats && (
            <div className="w-full grid grid-cols-2 gap-3 pt-4 border-t border-[#30363D] text-xs">
              <div className="bg-[#0D1117] p-2.5 rounded-xl border border-[#21262D]">
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider block">Created</span>
                <span className="text-sm font-bold text-white mt-1 block">{stats.totalCommitmentsCreated || 0}</span>
              </div>
              <div className="bg-[#0D1117] p-2.5 rounded-xl border border-[#21262D]">
                <span className="text-[10px] text-[#8B949E] uppercase font-bold tracking-wider block">Completed</span>
                <span className="text-sm font-bold text-green-400 mt-1 block">{stats.totalCompleted || 0}</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/5 transition text-sm font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Right Column - Integrations & Appearance */}
        <div className="md:col-span-2 space-y-6">
          {/* Appearance (Theme Selection) */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#30363D] pb-3">
              <Settings className="w-5 h-5 text-blue-400" />
              <h4 className="text-sm font-bold uppercase tracking-wider">Appearance</h4>
            </div>

            <div className="space-y-3">
              <span className="text-xs text-[#8B949E] font-bold block">Theme Mode</span>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "light", label: "Light", icon: Sun },
                  { name: "dark", label: "Dark", icon: Moon },
                  { name: "system", label: "System", icon: Monitor }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = theme === item.name;

                  return (
                    <button
                      key={item.name}
                      onClick={() => setTheme(item.name as any)}
                      className={`flex flex-col items-center justify-center gap-2 py-3 px-4 rounded-xl border transition cursor-pointer text-sm font-semibold relative ${
                        isActive
                          ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-sm font-bold"
                          : "bg-[#21262D] border-[#30363D] text-[#8B949E] hover:text-white hover:border-[#8b949e]/30"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      {isActive && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-sm">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Connected Services (Google Calendar & Gmail API) */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-400" />
                <h4 className="text-sm font-bold uppercase tracking-wider">Connected Services</h4>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-[#30363D] bg-[#21262D]">
                {isGoogleConnected ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Secure</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400">Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[#8B949E] leading-relaxed">
                FinishLine connects with Google APIs to continuously watch your calendar availability and scan your Gmail inbox for new incoming commitments.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-[#0D1117] border border-[#21262D] rounded-xl">
                  <div>
                    <h5 className="font-bold text-white">Google Calendar API</h5>
                    <p className="text-[#8B949E] text-[10px] mt-0.5">Read/Write scheduling work blocks</p>
                  </div>
                  {isGoogleConnected ? (
                    <span className="text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
                      Connected
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      Action Required
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#0D1117] border border-[#21262D] rounded-xl">
                  <div>
                    <h5 className="font-bold text-white">Gmail Scan API</h5>
                    <p className="text-[#8B949E] text-[10px] mt-0.5">Unread inbox commitment extraction</p>
                  </div>
                  {isGoogleConnected ? (
                    <span className="text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
                      Connected
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      Action Required
                    </span>
                  )}
                </div>
              </div>

              {!isGoogleConnected ? (
                <button
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition duration-200 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Authorize Google Services</span>
                </button>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-white transition duration-200 cursor-pointer"
                >
                  <span>Re-authorize Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
