// lib/email.ts
import { Resend } from "resend";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.log("-----------------------------------------");
    console.log("Simulating Email Dispatch (RESEND_API_KEY is missing):");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("Body Snippet:", html.substring(0, 150));
    console.log("-----------------------------------------");
    return { success: true, simulated: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: "SCC <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to send email via Resend:", err);
    return { success: false, error: err.message };
  }
}
