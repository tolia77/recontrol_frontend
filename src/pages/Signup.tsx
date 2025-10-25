import React, {useState} from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link, useNavigate} from "react-router";
import {registerRequest} from "src/services/backend/authRequests.ts";
import {saveTokens, saveUserId} from "src/utils/auth.ts";

function Signup() {
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
                setErrors(["Invalid input."]);
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
                    setErrors(msgs.length ? msgs : ["Sign up failed."]);
                } else {
                    setErrors(["Sign up failed."]);
                }
            } else {
                setErrors(["Sign up failed."]);
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo"/>
                <h1>Sign up your account</h1>
                <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
                    <div className="space-y-1">{errors && errors.map(err =>
                        <p key={err} className="text-error text-body-small">{err}</p>
                    )}</div>
                    <div>
                        <label className="text-body-small" htmlFor="username">Username:</label>
                        <br/>
                        <input className="w-full" type="text" id="username" name="username" value={username}
                               onChange={(e) => setUsername(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="email">Email:</label>
                        <br/>
                        <input className="w-full" type="email" id="email" name="email" value={email}
                               onChange={(e) => setEmail(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="password">Password:</label>
                        <br/>
                        <input className="w-full" type="password" id="password" name="password" value={password}
                               onChange={(e) => setPassword(e.target.value)} required/>
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="confirmPassword">Confirm Password:</label>
                        <br/>
                        <input className="w-full" type="password" id="confirmPassword" name="confirmPassword"
                               value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required/>
                    </div>
                    <button className="button-primary w-full" type="submit">Sign Up</button>
                    <p>Already have an account? <Link className="text-secondary" to={"/login"}>Log in</Link></p>
                </form>
            </div>
        </div>
    );
}

export default Signup;
