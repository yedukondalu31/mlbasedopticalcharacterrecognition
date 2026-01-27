import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

interface SendOTPRequest {
  email: string;
  action: "send" | "verify";
  code?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create Supabase client with service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, action, code }: SendOTPRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    if (action === "send") {
      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds from now

      // Invalidate any existing OTPs for this email
      await supabase
        .from("otp_codes")
        .update({ used: true })
        .eq("email", email.toLowerCase())
        .eq("used", false);

      // Store the OTP in database
      const { error: insertError } = await supabase
        .from("otp_codes")
        .insert({
          email: email.toLowerCase(),
          code: otp,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error storing OTP:", insertError);
        throw new Error("Failed to generate verification code");
      }

      // Send email with OTP using Resend API
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "ML Answer Evaluator <noreply@mlanswerevaluator.com>",
          to: [email],
          subject: "Your Verification Code",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" max-width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">ML Answer Evaluator</h1>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px 30px;">
                          <h2 style="color: #18181b; margin: 0 0 20px; font-size: 20px; font-weight: 600;">Verify Your Identity</h2>
                          <p style="color: #52525b; margin: 0 0 30px; font-size: 15px;">
                            Enter the following code to complete your sign-in. This code will expire in <strong>60 seconds</strong>.
                          </p>
                          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
                            <span style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #18181b;">${otp}</span>
                          </div>
                          <p style="color: #71717a; margin: 0; font-size: 13px;">
                            If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e4e4e7;">
                          <p style="color: #a1a1aa; margin: 0; font-size: 12px; text-align: center;">
                            © ${new Date().getFullYear()} ML Answer Evaluator. All rights reserved.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const emailError = await emailResponse.text();
        console.error("Error sending email:", emailError);
        throw new Error("Failed to send verification email");
      }

      console.log(`OTP sent successfully to ${email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Verification code sent" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else if (action === "verify") {
      if (!code) {
        throw new Error("Verification code is required");
      }

      // Find valid OTP
      const { data: otpData, error: fetchError } = await supabase
        .from("otp_codes")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !otpData) {
        console.error("OTP verification failed:", fetchError);
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired code" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Mark OTP as used
      await supabase
        .from("otp_codes")
        .update({ used: true })
        .eq("id", otpData.id);

      console.log(`OTP verified successfully for ${email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Code verified successfully" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      throw new Error("Invalid action. Use 'send' or 'verify'");
    }
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
