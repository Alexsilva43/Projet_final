"use client";

import Link from "next/link";
import { useAppKitAccount } from "@reown/appkit/react";
import { type Address } from "viem";

import { useDashboardSales } from "../hooks/useDashboardSales";

function shortenAddress(address?: string) {
    if (!address) {
        return "";
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getSaleIndicator(state: number) {
    if (state === 7) {
        return {
            color: "bg-green-500",
            title: "Vente terminée"
        };
    }

    if (state === 8) {
        return {
            color: "bg-red-500",
            title: "Vente annulée"
        };
    }

    return {
        color: "bg-gray-500",
        title: "Vente en cours"
    };
}

const roleLabels = {
    seller: "Vendeur",
    buyer: "Acheteur",
    intermediary: "Intermédiaire"
};

const stateLabels = [
    "Créée",
    "Financée",
    "NFT déposé",
    "Actifs déposés",
    "Prête",
    "Code soumis",
    "Vente confirmée",
    "Terminée",
    "Annulée",
    "Litige"
];

export default function DashboardPage() {
    const { address, isConnected } = useAppKitAccount();

    const fromBlock = 45431124n;

    const { sales, loading, error } = useDashboardSales(
        address as Address | undefined,
        fromBlock
    );

    if (!isConnected) {
        return null;
    }

    const totalSales = sales.length;

    const completedSales = sales.filter(
        (sale) => sale.state === 7
    ).length;

    const inProgressSales = sales.filter(
        (sale) =>
            sale.state !== 7 &&
            sale.state !== 8
    ).length;

    const cancelledSales = sales.filter(
        (sale) => sale.state === 8
    ).length;

    return (
        <main className="min-h-screen bg-[#080b0e] px-6 py-14 text-white">
            <div className="mx-auto w-full max-w-6xl">

                {/* En-tête */}
                <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#ef4444]">
                            Espace personnel
                        </p>

                        <h1 className="text-4xl font-bold md:text-5xl">
                            Tableau de bord
                        </h1>

                        <p className="mt-4 text-[#9eabbc]">
                            Retrouvez toutes les ventes auxquelles votre adresse participe.
                        </p>

                        <p className="mt-2 font-mono text-sm text-[#d7dde5]">
                            {shortenAddress(address)}
                        </p>
                    </div>

                    <Link
                        href="/dashboard/createsale"
                        className="inline-flex w-fit items-center justify-center rounded-xl bg-[#cf2f37] px-6 py-3 font-semibold transition hover:bg-[#e33a42]"
                    >
                        + Créer une vente
                    </Link>
                </section>

                {/* Statistiques */}
                <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        ["Toutes les ventes", totalSales],
                        ["En cours", inProgressSales],
                        ["Terminées", completedSales],
                        ["Annulées", cancelledSales]
                    ].map(([label, value]) => (
                        <article
                            key={label}
                            className="rounded-2xl border border-[#2a3037] bg-[#11161b] p-6"
                        >
                            <p className="text-sm text-[#9eabbc]">
                                {label}
                            </p>

                            <p className="mt-2 text-3xl font-bold">
                                {value}
                            </p>
                        </article>
                    ))}
                </section>

                {/* Liste des ventes */}
                <section className="mt-8 rounded-2xl border border-[#2a3037] bg-[#11161b]">

                    <div className="border-b border-[#2a3037] px-6 py-5">
                        <h2 className="text-xl font-bold">
                            Mes ventes
                        </h2>

                        <p className="mt-1 text-sm text-[#9eabbc]">
                            Vendeur, acheteur ou intermédiaire
                        </p>
                    </div>

                    {/* Chargement initial */}
                    {loading && sales.length === 0 && (
                        <div className="flex min-h-72 items-center justify-center px-6 py-12">
                            <p className="text-[#9eabbc]">
                                Chargement des ventes...
                            </p>
                        </div>
                    )}

                    {/* Erreur sans cache */}
                    {!loading && error && sales.length === 0 && (
                        <div className="flex min-h-72 items-center justify-center px-6 py-12">
                            <p className="text-[#ff6268]">
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Aucune vente */}
                    {!loading &&
                        !error &&
                        sales.length === 0 && (
                            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#343b44] bg-[#171c21] text-2xl">
                                    ↔
                                </div>

                                <h3 className="mt-5 text-xl font-bold">
                                    Aucune vente trouvée
                                </h3>

                                <p className="mt-2 max-w-md text-[#9eabbc]">
                                    Cette adresse ne participe encore à aucun escrow. Vous pouvez créer une nouvelle vente pour commencer.
                                </p>

                                <Link
                                    href="/dashboard/createsale"
                                    className="mt-6 rounded-xl border border-[#ef4444] px-5 py-2.5 font-semibold text-[#ff6268] transition hover:bg-[#2a171a]"
                                >
                                    Créer ma première vente
                                </Link>
                            </div>
                        )}

                    {/* Ventes */}
                    {sales.length > 0 && (
                        <div className="divide-y divide-[#2a3037]">
                            {sales.map((sale) => {
                                const indicator = getSaleIndicator(sale.state);

                                return (
                                    <Link
                                        key={sale.escrow}
                                        href={`/dashboard/escrow/${sale.vehicleTokenId.toString()}`}
                                        onClick={() => {
                                            sessionStorage.setItem(
                                                `escrow-${sale.vehicleTokenId.toString()}`,
                                                sale.escrow
                                            );
                                        }}
                                        className="group flex flex-col gap-4 px-6 py-5 transition hover:bg-[#171c21] md:flex-row md:items-center md:justify-between"
                                    >
                                        <div className="flex items-start gap-4">
                                            <span
                                                title={indicator.title}
                                                className={`mt-2 h-3 w-3 shrink-0 rounded-full ${indicator.color}`}
                                            />

                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-lg font-semibold">
                                                        Vente #{sale.vehicleTokenId.toString()}
                                                    </h3>

                                                    <span className="rounded-lg border border-[#343b44] bg-[#171c21] px-2.5 py-1 text-xs text-[#d7dde5]">
                                                        {roleLabels[sale.role]}
                                                    </span>
                                                </div>

                                                <p className="mt-2 font-mono text-sm text-[#9eabbc]">
                                                    Escrow {shortenAddress(sale.escrow)}
                                                </p>

                                                <p className="mt-1 text-xs text-[#7f8b99]">
                                                    Créée le{" "}
                                                    {sale.createdAt.toLocaleString(
                                                        "fr-FR",
                                                        {
                                                            day: "2-digit",
                                                            month: "long",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit"
                                                        }
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div>
                                                <p className="text-xs uppercase tracking-wide text-[#7f8b99]">
                                                    Statut
                                                </p>

                                                <p className="mt-1 font-semibold text-[#d7dde5]">
                                                    {stateLabels[sale.state] ?? "Inconnu"}
                                                </p>
                                            </div>

                                            <span className="text-2xl text-[#7f8b99] transition group-hover:translate-x-1 group-hover:text-white">
                                                →
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                </section>

            </div>
        </main>
    );
}