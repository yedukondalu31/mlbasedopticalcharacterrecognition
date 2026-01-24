import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Mail, Loader2, KeyRound, Lock, ArrowLeft, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type AuthStep = 'credentials' | 'otp-verification' | 'forgot-password' | 'reset-password';

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>('credentials');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [otpCountdown, setOtpCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    // Check if this is a password reset callback
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setAuthStep('reset-password');
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && authStep === 'credentials') {
        navigate('/');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthStep('reset-password');
        return;
      }
      
      if (session && authStep === 'credentials') {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, authStep, searchParams]);

  // OTP countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (authStep === 'otp-verification' && otpCountdown > 0) {
      interval = setInterval(() => {
        setOtpCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [authStep, otpCountdown]);

  const validateEmail = (email: string): boolean => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast({
        title: 'Invalid email',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const sendOtpForVerification = async (userEmail: string) => {
    try {
      // Call the custom send-otp edge function
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: {
          email: userEmail,
          action: 'send',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAuthStep('otp-verification');
      setOtpCountdown(60);
      setCanResend(false);
      toast({
        title: 'Verification Code Sent',
        description: 'A 6-digit code has been sent to your email',
      });
    } catch (error: any) {
      toast({
        title: 'Error sending verification code',
        description: error.message || 'Failed to send verification code',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit code from your email',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Verify the OTP with our custom edge function
      const { data, error: invokeError } = await supabase.functions.invoke('send-otp', {
        body: {
          email,
          action: 'verify',
          code: otp,
        },
      });

      if (invokeError) throw invokeError;
      if (!data?.success) throw new Error(data?.error || 'Invalid or expired code');

      // OTP verified - now sign in the user with their password
      // We already validated their password earlier, so we can proceed
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      toast({
        title: 'Verified!',
        description: 'You are now logged in',
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid or expired code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const handlePasswordAuth = async () => {
    if (!validateEmail(email)) return;

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({
        title: 'Invalid password',
        description: passwordResult.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        // Sign out immediately - we'll sign back in after OTP verification
        await supabase.auth.signOut();
        
        await sendOtpForVerification(email);
        
        toast({
          title: 'Account created!',
          description: 'Please verify with the 6-digit code sent to your email',
        });
      } else {
        // For sign-in, validate credentials first
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Sign out immediately - we'll sign back in after OTP verification
        await supabase.auth.signOut();

        await sendOtpForVerification(email);
      }
    } catch (error: any) {
      let message = error.message;
      if (error.message?.includes('User already registered')) {
        message = 'This email is already registered. Please sign in instead.';
      } else if (error.message?.includes('Invalid login credentials')) {
        message = 'Invalid email or password. Please try again.';
      }
      
      toast({
        title: authMode === 'signup' ? 'Sign up failed' : 'Sign in failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) throw error;

      toast({
        title: 'Reset link sent!',
        description: 'Check your email for the password reset link',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reset email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast({
        title: 'Invalid password',
        description: passwordResult.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: 'Password updated!',
        description: 'Your password has been reset successfully',
      });
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      setAuthStep('credentials');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await sendOtpForVerification(email);
      toast({
        title: 'Code resent',
        description: 'Check your email for the new verification code',
      });
    } catch (error) {
      // Error already handled
    } finally {
      setLoading(false);
    }
  };

  const resetToCredentials = () => {
    setAuthStep('credentials');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    setOtpCountdown(60);
    setCanResend(false);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-primary/5 to-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            ML Answer Evaluator
          </h1>
          <p className="text-muted-foreground">
            {authStep === 'otp-verification' && 'Verify your identity'}
            {authStep === 'forgot-password' && 'Reset your password'}
            {authStep === 'reset-password' && 'Create new password'}
            {authStep === 'credentials' && 'Sign in to start grading'}
          </p>
        </div>

        <Card className="p-6 shadow-lg border-2">
          {authStep === 'reset-password' ? (
            /* Reset Password Step */
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Set New Password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your new password below
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={loading || !password || !confirmPassword}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Update Password
              </Button>
            </div>
          ) : authStep === 'forgot-password' ? (
            /* Forgot Password Step */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToCredentials}
                className="gap-1 -ml-2 mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>

              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Forgot Password?</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <Button
                onClick={handleForgotPassword}
                disabled={loading || !email}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send Reset Link
              </Button>
            </div>
          ) : authStep === 'otp-verification' ? (
            /* OTP Verification Step (2FA) */
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToCredentials}
                className="gap-1 -ml-2 mb-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="text-center mb-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Two-Factor Verification</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to
                </p>
                <p className="font-medium text-primary">{email}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  The code expires in 60 seconds
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-center block">Enter Verification Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                
                {/* Countdown Timer */}
                <div className="text-center mt-3">
                  {otpCountdown > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Code expires in{' '}
                      <span className={`font-mono font-semibold ${otpCountdown <= 10 ? 'text-destructive' : 'text-primary'}`}>
                        {formatCountdown(otpCountdown)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-destructive font-medium">
                      Code expired. Please request a new one.
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6 || otpCountdown === 0}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Verify & Continue
              </Button>

              <Button
                variant={canResend ? "default" : "ghost"}
                size="sm"
                onClick={handleResendOtp}
                disabled={loading || !canResend}
                className={`w-full text-sm ${canResend ? 'animate-pulse' : ''}`}
              >
                {canResend ? (
                  <>
                    <Mail className="h-4 w-4 mr-1" />
                    Resend Code Now
                  </>
                ) : (
                  `Resend code in ${formatCountdown(otpCountdown)}`
                )}
              </Button>
            </div>
          ) : (
            /* Credentials Step */
            <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'signin' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => setAuthStep('forgot-password')}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={handlePasswordAuth}
                  disabled={loading || !email || !password}
                  className="w-full gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Sign In
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  <ShieldCheck className="inline h-3 w-3 mr-1" />
                  You'll receive a verification code via email
                </p>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                </div>

                <Button
                  onClick={handlePasswordAuth}
                  disabled={loading || !email || !password}
                  className="w-full gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Create Account
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  <ShieldCheck className="inline h-3 w-3 mr-1" />
                  You'll receive a verification code via email
                </p>
              </TabsContent>
            </Tabs>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
