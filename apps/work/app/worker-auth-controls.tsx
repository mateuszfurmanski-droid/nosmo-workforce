"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function WorkerAuthControls() {
  return (
    <div className="worker-auth-controls" aria-label="Account">
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/">
          <button type="button" className="worker-auth-sign-in">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl="/">
          <button type="button" className="worker-auth-sign-up">
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <span>Account</span>
        <UserButton />
      </Show>
    </div>
  );
}
