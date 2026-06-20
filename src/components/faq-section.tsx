"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
    {
        question: "Do I need special hardware or barcode scanners?",
        answer: "No! StockEasy is entirely cloud-based. You can run it on any standard laptop, PC, or tablet with an internet connection. We do not support barcode scanners at this time, but you can easily search and add inventory items using the intuitive interface."
    },
    {
        question: "Is my pharmacy and patient data secure?",
        answer: "Absolutely. We use enterprise-grade Supabase database encryption and strict Row Level Security (RLS). Your shop's financial data and inventory are completely isolated and inaccessible to anyone else."
    },
    {
        question: "What happens if my Free Starter plan reaches its limit?",
        answer: "The Starter plan is forever free, but limited to 5 catalog items and 2 dealers to let you test the workflow. Once you hit the limit, your data remains perfectly safe, but you won't be able to add new inventory lines until you upgrade to Growth or Pro."
    },
    {
        question: "Can I cancel or downgrade my subscription?",
        answer: "Yes. You can cancel your subscription directly from your Settings dashboard at any time. If you downgrade to the Free plan, you will lose access to the AI Assistant and Analytics, but your core inventory remains intact."
    }
];

export function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-24 bg-muted/20 border-t border-border relative transition-colors duration-300">
            <div className="max-w-4xl mx-auto px-6 md:px-16">
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-muted-foreground text-lg font-medium">Everything you need to know about the product and billing.</p>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className={`border border-border rounded-xl overflow-hidden transition-all duration-300 shadow-sm ${openIndex === index ? 'bg-card' : 'bg-background hover:bg-muted/50'}`}
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full flex items-center justify-between p-6 text-left focus:outline-none cursor-pointer"
                            >
                                <span className="font-bold text-foreground pr-8">{faq.question}</span>
                                <ChevronDown className={`w-5 h-5 text-primary transition-transform duration-300 shrink-0 ${openIndex === index ? 'rotate-180' : ''}`} />
                            </button>

                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <p className="p-6 pt-0 text-muted-foreground text-sm leading-relaxed border-t border-border/50 mt-2 font-medium">
                                    {faq.answer}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}