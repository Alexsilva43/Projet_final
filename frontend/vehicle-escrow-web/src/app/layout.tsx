import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { type ReactNode } from 'react'
import { cookieToInitialState } from 'wagmi'


import ContextProvider from './providers'
import  Footer  from './components/shared/Footer'
import  Header  from './components/shared/Header';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: "Vehicle Escrow",
    description:
        "Sécurisez chaque étape de la vente de votre véhicule.",
};

export default async function RootLayout(props: { children: ReactNode }) {

  const headersObj = await headers()
  const cookies = headersObj.get('cookie')
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body className={inter.className}>
        <ContextProvider cookies={cookies}>
          <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <Header />

            <main className="flex-1">
              {props.children}
            </main>

            <Footer />
          </div>
        </ContextProvider>
      </body>
    </html>
  )
}
