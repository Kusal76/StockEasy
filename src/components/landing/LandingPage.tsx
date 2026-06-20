import { Header } from '@/components/header'
import { HeroSection } from '@/components/hero-section'
import { FeaturesSection } from '@/components/features-section' // <-- 1. Import it
import { HowItWorks } from '@/components/how-it-works'
import { PricingSection } from '@/components/pricing-section'
import { FAQSection } from '@/components/faq-section'
import { Footer } from '@/components/footer'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main>
                <HeroSection />

                {/* <-- 2. Add it here! --> */}
                <FeaturesSection />

                <HowItWorks />
                <PricingSection />
                <FAQSection />
            </main>
            <Footer />
        </div>
    )
}