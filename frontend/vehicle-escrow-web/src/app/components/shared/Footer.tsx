import Image from "next/image";
import Link from "next/link";

export default function Footer() {
    return (
        <footer className="border-t border-white/10 bg-[#080b0e]">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
                <Link
                    href="/"
                    aria-label="Accueil Vehicle Escrow"
                    className="flex items-center gap-3"
                >
                    <Image
                        src="/images/vehicle-escrow-logo.svg"
                        alt=""
                        width={48}
                        height={54}
                    />

                    <div>
                        <p className="text-xl font-semibold text-white">
                            Vehicle Escrow
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                            Escrow automobile sur Ethereum
                        </p>
                    </div>
                </Link>

                <nav
                    aria-label="Navigation secondaire"
                    className="flex flex-wrap gap-7 text-sm text-gray-400"
                >
                    <Link
                        href="/about"
                        className="transition hover:text-white"
                    >
                        À propos
                    </Link>

                    <Link
                        href="/contact"
                        className="transition hover:text-white"
                    >
                        Contact
                    </Link>

                    <a
                        href="https://github.com/Alexsilva43/Projet_final"
                        target="_blank"
                        rel="noreferrer"
                        className="transition hover:text-white"
                    >
                        GitHub
                    </a>
                </nav>
            </div>
        </footer>
    );
}