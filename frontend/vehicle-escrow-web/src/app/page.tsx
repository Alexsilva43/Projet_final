import Image from "next/image";
import Link from "next/link";
import ConnectButton from "./components/shared/ConnectButton";

const benefits = [
  {
    title: "Actifs protégés",
    description:
      "Les fonds et le NFT restent contrôlés par le smart contract.",
    icon: "/images/icons/payment-protected.svg",
    iconWidth: 64,
    iconHeight: 64,
  },
  {
    title: "Paiement stable",
    description:
      "La vente est réglée avec le stablecoin EURC.",
    icon: "/images/icons/stablecoin.svg",
    iconWidth: 80,
    iconHeight: 80,
  },
  {
    title: "Parcours transparent",
    description:
      "Suivez simplement chaque étape de la vente.",
    icon: "/images/icons/transparent-process.svg",
    iconWidth: 80,
    iconHeight: 48,
  },
  {
    title: "Validation de confiance",
    description:
      "Une transaction encadrée par un intermédiaire.",
    icon: "/images/icons/trusted-validation.svg",
    iconWidth: 64,
    iconHeight: 64,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080b0e] text-white">
      <main className="flex-col">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto min-h-[590px] max-w-7xl px-5 pb-12 pt-14 sm:px-8 lg:pt-16">
            <div className="relative z-10 max-w-3xl lg:w-[58%]">
              <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-gray-300">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />

                VENTE AUTOMOBILE SÉCURISÉE
              </div>

              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Sécurisez chaque étape de la vente de votre véhicule
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-400 sm:text-xl">
                Le smart contract protège les fonds pendant
                qu’un intermédiaire de confiance confirme le dépôt et la
                remise du véhicule.
              </p>

              <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center">
                {/*
                                    Ce bouton sera connecté à Reown AppKit.
                                */}
                <ConnectButton />

                <Link
                  href="/fonctionnement"
                  className="inline-flex items-center justify-center gap-3 px-3 py-4 font-medium text-gray-200 transition hover:text-[#ef4444]"
                >
                  Voir le fonctionnement

                  <span
                    aria-hidden="true"
                    className="text-xl text-[#ef4444]"
                  >
                    ›
                  </span>
                </Link>
              </div>
            </div>

            <div className="relative mt-8 h-[320px] sm:h-[400px] lg:absolute lg:right-0 lg:top-10 lg:mt-0 lg:h-[430px] lg:w-[60%]">
              <Image
                src="/images/vehicle-escrow.png"
                alt="Véhicule accompagné de son NFT et des stablecoins acceptés"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 65vw"
                className="object-contain object-right"
                style={{
                  WebkitMaskImage:
                    "radial-gradient(ellipse at center, black 50%, transparent 88%)",
                  maskImage:
                    "radial-gradient(ellipse at center, black 50%, transparent 88%)",
                }}
              />
            </div>
          </div>
        </section>

        <section className="w-full px-6 pb-12">
          <div className="flex w-full flex-wrap justify-center gap-5">
            {benefits.map((benefit) => (
              <article
                key={benefit.title}
                className="flex min-h-[240px] w-full max-w-[290px] flex-col items-center justify-center rounded-2xl border border-white/15 bg-[#11161b] p-6 text-center transition hover:-translate-y-1 hover:border-[#ef4444]/50 hover:bg-[#141a20]"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
                  <Image
                    src={benefit.icon}
                    alt=""
                    width={benefit.iconWidth}
                    height={benefit.iconHeight}
                    className="max-h-14 max-w-14"
                  />
                </div>

                <h2 className="mt-5 text-xl font-semibold text-white">
                  {benefit.title}
                </h2>

                <p className="mt-3 max-w-[230px] leading-6 text-gray-400">
                  {benefit.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}