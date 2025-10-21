import React, { useState } from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link} from "react-router";

function Signup() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        // Handle signup logic here
    }
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo" />
                <h1>Sign up your account</h1>
                <form onSubmit={handleSubmit} className="space-y-4 min-w-[350px]">
                    <div>
                        <label className="text-body-small" htmlFor="username">Username:</label>
                        <br/>
                        <input className="w-full" type="text" id="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="email">Email:</label>
                        <br/>
                        <input className="w-full" type="email" id="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="password">Password:</label>
                        <br/>
                        <input className="w-full" type="password" id="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="confirmPassword">Confirm Password:</label>
                        <br/>
                        <input className="w-full" type="password" id="confirmPassword" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                    </div>
                    <button className="button-primary w-full" type="submit">Sign Up</button>
                    <p>Already have an account? <Link className="text-secondary" to={"/login"}>Log in</Link></p>
                </form>
            </div>
        </div>
    );
}

export default Signup;

