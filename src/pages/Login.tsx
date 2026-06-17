import { useState } from "react";
import logoFull from "src/assets/img/logo-full.svg";
import { Link, useNavigate } from "react-router";
import { authService } from "src/services/backend/authService";
import { saveTokens, saveUserId, saveUserRole } from "src/utils/auth";
import { triggerAuthChange } from "src/utils/authBus";
import { useTranslation, Trans } from "react-i18next";
import Button from "src/components/ui/Button";
import { Input } from "src/components/ui";

function Login() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);
    setLoading(true);

    try {
      const res = await authService.login(email, password);
      saveTokens(res.data.access_token, res.data.refresh_token);
      saveUserId(res.data.user_id);
      const role = res.data.role || null;
      saveUserRole(role);
      triggerAuthChange();
      navigate("/dashboard");
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } } | undefined;
      if (err?.response?.status === 401) {
        setErrors([t("login.errors.invalid")]);
      } else {
        setErrors([t("login.errors.generic", "Something went wrong")]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="from-primary/10 to-surface-muted flex min-h-dvh items-center justify-center bg-gradient-to-b px-4">
      <div className="flex flex-col items-center space-y-8 p-8">
        <img src={logoFull} alt="logo" className="h-16" />
        <h1 className="text-primary text-display font-bold">{t("login.title")}</h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {errors.length > 0 && (
            <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
              {errors.map((err) => (
                <p key={err} className="text-destructive text-body">
                  {err}
                </p>
              ))}
            </div>
          )}

          <Input
            label={t("login.email")}
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label={t("login.password")}
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} className="w-full">
            {t("login.submit")}
          </Button>

          <p className="text-center text-body">
            <Trans
              ns="auth"
              i18nKey="login.noAccount"
              components={{
                signupLink: (
                  <Link
                    className="text-primary hover:underline"
                    to="/signup"
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

export default Login;
