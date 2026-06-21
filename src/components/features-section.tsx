"use client";

import { ShoppingCart, ShieldAlert, Sparkles, Users, Building2, LineChart } from "lucide-react";

const features = [
    {
        icon: ShoppingCart,
        title: "Lightning Fast POS",
        description: "Process sales in seconds with our optimized point-of-sale interface. Inventory is deducted live the moment a bill is generated."
    },
    {
        icon: ShieldAlert,
        title: "Smart FEFO Tracking",
        description: "Never lose money to expired medicines again. StockEasy automatically flags near-expiry and dead stock based on the First-Expire-First-Out method."
    },
    {
        icon: Sparkles,
        title: "StockEasy AI Assistant",
        description: "Chat directly with your database. Ask your AI manager about top sellers, low stock, or peak traffic hours and get instant insights."
    },
    {
        icon: LineChart,
        title: "Enterprise Analytics",
        description: "Visualize your pharmacy's health with deep charts covering gross profit margins, sales trends, and forecasted expiry losses."
    },
    {
        icon: Building2,
        title: "Supplier Management",
        description: "Maintain a complete directory of your dealers. Track exact supplied values versus expired stock values for easy return negotiations."
    },
    {
        icon: Users,
        title: "Role-Based Access",
        description: "Secure your financial data. Provision staff accounts with restricted access while you maintain complete owner-level control."
    }
];

export function FeaturesSection() {
    return (
        // The id="features" here connects to your Header!
        <section id="features" className="py-16 sm:py-24 bg-muted/30 border-t border-border relative overflow-hidden transition-colors duration-300">

            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-16 relative z-10">

                {/* Section Header - FIX: Adjusted typography scaling for mobile */}
                <div className="text-center mb-10 sm:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-3 sm:mb-4 tracking-tight px-2">
                        Everything You Need to Scale
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-lg font-medium px-4">
                        Purpose-built tools designed to eliminate manual data entry, reduce waste, and increase your profit margins.
                    </p>
                </div>

                {/* Features Grid - FIX: Adjusted card padding for mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="bg-card border border-border p-6 sm:p-8 rounded-xl shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-300 group hover:-translate-y-1 animate-in fade-in zoom-in-95 fill-mode-both"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors duration-300 shadow-sm">
                                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3">{feature.title}</h3>
                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-medium">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}