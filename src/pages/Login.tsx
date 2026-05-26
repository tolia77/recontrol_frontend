import { useState } from "react";
import logoFull from "src/assets/img/logo-full.svg";
import { Link, useNavigate } from "react-router";
import { loginRequest } from "src/services/backend/authService";
import { saveTokens, saveUserId, saveUserRole } from "src/utils/auth";
import { useTranslation, Trans } from "react-i18next";
import { Button } from "src/components/ui/Button";
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
      const res = await loginRequest(email, password);
      saveTokens(res.data.access_token, res.data.refresh_token);
      saveUserId(res.data.user_id);
      const role = res.data.role || null;
      saveUserRole(role);
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
    <main className="from-tertiary/30 to-background flex min-h-screen items-center justify-center bg-gradient-to-b">
      <div className="flex flex-col items-center space-y-8 p-8">
        <img src={logoFull} alt="logo" className="h-16" />
        <h1 className="text-primary text-3xl font-bold">{t("login.title")}</h1>

        <form onSubmit={handleSubmit} className="min-w-[350px] space-y-4">
          {errors.length > 0 && (
            <div className="bg-error/10 border-error/20 rounded-lg border p-3">
              {errors.map((err) => (
                <p key={err} className="text-error text-sm">
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

          <p className="text-center text-sm">
            <Trans
              ns="auth"
              i18nKey="login.noAccount"
              components={{
                signupLink: (
                  <Link
                    className="text-secondary hover:underline"
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
