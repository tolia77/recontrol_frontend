import React from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link} from "react-router";

function Login() {
    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        // Handle login logic here
    }
    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center space-y-8">
                <img src={logoFull} alt="logo" />
                <h1>Log in your account</h1>
                <form onSubmit={handleSubmit} className="space-y-6 min-w-[350px]">
                    <div>
                        <label className="text-body-small" htmlFor="email">Email:</label>
                        <br/>
                        <input className="w-full" type="email" id="email" name="email" required />
                    </div>
                    <div>
                        <label className="text-body-small" htmlFor="password">Password:</label>
                        <br/>
                        <input className="w-full" type="password" id="password" name="password" required />
                    </div>
                    <button className="button-primary w-full" type="submit">Log In</button>
                    <p>Don't have an account? <Link className="text-secondary" to={"/signup"}>Sign up</Link></p>
                </form>
            </div>
        </div>
    );
}

export default Login;
