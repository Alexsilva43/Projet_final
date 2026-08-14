import Image from "next/image";
import Link from "next/link";

const principles = [
    {
        number: "01",
        title: "Des actifs protégés",
        description:
            "Le prix de vente et le NFT restent sous le contrôle du smart contract jusqu’à la validation des conditions prévues.",
    },
    {
        number: "02",
        title: "Un véhicule supervisé",
        description:
            "L’intermédiaire de confiance confirme la réception physique du véhicule puis sa remise à la personne désignée.",
    },
    {
        number: "03",
        title: "Un parcours traçable",
        description:
            "Chaque validation importante est enregistrée par le contrat et fait progresser la vente vers son état suivant.",
    },
];

const technologies = [
    {
        name: "Solidity",
        description: "Logique des smart contracts",
    },
    {
        name: "Ethereum",
        description: "Exécution décentralisée",
    },
    {
        name: "Next.js",
        description: "Interface web",
    },
    {
        name: "Wagmi & Viem",
        description: "Interactions blockchain",
    },
    {
        name: "Reown AppKit",
        description: "Connexion des wallets",
    },
    {
        name: "Hardhat",
        description: "Développement et tests",
    },
];

export default function AProposPage() {
    return (
        <div className="min-h-screen bg-[#080b0e] text-white">
            <main>
                <section className="relative overflow-hidden border-b border-white/10">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#ef4444]/10 blur-[140px]" />

                    <div className="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-28">
                        <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-gray-300">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                            À PROPOS DU PROJET
                        </span>

                        <h1 className="mx-auto mt-8 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                            Encadrer une vente automobile avec un smart contract
                        </h1>

                        <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-gray-400">
                            Vehicle Escrow est une application décentralisée qui coordonne une vente entre un vendeur et un acheteur avec l’intervention d’un intermédiaire de confiance.
                        </p>

                        <div className="mt-9 flex flex-wrap justify-center gap-4">
                            <Link
                                href="/fonctionnement"
                                className="rounded-xl bg-[#c52b32] px-7 py-4 font-semibold transition hover:bg-[#df343c]"
                            >
                                Voir le fonctionnement
                            </Link>

                            <a
                                href="https://github.com/Alexsilva43/Projet_final"
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-white/15 bg-white/[0.03] px-7 py-4 font-semibold transition hover:border-white/30 hover:bg-white/[0.06]"
                            >
                                Voir le code GitHub
                            </a>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20">
                    <div className="grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                L’origine du projet
                            </p>

                            <h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                                Pourquoi Vehicle Escrow&nbsp;?
                            </h2>
                        </div>

                        <div className="space-y-5 text-lg leading-8 text-gray-400">
                            <p>
                                Une vente automobile ne se résume pas à un paiement. Le transfert des fonds, le dépôt du véhicule, la transmission du code de cession et la remise des clés se produisent à des moments différents.
                            </p>

                            <p>
                                Vehicle Escrow cherche à réduire le risque qu’une partie remplisse ses obligations alors que l’autre ne respecte pas les siennes. Le smart contract applique un parcours commun et ne libère les actifs que lorsque les conditions attendues sont validées.
                            </p>
                        </div>
                    </div>

                    <div className="mt-14 grid gap-6 md:grid-cols-3">
                        {principles.map((principle) => (
                            <article
                                key={principle.number}
                                className="rounded-2xl border border-white/15 bg-[#11161b] p-7 transition hover:-translate-y-1 hover:border-[#ef4444]/50"
                            >
                                <span className="text-sm font-bold tracking-[0.2em] text-[#ef4444]">
                                    {principle.number}
                                </span>
                                <h3 className="mt-5 text-xl font-semibold">
                                    {principle.title}
                                </h3>
                                <p className="mt-3 leading-7 text-gray-400">
                                    {principle.description}
                                </p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="border-y border-white/10 bg-[#0c1116]">
                    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-20 lg:grid-cols-2">
                        <article className="rounded-3xl border border-white/15 bg-[#11161b] p-8 sm:p-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10">
                                <Image
                                    src="/images/icons/trusted-validation.svg"
                                    alt=""
                                    width={42}
                                    height={42}
                                />
                            </div>

                            <h2 className="mt-7 text-3xl font-bold">
                                L’intermédiaire de confiance
                            </h2>

                            <p className="mt-5 leading-8 text-gray-400">
                                Il relie le parcours numérique aux étapes physiques. Il confirme la réception du véhicule, sa remise et, lorsque cela est nécessaire, intervient dans la vérification du code de cession.
                            </p>

                            <p className="mt-4 leading-8 text-gray-400">
                                Il ne reçoit ni le prix de vente ni le NFT&nbsp;: ces actifs restent contrôlés séparément par le smart contract.
                            </p>
                        </article>

                        <article className="rounded-3xl border border-white/15 bg-[#11161b] p-8 sm:p-10">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10 text-2xl font-bold text-[#ef4444]">
                                NFT
                            </div>

                            <h2 className="mt-7 text-3xl font-bold">
                                Un outil technique, pas un titre de propriété
                            </h2>

                            <p className="mt-5 leading-8 text-gray-400">
                                Le NFT aide le contrat et l’intermédiaire à suivre la destination du véhicule pendant la transaction.
                            </p>

                            <p className="mt-4 leading-8 text-gray-400">
                                Il ne représente pas juridiquement le véhicule et ne remplace ni le certificat d’immatriculation, ni un titre de propriété, ni les démarches administratives obligatoires.
                            </p>
                        </article>
                    </div>
                </section>

                <section className="border-b border-white/10 bg-[#080b0e]">
                    <div className="mx-auto max-w-7xl px-6 py-20">
                        <div className="mx-auto max-w-3xl text-center">
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                Frais de l&apos;application
                            </p>

                            <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                                Des frais fixes et transparents
                            </h2>

                            <p className="mt-5 leading-7 text-gray-400">
                                Ces frais sont définis par le smart contract et sont identiques
                                pour toutes les ventes.
                            </p>
                        </div>

                        <div className="mt-12 grid gap-5 md:grid-cols-3">
                            <article className="rounded-2xl border border-white/15 bg-[#11161b] p-7">
                                <p className="text-sm text-gray-400">
                                    Dépôt du véhicule
                                </p>

                                <p className="mt-4 text-3xl font-bold">
                                    20 <span className="text-base font-medium text-gray-400">EURC</span>
                                </p>

                                <p className="mt-4 leading-7 text-gray-400">
                                    Frais liés à la prise en charge physique du véhicule par
                                    l&apos;intermédiaire.
                                </p>
                            </article>

                            <article className="rounded-2xl border border-white/15 bg-[#11161b] p-7">
                                <p className="text-sm text-gray-400">
                                    Remise du véhicule
                                </p>

                                <p className="mt-4 text-3xl font-bold">
                                    10 <span className="text-base font-medium text-gray-400">EURC</span>
                                </p>

                                <p className="mt-4 leading-7 text-gray-400">
                                    Frais liés à la remise physique du véhicule à
                                    l&apos;acheteur.
                                </p>
                            </article>

                            <article className="rounded-2xl border border-white/15 bg-[#11161b] p-7">
                                <p className="text-sm text-gray-400">
                                    Annulation
                                </p>

                                <p className="mt-4 text-3xl font-bold">
                                    50 <span className="text-base font-medium text-gray-400">EURC</span>
                                </p>

                                <p className="mt-4 leading-7 text-gray-400">
                                    Frais prévus en cas d&apos;annulation de la vente.
                                </p>
                            </article>
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-6 py-20">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                            Sous le capot
                        </p>
                        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                            Technologies utilisées
                        </h2>
                        <p className="mt-5 leading-7 text-gray-400">
                            Une architecture web moderne connectée à des smart contracts testés et déployés sur Ethereum.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {technologies.map((technology) => (
                            <article
                                key={technology.name}
                                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#11161b] p-5"
                            >
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ef4444]/10 font-bold text-[#ef4444]">
                                    {technology.name.charAt(0)}
                                </span>
                                <div>
                                    <h3 className="font-semibold">
                                        {technology.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-400">
                                        {technology.description}
                                    </p>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="border-y border-white/10 bg-[#0c1116]">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="rounded-3xl border border-white/15 border-l-4 border-l-[#ef4444] bg-[#11161b] p-8 sm:p-10">
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                                Limites du prototype
                            </p>

                            <h2 className="mt-4 text-3xl font-bold">
                                Une démonstration technique
                            </h2>

                            <div className="mt-6 space-y-4 leading-8 text-gray-400">
                                <p>
                                    Vehicle Escrow est actuellement un projet expérimental destiné à un réseau de test. Il ne constitue pas un service juridique, financier ou administratif.
                                </p>
                                <p>
                                    Le NFT n’a aucune valeur légale et l’application ne remplace pas les démarches officielles nécessaires à la cession d’un véhicule. Une utilisation réelle nécessiterait également des audits de sécurité et une étude réglementaire complète.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="px-6 py-20 text-center">
                    <div className="mx-auto max-w-3xl">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                            Projet final Alyra
                        </p>
                        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                            Conçu et développé par Alex Silva
                        </h2>
                        <p className="mx-auto mt-5 max-w-2xl leading-8 text-gray-400">
                            Ce projet explore la manière dont un smart contract peut coordonner une transaction mêlant des actifs numériques et la remise physique d’un bien.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}
