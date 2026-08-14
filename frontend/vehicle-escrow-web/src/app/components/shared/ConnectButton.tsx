"use client";

import Image from "next/image";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    useAppKit,
    useAppKitAccount
} from "@reown/appkit/react";

export default function ConnectButton() {
    const { open } = useAppKit();
    const { address, isConnected } = useAppKitAccount();

    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!isConnected && pathname.startsWith("/dashboard")) {
            router.replace("/");
        }
    }, [isConnected, pathname, router]);

    const shortenedAddress = address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : "";

    return (
        <button
            type="button"
            onClick={() => open()}
            className={`
                flex items-center gap-2 rounded-xl border px-6 py-3
                font-semibold text-white transition
                ${
                    isConnected
                        ? "border-[#ef4444] bg-[#171c21] hover:bg-[#2a171a]"
                        : "border-transparent bg-[#cf2f37] hover:bg-[#e33a42]"
                }
            `}
        >
            <Image
                src="/images/icons/wallet.svg"
                alt=""
                width={20}
                height={20}
            />

            {isConnected ? (
                <span>{shortenedAddress}</span>
            ) : (
                <>
                    <span className="hidden sm:inline">
                        Connecter le wallet
                    </span>

                    <span className="sm:hidden">
                        Connecter
                    </span>
                </>
            )}
        </button>
    );
}