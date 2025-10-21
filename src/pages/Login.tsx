import React from 'react';
import logoFull from 'src/assets/img/logo-full.svg';
import {Link} from "react-router";

function Login() {
    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        // Handle login logic here
    }
    return (
        <div className={"mx-auto"}>
            <img src={logoFull} alt="logo" />
            <h1>Log in</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label className="text-body" htmlFor="email">Email:</label>
                    <br/>
                    <input type="email" id="email" name="email" required />
                </div>
                <div>
                    <label className="text-body" htmlFor="password">Password:</label>
                    <br/>
                    <input type="password" id="password" name="password" required />
                </div>
                <button className="button-primary" type="submit">Log In</button>
                <p>Don't have an account? <Link to={"/signup"}>Sign up</Link></p>
            </form>
        </div>
    );
}

export default Login;
