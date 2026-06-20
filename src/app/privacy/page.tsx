import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 md:px-16 pt-32 pb-20">
                <h1 className="text-4xl font-bold text-foreground mb-6">Privacy Policy</h1>
                <p className="text-muted-foreground mb-12">Last updated: June 2026</p>

                <div className="space-y-8 text-foreground/80 leading-relaxed max-w-4xl">
                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">1. Information We Collect</h2>
                        <p>We only ask for personal information (such as your name, pharmacy details, drug license, and email) when we truly need it to provide a secure inventory management service to you. We collect it by fair and lawful means, with your knowledge and consent.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">2. Use of Information</h2>
                        <p>The data we store centrally is utilized strictly to verify clinical supply chain integrity, monitor FEFO (First Expire, First Out) metrics, and prevent the distribution of expired medicines.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-primary mb-4">3. Data Security</h2>
                        <p>We don’t share any personally identifying information or clinical inventory data publicly or with third-parties, except when required by law or central health administration authorities.</p>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    )
}