import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const accessError = await requirePaidWorkspaceAccess();
  if (accessError) return accessError;

  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = orgId || userId;

    const formData = await req.formData();
    const type = formData.get("type") as string;
    const message = formData.get("message") as string;
    const context = formData.get("context") as string;
    const attachment = formData.get("attachment") as File | null;

    if (!type || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    let parsedContext: Record<string, string> = {};
    try {
      if (context) parsedContext = JSON.parse(context);
    } catch {
      // ignore
    }

    const supabase = createAdminClient();
    
    // Create feedback record first to get ID
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("support_feedback")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        type,
        message,
        page_url: parsedContext.page || null,
        request_id: parsedContext.requestId || null,
      })
      .select("id")
      .single();

    if (feedbackError) {
      console.error("Failed to insert feedback", feedbackError);
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    const feedbackId = feedbackData.id;

    // Handle attachment upload if exists
    if (attachment) {
      const extension = attachment.name.split('.').pop() || 'bin';
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const path = `${workspaceId}/${feedbackId}/${safeFileName}`;

      const arrayBuffer = await attachment.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from("support-attachments")
        .upload(path, buffer, {
          contentType: attachment.type,
          upsert: false
        });

      if (uploadError) {
        console.error("Failed to upload attachment", uploadError);
        // We don't fail the whole request if attachment fails, just update the record
        // But we could log it.
      } else {
        await supabase
          .from("support_feedback")
          .update({ attachment_path: path })
          .eq("id", feedbackId);
      }
    }

    return NextResponse.json({ success: true, id: feedbackId });

  } catch (error) {
    console.error("Feedback API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
