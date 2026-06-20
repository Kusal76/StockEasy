import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 pt-32 pb-20">
                <h1 className="text-4xl font-bold text-foreground mb-6">Terms of Service</h1>
                <p className="text-muted-foreground mb-12">Last updated: June 2026</p>

                <div className="space-y-8 text-foreground/80 leading-relaxed max-w-4xl">
                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">1. Acceptance of Terms</h2>
                        <p>By accessing the StockEasy platform, you are agreeing to be bound by these terms of service, and all applicable laws and regulations regarding medical inventory tracking.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">2. Use License</h2>
                        <p>Permission is granted to utilize the StockEasy infrastructure strictly for internal pharmacy administrative operations. You may not modify or copy the software materials, or attempt to decompile or reverse engineer any software contained on the StockEasy platform.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">3. Disclaimer</h2>
                        <p>The materials on StockEasy's website are provided on an 'as is' basis. StockEasy makes no warranties, expressed or implied, and hereby disclaims all other warranties including, without limitation, implied warranties of merchantability regarding medicine stock levels.</p>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    )
}