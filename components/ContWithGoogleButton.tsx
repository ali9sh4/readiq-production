'use client';


import { useAuth } from "@/context/authContext";
import { Button } from "./ui/button";
export default function ContWithGoogleButton() {
    const { handleGoogleSignIn, isLoading, error } = useAuth();     
    return (
        <div>
            <Button 
                onClick={handleGoogleSignIn}
                disabled={isLoading}
            >
                {isLoading ? 'Signing in...' : 'Continue with Google'}
            </Button>
            {error && (
                <p className="text-red-500 text-sm mt-2">
                    Error: {error}
                </p>
            )}
        </div>
    );
}