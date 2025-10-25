import React, {useState} from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link, useNavigate} from "react-router";
import {loginRequest} from "src/services/backend/authRequests.ts";
import {saveTokens, saveUserId} from "src/utils/auth.ts";

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<string[] | null>(null);
    const navigate = useNavigate();

    async function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        try {
            const res = await loginRequest(email, password)
            console.log(res)
            saveTokens(res.data.access_token, res.data.refresh_token);
            saveUserId(res.data.user.id)
            navigate("/dashboard")
        } catch (error: any) {
            if (error.response.status === 401) {
                setErrors(["Invalid email or password."]);
            }
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo"/>
                <h1>Log in your account</h1>
                <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
                    {errors && errors.map(err =>
                        <p key={err} className="text-error text-body">{err}</p>
                    )}
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
                    <button className="button-primary w-full" type="submit">Log In</button>
                    <p>Don't have an account? <Link className="text-secondary" to={"/signup"}>Sign up</Link></p>
                </form>
            </div>
        </div>
    );
}

export default Login;
