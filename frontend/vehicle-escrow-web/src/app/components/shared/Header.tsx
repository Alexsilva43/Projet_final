"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import ConnectButton from "./ConnectButton";

export default function Header() {
    const pathname = usePathname();
    const { isConnected } = useAppKitAccount();

    function linkClass(href: string) {
        const isActive =
            href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

        return `
            relative py-7 transition hover:text-[#ef4444]
            ${isActive
                ? "text-[#ef4444] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-[#ef4444]"
                : "text-white"
            }
        `;
    }

    return (
        <header className="border-b border-[#22282e] bg-[#080b0e]">
            <div className="mx-auto flex min-h-24 max-w-6xl items-center justify-between gap-8 px-6">
                <Link
                    href="/"
                    className="flex shrink-0 items-center gap-3"
                >
                    <Image
                        src="/images/vehicle-escrow-logo.svg"
                        alt="Vehicle Escrow"
                        width={44}
                        height={54}
                        priority
                    />

                    <span className="text-xl font-bold text-white">
                        Vehicle Escrow
                    </span>
                </Link>

                <nav className="flex items-center gap-8 text-sm font-medium">
                    <Link href="/" className={linkClass("/")}>
                        Accueil
                    </Link>

                    {isConnected && (
                        <>
                            <Link
                                href="/dashboard"
                                className={linkClass("/dashboard")}
                            >
                                Tableau de bord
                            </Link>
                        </>
                    )}

                    <Link
                        href="/fonctionnement"
                        className={linkClass("/fonctionnement")}
                    >
                        Fonctionnement
                    </Link>

                    <Link
                        href="/about"
                        className={linkClass("/about")}
                    >
                        À propos
                    </Link>

                    <Link
                        href="/contact"
                        className={linkClass("/contact")}
                    >
                        Contact
                    </Link>
                </nav>

                <div className="shrink-0">
                    <ConnectButton />
                </div>
            </div>
        </header>
    );
}