import React, {useState} from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link, useNavigate} from "react-router";
import {loginRequest} from "src/services/backend/authRequests.ts";
import {saveTokens, saveUserId, saveUserRole} from "src/utils/auth.ts";
import { useTranslation, Trans } from 'react-i18next';

function Login() {
    const { t } = useTranslation('auth');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<string[] | null>(null);
    const navigate = useNavigate();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        try {
            const res = await loginRequest(email, password)
            saveTokens(res.data.access_token, res.data.refresh_token);
            saveUserId(res.data.user_id)
            // attempt to find role field from response shape
            const role = res.data.role || null;
            saveUserRole(role);
            navigate("/dashboard")
        } catch (error: unknown) {
            const err = error as { response?: { status?: number } } | undefined;
            if (err?.response?.status === 401) {
                setErrors([t('login.errors.invalid')]);
            }
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo"/>
                <h1>{t('login.title')}</h1>
                <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
                    {errors && errors.map(err =>
                        <p key={err} className="text-error text-body">{err}</p>
                    )}
                    <div>
                        <label className="text-body-small" htmlFor="email">{t('login.email')}:</label>
                        <br/>
                        <input className="w-full" type="email" id="email" name="email" value={email}
                               onChange={(e) => setEmail(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="password">{t('login.password')}:</label>
                        <br/>
                        <input className="w-full" type="password" id="password" name="password" value={password}
                               onChange={(e) => setPassword(e.target.value)} required/>
                    </div>
                    <button className="button-primary w-full" type="submit">{t('login.submit')}</button>
                    <p><Trans ns="auth" i18nKey="login.noAccount" components={{ signupLink: <Link className="text-secondary" to="/signup"/> }} /></p>
                </form>
            </div>
        </main>
    );
}

export default Login;
