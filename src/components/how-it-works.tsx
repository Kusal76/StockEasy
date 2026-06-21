"use client";

import { Store, PackagePlus, Receipt, TrendingUp } from 'lucide-react';

const steps = [
    {
        icon: Store,
        title: "1. Setup Your Pharmacy",
        description: "Register your account, enter your GST and Drug License details, and customize your shop profile in minutes."
    },
    {
        icon: PackagePlus,
        title: "2. Digitize Inventory",
        description: "Add your suppliers and log inward stock. We automatically track batch numbers and exact expiry dates."
    },
    {
        icon: Receipt,
        title: "3. Fast POS Billing",
        description: "Generate bills in seconds. Stock is deducted live, and margins are calculated instantly with zero manual math."
    },
    {
        icon: TrendingUp,
        title: "4. Scale with AI",
        description: "Let the Pro AI Assistant notify you about expiring stock, identify top-selling medicines, and predict future demand."
    }
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-16 sm:py-24 bg-background relative overflow-hidden transition-colors duration-300">

            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-16 relative z-10">
                <div className="text-center mb-12 sm:mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-3 sm:mb-4 tracking-tight px-2">
                        How to Use StockEasy
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-lg font-medium px-4">
                        From registration to automated enterprise analytics in four simple steps.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-10 sm:gap-8 relative">
                    {/* Connecting Line for Desktop */}
                    <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-[1px] bg-border z-0 transition-colors" />

                    {/* FIX: Vertical Connecting Line for Mobile Timeline Effect */}
                    <div className="md:hidden absolute top-[10%] bottom-[10%] left-1/2 -translate-x-1/2 w-[1px] bg-border z-0 transition-colors" />

                    {steps.map((step, index) => (
                        <div
                            key={index}
                            className="relative z-10 flex flex-col items-center text-center animate-in fade-in zoom-in-95 fill-mode-both"
                            style={{ animationDelay: `${index * 200}ms` }}
                        >
                            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-card border border-border rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-300 group cursor-default relative z-10">
                                <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-primary group-hover:scale-110 transition-transform duration-300" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3 bg-background/80 px-2 rounded-md">{step.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed px-4 sm:px-2 font-medium bg-background/80 rounded-md">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}