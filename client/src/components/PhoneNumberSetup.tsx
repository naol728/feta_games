import { useState } from "react";
import { Button } from "@/components/ui/button";
import { me } from "@/api/auth";

interface TelegramWebApp {
    requestContact: (
        callback: (shared: boolean) => void
    ) => void;
}

interface TelegramWindow {
    Telegram?: {
        WebApp?: TelegramWebApp;
    };
}

interface User {
    phone: string | null;
}

interface MeResponse {
    user?: User;
}

interface PhoneNumberSetupProps {
    onComplete: (phone: string) => void;
}

export default function PhoneNumberSetup({
    onComplete,
}: PhoneNumberSetupProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const waitForPhone = async (): Promise<string> => {
        const maxAttempts = 15;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`Checking phone... attempt ${attempt} `);

                const response = await me();
                const data = response as MeResponse;

                const phone = data.user?.phone ?? null;

                if (phone) {
                    console.log("✅ Phone found:", phone);
                    return phone;
                }

                // Wait 1 second before trying again
                await new Promise<void>((resolve) =>
                    setTimeout(resolve, 1000)
                );
            } catch (err) {
                console.error("Phone check failed:", err);

                // Don't immediately fail.
                // The backend may still be processing the Telegram update.
                await new Promise<void>((resolve) =>
                    setTimeout(resolve, 1000)
                );
            }
        }

        throw new Error(
            "We are still processing your phone number. Please close and reopen the app."
        );
    };

    const requestPhone = (): void => {
        setError(null);

        const telegramWindow =
            window as unknown as TelegramWindow;

        const webApp = telegramWindow.Telegram?.WebApp;

        if (!webApp) {
            setError(
                "Please open this application inside Telegram."
            );
            return;
        }

        setLoading(true);

        webApp.requestContact(
            async (shared: boolean): Promise<void> => {
                if (!shared) {
                    setLoading(false);

                    setError(
                        "You must share your phone number to continue."
                    );

                    return;
                }

                try {
                    console.log(
                        "📱 Phone shared by Telegram. Waiting for backend..."
                    );

                    const phone = await waitForPhone();

                    console.log("✅ Phone successfully processed:", phone);

                    onComplete(phone);
                } catch (error: unknown) {
                    console.error(
                        "❌ Phone processing error:",
                        error
                    );

                    setError(
                        error instanceof Error
                            ? error.message
                            : "Failed to process phone number."
                    );
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <div className="w-full max-w-md">
                <h1 className="text-2xl font-bold">
                    Phone Number Required
                </h1>

                <p className="mt-2 text-muted-foreground">
                    Share your Telegram phone number to continue.
                </p>

                {error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <Button
                    className="mt-6 w-full"
                    onClick={requestPhone}
                    disabled={loading}
                >
                    {loading
                        ? "Processing phone number..."
                        : "Share Phone Number"}
                </Button>
            </div>
        </div>
    );
}

