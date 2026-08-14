const CONTACT_EMAIL = "alexsilva.ufc@gmail.com";
const GITHUB_URL = "https://github.com/Alexsilva43";

export default function ContactPage() {
    return (
        <div className="flex min-h-screen flex-col bg-[#080b0e] text-white">
            <main className="flex-1">
                <section className="relative overflow-hidden border-b border-white/10">
                    <div className="pointer-events-none absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#ef4444]/10 blur-[140px]" />

                    <div className="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-28">
                        <span className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-gray-300">
                            <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                            CONTACT
                        </span>

                        <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                            Parlons de Vehicle Escrow
                        </h1>

                        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-400">
                            Une question sur le projet, une suggestion ou une proposition de collaboration&nbsp;? Retrouvez mes coordonnées ci-dessous.
                        </p>
                    </div>
                </section>

                <section className="mx-auto max-w-5xl px-6 py-20">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#ef4444]">
                            Coordonnées
                        </p>

                        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                            Restons en contact
                        </h2>

                        <p className="mx-auto mt-5 max-w-2xl leading-8 text-gray-400">
                            Vous pouvez m’écrire directement par e-mail ou consulter mes projets sur GitHub.
                        </p>
                    </div>

                    <div className="mt-12 grid gap-6 md:grid-cols-2">
                        <a
                            href={`mailto:${CONTACT_EMAIL}`}
                            className="group rounded-3xl border border-white/15 bg-[#11161b] p-8 transition hover:-translate-y-1 hover:border-[#ef4444]/50"
                        >
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef4444]/10 text-xl font-bold text-[#ef4444]">
                                @
                            </span>

                            <h3 className="mt-7 text-2xl font-bold">
                                E-mail
                            </h3>

                            <p className="mt-3 leading-7 text-gray-400">
                                Pour toute question, suggestion ou proposition concernant le projet.
                            </p>

                            <span className="mt-6 block break-all font-medium text-[#ef4444] transition group-hover:text-[#ff6269]">
                                {CONTACT_EMAIL}
                            </span>
                        </a>

                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="group rounded-3xl border border-white/15 bg-[#11161b] p-8 transition hover:-translate-y-1 hover:border-[#ef4444]/50"
                        >
                            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ef4444]/10 text-sm font-bold text-[#ef4444]">
                                GH
                            </span>

                            <h3 className="mt-7 text-2xl font-bold">
                                GitHub
                            </h3>

                            <p className="mt-3 leading-7 text-gray-400">
                                Retrouvez le code source de mes projets et suivez leur évolution.
                            </p>

                            <span className="mt-6 block font-medium text-[#ef4444] transition group-hover:text-[#ff6269]">
                                github.com/Alexsilva43
                            </span>
                        </a>
                    </div>

                    <aside className="mt-8 rounded-2xl border border-white/15 border-l-4 border-l-[#ef4444] bg-[#11161b] p-6">
                        <h3 className="font-semibold">
                            Rappel de sécurité
                        </h3>

                        <p className="mt-2 leading-7 text-gray-400">
                            Ne transmettez jamais votre phrase de récupération, votre clé privée ou toute autre information permettant d’accéder à votre wallet.
                        </p>
                    </aside>
                </section>
            </main>
        </div>
    );
}
