"use client";

import { API_BASE_URL } from "@/lib/config";

interface GoogleSignInButtonProps {
  className?: string;
}

export function GoogleSignInButton({ className = "" }: GoogleSignInButtonProps) {
  const handleClick = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-3 rounded border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] active:bg-[#f8f8f8] ${className}`}
      type="button"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
        <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.2 7.3-10.5 7.3-17.3z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.2 1.5-5 2.3-8 2.3-6.2 0-11.4-4.2-13.3-9.8H2.6v6.2C6.5 42.6 14.7 48 24 48z" />
        <path fill="#FBBC05" d="M10.7 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7v-6.2H2.6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.9l8.1-6.2z" />
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.9 2.4 30.4 0 24 0 14.7 0 6.5 5.4 2.6 13.1l8.1 6.2C12.6 13.7 17.8 9.5 24 9.5z" />
      </svg>
      Sign in with Google
    </button>
  );
}
