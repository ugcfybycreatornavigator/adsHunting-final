"use client";

import { Card, Button } from "@/components/ui";
import { inviteTeamMember } from "@/app/(workspace)/settings/team/actions";
import { type PlanEntitlements } from "@/lib/billing/limits";
import { type WorkspaceUsage } from "@/lib/billing/usage";
import { type PlanKey } from "@/lib/billing/billing-config";
import Link from "next/link";
import { useState } from "react";

interface SettingsTeamProps {
  limits: PlanEntitlements;
  usage: WorkspaceUsage;
  planKey: PlanKey | null;
  members: {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    role: string;
  }[];
}

export function SettingsTeam({ limits, usage, planKey, members }: SettingsTeamProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ loading: boolean; error?: string; success?: string }>({ loading: false });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ loading: true });
    
    try {
      const res = await inviteTeamMember(email);
      if (res.error) {
        setStatus({ loading: false, error: res.error });
      } else {
        setStatus({ loading: false, success: res.message });
        setEmail("");
      }
    } catch {
      setStatus({ loading: false, error: "An unexpected error occurred." });
    }
  };

  const planName = planKey === "scout" ? "Scout" : planKey === "hunter" ? "Hunter" : "Agency";

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B]">Workspace</h3>
        
        <div className="mt-4 flex items-center justify-between border border-[#E1E1E1] rounded-[10px] p-4 bg-[#F7F7F8]">
          <div>
             <div className="flex items-center gap-2">
               <p className="text-[14px] font-semibold text-[#18181B]">Your Workspace</p>
             </div>
             <p className="text-[13px] text-[#71717A] mt-1">
               {usage.teamMembers} {usage.teamMembers === 1 ? "member" : "members"} &middot; {planName}
             </p>
          </div>
        </div>

        {limits.canInviteMembers ? (
          <div className="mt-6 pt-6 border-t border-[#E1E1E1]">
            <h4 className="text-[14px] font-semibold text-[#18181B] mb-3">Invite users</h4>
            <form onSubmit={handleInvite} className="flex items-start gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="w-full h-[36px] rounded-[8px] border border-[#E1E1E1] px-3 text-[13px] text-[#18181B] placeholder:text-[#A1A1AA] outline-none focus:border-signal focus:ring-1 focus:ring-signal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status.loading}
                />
                {status.error && <p className="text-red-600 text-[12px] mt-1.5">{status.error}</p>}
                {status.success && <p className="text-green-600 text-[12px] mt-1.5">{status.success}</p>}
              </div>
              <Button type="submit" variant="secondary" className="h-[36px] px-4 shrink-0" disabled={status.loading}>
                {status.loading ? "Sending..." : "Send invite"}
              </Button>
            </form>
          </div>
        ) : (
          <div className="mt-6 pt-6 border-t border-[#E1E1E1]">
            <h4 className="text-[14px] font-semibold text-[#18181B]">Team collaboration</h4>
            <p className="text-[13px] text-[#71717A] mt-1 mb-4">
              Invite teammates and collaborate with Hunter or Agency.
            </p>
            <Link href="/settings/billing">
               <Button variant="primary" className="bg-brand hover:bg-brand-hover text-white h-[36px] text-[13px]">
                 Upgrade membership
               </Button>
            </Link>
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-sm border border-[#E1E1E1] rounded-[12px]">
        <h3 className="text-[15px] font-semibold text-[#18181B] mb-4">Members</h3>
        
        <div className="border border-[#E1E1E1] rounded-[10px] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#F7F7F8] text-[12px] font-semibold text-[#71717A] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold border-b border-[#E1E1E1]">Member</th>
                <th className="px-4 py-3 font-semibold border-b border-[#E1E1E1] hidden sm:table-cell">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E1E1]">
              {members.map((member) => (
                <tr key={member.id} className="group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={member.imageUrl} alt={member.name} className="size-8 rounded-full border border-black/10" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#18181B] truncate">{member.name}</p>
                        <p className="text-[12px] text-[#71717A] truncate">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#18181B] hidden sm:table-cell">
                    {member.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
