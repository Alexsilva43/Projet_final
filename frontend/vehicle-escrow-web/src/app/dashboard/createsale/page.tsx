"use client";

import Link from "next/link";
import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import {
    useWaitForTransactionReceipt,
    useWriteContract
} from "wagmi";
import {
    isAddress,
    parseUnits,
    type Address
} from "viem";

import {
    FACTORY_ADDRESS,
    FACTORY_ABI,
    EURC_DECIMALS
} from "../../../constants/contract";

const INTERMEDIARIES = [
    {
        name: "Garage des Alpes",
        location: "8 rue des Alpes, 38000 Grenoble",
        address: "0xB1485906A788eD6D78D9C2d87CE860Eda90f2761"
    },
    {
        name: "Centre Automobile Isère",
        location: "24 avenue Dr. Valois, 69000 Lyon",
        address: "0xAdAc33D91D49d4f5a72B91c539140C5819623387"
    }
] as const;

type SaleForm = {
    buyer: string;
    intermediary: string;
    vehiclePrice: string;
};

const INITIAL_FORM: SaleForm = {
    buyer: "",
    intermediary: "",
    vehiclePrice: ""
};

export default function CreateSalePage() {
    const router = useRouter();

    const {
        address,
        isConnected
    } = useAppKitAccount();

    const [form, setForm] = useState<SaleForm>(INITIAL_FORM);
    const [formError, setFormError] = useState("");

    const {
        data: transactionHash,
        error: writeError,
        isPending: isWalletPending,
        mutateAsync: writeContract
    } = useWriteContract();

    const {
        isLoading: isConfirming,
        isSuccess: isConfirmed
    } = useWaitForTransactionReceipt({
        hash: transactionHash
    });

    useEffect(() => {
        if (isConfirmed) {
            router.push("/dashboard");
            router.refresh();
        }
    }, [isConfirmed, router]);

    if (!isConnected || !address) {
        return null;
    }

    function updateField<Field extends keyof SaleForm>(
        field: Field,
        value: SaleForm[Field]
    ) {
        setForm((currentForm) => ({
            ...currentForm,
            [field]: value
        }));
    }

    async function handleSubmit(
        event: SyntheticEvent<HTMLFormElement>
    ) {
        event.preventDefault();
        setFormError("");

        if (!isAddress(form.buyer)) {
            setFormError(
                "L’adresse de l’acheteur est invalide."
            );

            return;
        }

        if (!isAddress(form.intermediary)) {
            setFormError(
                "Veuillez sélectionner un intermédiaire."
            );

            return;
        }

        const seller = address as Address;
        const buyer = form.buyer as Address;
        const intermediary = form.intermediary as Address;

        if (
            buyer.toLowerCase() === seller.toLowerCase()
        ) {
            setFormError(
                "Le vendeur et l’acheteur doivent être différents."
            );

            return;
        }

        if (
            intermediary.toLowerCase() ===
            seller.toLowerCase() ||
            intermediary.toLowerCase() ===
            buyer.toLowerCase()
        ) {
            setFormError(
                "L’intermédiaire doit avoir une adresse différente."
            );

            return;
        }

        try {
            const vehiclePrice = parseUnits(
                form.vehiclePrice,
                EURC_DECIMALS
            );

            if (vehiclePrice <= 0n) {
                setFormError(
                    "Le prix doit être supérieur à zéro."
                );

                return;
            }

            await writeContract({
                address: FACTORY_ADDRESS,
                abi: FACTORY_ABI,
                functionName: "createVehicleSale",
                args: [
                    buyer,
                    intermediary,
                    vehiclePrice
                ]
            });
        } catch {
            setFormError(
                "La transaction a été refusée ou n’a pas pu être envoyée."
            );
        }
    }

    const inputClass = `
        mt-2 w-full rounded-xl border border-[#303740]
        bg-[#090d11] px-4 py-3 text-white outline-none
        transition placeholder:text-[#556170]
        focus:border-[#ef4444]
    `;

    const displayedError =
        formError || writeError?.message;

    return (
        <main className="min-h-screen bg-[#080b0e] px-6 py-14 text-white">
            <div className="mx-auto w-full max-w-4xl">
                <Link
                    href="/dashboard"
                    className="text-sm text-[#9eabbc] transition hover:text-white"
                >
                    ← Retour au Dashboard
                </Link>

                <header className="mt-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ef4444]">
                        Nouvelle transaction
                    </p>

                    <h1 className="mt-3 text-4xl font-bold md:text-5xl">
                        Créer une vente
                    </h1>

                    <p className="mt-4 max-w-2xl text-[#9eabbc]">
                        Définissez les participants et le prix du
                        véhicule. Le paiement est exprimé en EURC.
                    </p>
                </header>

                <form
                    onSubmit={handleSubmit}
                    className="mt-10 space-y-8 rounded-2xl border border-[#2a3037] bg-[#11161b] p-6 md:p-8"
                >
                    <section>
                        <h2 className="text-xl font-bold">
                            Participants
                        </h2>

                        <div className="mt-5 grid gap-5 md:grid-cols-2">
                            <label className="text-sm font-medium">
                                Vendeur

                                <input
                                    value={address}
                                    disabled
                                    className={`${inputClass} cursor-not-allowed opacity-60`}
                                />
                            </label>

                            <label className="text-sm font-medium">
                                Acheteur

                                <input
                                    value={form.buyer}
                                    onChange={(event) =>
                                        updateField(
                                            "buyer",
                                            event.target.value
                                        )
                                    }
                                    placeholder="0x..."
                                    className={inputClass}
                                    required
                                />
                            </label>

                            <label className="text-sm font-medium md:col-span-2">
                                Intermédiaire de confiance

                                <select
                                    value={form.intermediary}
                                    onChange={(event) =>
                                        updateField(
                                            "intermediary",
                                            event.target.value
                                        )
                                    }
                                    className={inputClass}
                                    style={{
                                        color: form.intermediary ? "#ffffff" : "#556170"
                                    }}
                                    required
                                >
                                    <option
                                        value=""
                                        disabled
                                        hidden
                                    >
                                        Sélectionner un intermédiaire
                                    </option>

                                    {INTERMEDIARIES.map((intermediary) => (
                                        <option
                                            key={intermediary.address}
                                            value={intermediary.address}
                                            style={{ color: "#ffffff" }}
                                        >
                                            {intermediary.name} — {intermediary.location}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="border-t border-[#2a3037] pt-8">
                        <h2 className="text-xl font-bold">
                            Prix du véhicule
                        </h2>

                        <label className="mt-5 block text-sm font-medium">
                            Montant en EURC

                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.000001"
                                    value={form.vehiclePrice}
                                    onChange={(event) =>
                                        updateField(
                                            "vehiclePrice",
                                            event.target.value
                                        )
                                    }
                                    placeholder="20000.00"
                                    className={`${inputClass} pr-20`}
                                    required
                                />

                                <span className="pointer-events-none absolute right-4 top-1/2 translate-y-[-35%] text-sm text-[#9eabbc]">
                                    EURC
                                </span>
                            </div>
                        </label>
                    </section>

                    {displayedError && (
                        <p className="rounded-xl border border-[#7f252b] bg-[#2a171a] px-4 py-3 text-sm text-[#ff8b90]">
                            {displayedError}
                        </p>
                    )}

                    {transactionHash && (
                        <p className="break-all rounded-xl border border-[#304153] bg-[#111b25] px-4 py-3 text-sm text-[#a9c7e8]">
                            Transaction : {transactionHash}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={
                            isWalletPending ||
                            isConfirming
                        }
                        className="w-full rounded-xl bg-[#cf2f37] px-6 py-3.5 font-semibold transition hover:bg-[#e33a42] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isWalletPending
                            ? "Confirmez dans le wallet..."
                            : isConfirming
                                ? "Création en cours..."
                                : "Créer la vente"}
                    </button>
                </form>
            </div>
        </main>
    );
}