import Image from "next/image";
import Link from "next/link";

const participants = [
    {
        shortName: "V",
        title: "Vendeur",
        description:
            "Dépose le NFT, confie le véhicule à l’intermédiaire et transmet le code de cession.",
    },
    {
        shortName: "A",
        title: "Acheteur",
        description:
            "Dépose le prix en stablecoin, vérifie le code de cession et confirme la vente.",
    },
    {
        shortName: "I",
        title: "Intermédiaire",
        description:
            "Confirme les étapes physiques et remet le véhicule à la personne désignée.",
    },
];

const steps = [
    {
        title: "Création de la vente",
        description:
            "Les participants, le prix, les frais et le stablecoin accepté sont définis.",
    },
    {
        title: "Dépôt du prix",
        description:
            "L’acheteur transfère le prix et les frais prévus vers le smart contract.",
    },
    {
        title: "Dépôt du NFT",
        description:
            "Le vendeur dépose le NFT associé à la vente et les frais requis.",
    },
    {
        title: "Dépôt physique",
        description:
            "Le vendeur confie le véhicule à l’intermédiaire, qui confirme sa réception.",
    },
    {
        title: "Code de cession",
        description:
            "Le vendeur transmet le code de cession chiffré dans le smart contract.",
    },
    {
        title: "Confirmation",
        description:
            "L’acheteur accepte le code ou déclenche la procédure de vérification.",
    },
    {
        title: "Règlement",
        description:
            "Le vendeur reçoit le prix et le NFT est transféré à l’acheteur.",
    },
    {
        title: "Remise du véhicule",
        description:
            "L’intermédiaire remet le véhicule, puis le NFT est détruit et la vente est clôturée.",
    },
];

const disputeResults = [
    {
        title: "Code original valide",
        description: "La vente peut continuer avec le code initial.",
    },
    {
        title: "Code corrigé valide",
        description: "Le code est remplacé et la vente peut continuer.",
    },
    {
        title: "Aucun code valide",
        description: "La vente est annulée et les actifs sont distribués selon les règles prévues.",
    },
];

function StepCard({
    step,
    number,
}: {
    step: {
        title: string;
        description: string;
    };
    number: number;
}) {
    return (
        <article className="relative z-10 rounded-2xl border border-white/10 bg-[#11161b] p-6 transition hover:-translate-y-1 hover:border-[#ef4444]/50">
            <div className="flex items-start gap-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ef4444] font-bold text-white">
                    {number}
                </span>

                <div>
                    <h3 className="text-xl font-semibold">
                        {step.title}
                    </h3>

                    <p className="mt-2 leading-7 text-gray-400">
                        {step.description}
                    </p>
                </div>
            </div>
        </article>
    );
}

function VerticalArrow() {
    return (
        <div className="flex h-12 justify-center">
            <svg
                aria-hidden="true"
                viewBox="0 0 24 48"
                className="h-12 w-6"
                fill="none"
            >
                <path
                    d="M12 0v36"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeOpacity="0.7"
                />
                <path
                    d="M6 34 L12 42 L18 34 Z"
                    fill="#ef4444"
                    fillOpacity="0.7"
                />
            </svg>
        </div>
    );
}

