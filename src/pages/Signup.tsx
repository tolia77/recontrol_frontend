import { useState } from "react";
import logoFull from "src/assets/img/logo-full.svg";
import { Link, useNavigate } from "react-router";
import { authService } from "src/services/backend/authService";
import { saveTokens, saveUserId } from "src/utils/auth";
import { getErrorMessage } from "src/utils/getErrorMessage";
import { useTranslation, Trans } from "react-i18next";
import Button from "src/components/ui/Button";
import { Input } from "src/components/ui";

function Signup() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);

    if (password !== confirmPassword) {
      setErrors([
        t("signup.errors.passwordMismatch", "Passwords do not match"),
      ]);
      return;
    }

    setLoading(true);

    try {
      const res = await authService.register(username, email, password);
      saveTokens(res.data.access_token, res.data.refresh_token);
      saveUserId(res.data.user_id);
      navigate("/dashboard");
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (status === 400) {
        setErrors([t("signup.errors.invalidInput")]);
      } else {
        setErrors([getErrorMessage(error) || t("signup.errors.failed")]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="from-tertiary/30 to-background flex min-h-screen items-center justify-center bg-gradient-to-b">
      <div className="flex flex-col items-center space-y-8 p-8">
        <img src={logoFull} alt="logo" className="h-16" />
        <h1 className="text-primary text-3xl font-bold">{t("signup.title")}</h1>

        <form onSubmit={handleSubmit} className="min-w-[350px] space-y-4">
          {errors.length > 0 && (
            <div className="bg-error/10 border-error/20 space-y-1 rounded-lg border p-3">
              {errors.map((err) => (
                <p key={err} className="text-error text-sm">
                  {err}
                </p>
              ))}
            </div>
          )}

          <Input
            label={t("signup.username")}
            type="text"
            id="username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />

          <Input
            label={t("signup.email")}
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label={t("signup.password")}
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Input
            label={t("signup.confirm")}
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} className="w-full">
            {t("signup.submit")}
          </Button>

          <p className="text-center text-sm">
            <Trans
              ns="auth"
              i18nKey="signup.haveAccount"
              components={{
                loginLink: (
                  <Link
                    className="text-secondary hover:underline"
                    to="/login"
                  />
                ),
              }}
            />
          </p>
        </form>
      </div>
    </main>
  );
}

export default Signup;
