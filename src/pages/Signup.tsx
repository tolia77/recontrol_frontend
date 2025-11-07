import React, {useState} from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link, useNavigate} from "react-router";
import {registerRequest} from "src/services/backend/authRequests.ts";
import {saveTokens, saveUserId} from "src/utils/auth.ts";
import { useTranslation, Trans } from 'react-i18next';

function Signup() {
    const { t } = useTranslation('auth');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<string[] | null>(null);
    const navigate = useNavigate();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        try {
            const res = await registerRequest(username, email, password);
            saveTokens(res.data.access_token, res.data.refresh_token);
            saveUserId(res.data.user_id)
            navigate("/dashboard")
        } catch (error: any) {
            if (error?.response?.status === 400) {
                setErrors([t('signup.errors.invalidInput')]);
            } else if (error?.response?.status === 422) {
                const resp = error?.response?.data;
                if (resp && typeof resp === 'object') {
                    const msgs: string[] = [];
                    Object.entries(resp).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        if (Array.isArray(value)) {
                            value.forEach(v => msgs.push(`${capitalizedKey} ${String(v)}`));
                        } else {
                            msgs.push(`${capitalizedKey} ${String(value)}`);
                        }
                    });
                    setErrors(msgs.length ? msgs : [t('signup.errors.failed')]);
                } else {
                    setErrors([t('signup.errors.failed')]);
                }
            } else {
                setErrors([t('signup.errors.failed')]);
            }
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo"/>
                <h1>{t('signup.title')}</h1>
                <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
                    <div className="space-y-1">{errors && errors.map(err =>
                        <p key={err} className="text-error text-body-small">{err}</p>
                    )}</div>
                    <div>
                        <label className="text-body-small" htmlFor="username">{t('signup.username')}:</label>
                        <br/>
                        <input className="w-full" type="text" id="username" name="username" value={username}
                               onChange={(e) => setUsername(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="email">{t('signup.email')}:</label>
                        <br/>
                        <input className="w-full" type="email" id="email" name="email" value={email}
                               onChange={(e) => setEmail(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="password">{t('signup.password')}:</label>
                        <br/>
                        <input className="w-full" type="password" id="password" name="password" value={password}
                               onChange={(e) => setPassword(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="confirmPassword">{t('signup.confirm')}:</label>
                        <br/>
                        <input className="w-full" type="password" id="confirmPassword" name="confirmPassword"
                               value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required/>
                    </div>
                    <button className="button-primary w-full" type="submit">{t('signup.submit')}</button>
                    <p><Trans ns="auth" i18nKey="signup.haveAccount" components={{ loginLink: <Link className="text-secondary" to="/login"/> }} /></p>
                </form>
            </div>
        </main>
    );
}

export default Signup;