export default function FonctionnementPage() {
    return (
        <div className="min-h-screen bg-[#080b0e] text-white">
            <main>
                <section className="relative overflow-hidden border-b border-white/10">
                    <div className="mx-auto grid min-h-[560px] max-w-7xl items-center gap-0 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr]">
                        <div className="relative z-20">
                            <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-gray-300">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                                UN PARCOURS ENCADRÉ
                            </span>

                            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                                Comment fonctionne Vehicle Escrow&nbsp;?
                            </h1>

                            <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-400">
                                Découvrez comment le smart contract coordonne le paiement, le NFT et les étapes physiques d’une vente automobile.
                            </p>

                            <Link
                                href="#etapes"
                                className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#c52b32] px-7 py-4 font-semibold transition hover:bg-[#df343c]"
                            >
                                Découvrir les étapes
                                <span aria-hidden="true">↓</span>
                            </Link>
                        </div>

                        <div className="relative h-[320px] sm:h-[420px] lg:-ml-20 lg:w-[calc(100%+5rem)]">
                            <Image
                                src="/images/vehicle-escrow-participants.png"
                                alt="Vendeur, acheteur et intermédiaire autour d’un contrat d’escrow automobile"
                                fill
                                priority
                                sizes="(max-width: 1024px) 100vw, 55vw"
                                className="vehicle-float object-contain"
                                style={{
                                    WebkitMaskImage:
                                        "linear-gradient(to right, transparent 0%, black 22%, black 82%, transparent 100%)",
                                    maskImage:
                                        "linear-gradient(to right, transparent 0%, black 22%, black 82%, transparent 100%)",
                                }}
                            />

                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-gradient-to-b from-transparent via-[#080b0e]/60 to-[#080b0e]"
                            />
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                            Les participants
                        </p>
                        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                            Trois rôles, une transaction
                        </h2>
                    </div>

                    <div className="mt-12 grid gap-6 md:grid-cols-3">
                        {participants.map((participant) => (
                            <article
                                key={participant.title}
                                className="rounded-2xl border border-white/15 bg-[#11161b] p-7 text-center transition hover:-translate-y-1 hover:border-[#ef4444]/50"
                            >
                                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#ef4444]/50 bg-[#ef4444]/10 text-xl font-bold text-[#ef4444]">
                                    {participant.shortName}
                                </div>
                                <h3 className="mt-5 text-xl font-semibold">
                                    {participant.title}
                                </h3>
                                <p className="mt-3 leading-7 text-gray-400">
                                    {participant.description}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section id="etapes" className="scroll-mt-24 border-y border-white/10 bg-[#0c1116]">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="text-center">
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                Vente réussie
                            </p>
                            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                                Les huit étapes de la vente
                            </h2>
                        </div>

                        <div className="relative mt-16 py-14">
                            <div className="relative z-10 grid grid-cols-2 gap-32">
                                <div className="flex flex-col">
                                    {steps.slice(0, 4).map((step, index) => (
                                        <div key={step.title}>
                                            <StepCard
                                                step={step}
                                                number={index + 1}
                                            />

                                            {index < 3 && (
                                                <VerticalArrow />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col">
                                    {steps.slice(4, 8).map((step, index) => (
                                        <div key={step.title}>
                                            <StepCard
                                                step={step}
                                                number={index + 5}
                                            />

                                            {index < 3 && (
                                                <VerticalArrow />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <svg
                                aria-hidden="true"
                                viewBox="0 0 1000 1000"
                                preserveAspectRatio="none"
                                className="pointer-events-none absolute inset-x-0 top-14 z-20 h-[calc(100%_-_7rem)] w-full overflow-visible"
                            >
                                <defs>
                                    <marker
                                        id="workflow-arrow"
                                        markerUnits="strokeWidth"
                                        markerWidth="6"
                                        markerHeight="4"
                                        refX="12"
                                        refY="4"
                                        orient="auto"
                                        viewBox="0 0 12 8"
                                    >
                                        <path
                                            d="M0 0 L12 4 L0 8 Z"
                                            fill="#ef4444"
                                            fillOpacity="0.7"
                                        />
                                    </marker>
                                </defs>

                                <path
                                    d="M 219 1000 L 219 1060 Q 219 1100 259 1100 L 460 1100 Q 500 1100 500 1060 L 500 -60 Q 500 -100 540 -100 L 781 -100 L 781 0"
                                    fill="none"
                                    stroke="#ef4444"
                                    strokeWidth="2"
                                    opacity="0.7"
                                    vectorEffect="non-scaling-stroke"
                                    markerEnd="url(#workflow-arrow)"
                                />
                            </svg>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20">
                    <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                En cas de désaccord
                            </p>
                            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                                Une procédure de vérification
                            </h2>
                            <p className="mt-5 leading-8 text-gray-400">
                                Si l’acheteur rejette le code, le vendeur peut demander sa vérification. L’intermédiaire de confiance indique ensuite si la vente peut continuer ou doit être annulée.
                            </p>
                        </div>

                        <div className="grid gap-5">
                            {disputeResults.map((result, index) => (
                                <article
                                    key={result.title}
                                    className="flex gap-5 rounded-2xl border border-white/15 bg-[#11161b] p-6"
                                >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/10 font-bold text-[#ef4444]">
                                        {index + 1}
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            {result.title}
                                        </h3>
                                        <p className="mt-2 text-gray-400">
                                            {result.description}
                                        </p>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-y border-white/10 bg-[#0c1116]">
                    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-20 md:grid-cols-2">
                        <article className="rounded-2xl border border-white/15 bg-[#11161b] p-8">
                            <Image
                                src="/images/icons/payment-protected.svg"
                                alt=""
                                width={64}
                                height={64}
                            />
                            <h2 className="mt-6 text-2xl font-bold">
                                Le rôle du NFT
                            </h2>
                            <p className="mt-4 leading-7 text-gray-400">
                                Le NFT aide le smart contract à suivre la destination du véhicule pendant la transaction. Il ne constitue ni un titre de propriété, ni un certificat d’immatriculation, ni une preuve légale de propriété.
                            </p>
                        </article>

                        <article className="rounded-2xl border border-white/15 bg-[#11161b] p-8">
                            <Image
                                src="/images/icons/stablecoin.svg"
                                alt=""
                                width={72}
                                height={64}
                            />
                            <h2 className="mt-6 text-2xl font-bold">
                                Paiement en stablecoin
                            </h2>
                            <p className="mt-4 leading-7 text-gray-400">
                                Le stablecoin utilisé est sélectionné lors de la création de la vente parmi les tokens autorisés par l’application, notamment les options indexées sur l’euro ou le dollar.
                            </p>
                        </article>
                    </div>
                </section>

                <section className="px-6 py-20 text-center">
                    <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-[#11161b] px-6 py-12">
                        <h2 className="text-3xl font-bold">
                            Prêt à sécuriser une vente&nbsp;?
                        </h2>
                        <p className="mx-auto mt-4 max-w-xl leading-7 text-gray-400">
                            Connectez votre wallet pour consulter vos ventes ou en créer une nouvelle.
                        </p>
                        <button
                            type="button"
                            className="mt-8 inline-flex items-center gap-3 rounded-xl bg-[#c52b32] px-7 py-4 font-semibold transition hover:bg-[#df343c]"
                        >
                            <Image
                                src="/images/icons/wallet.svg"
                                alt=""
                                width={24}
                                height={24}
                            />
                            Connecter le wallet
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}
