"use client";

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

const plans = [
  {
    name: 'Starter',
    price: 'Free',
    numericPrice: 0,
    period: '',
    features: [
      'Single User (No Staff)',
      'Max 5 Catalog Medicines',
      'Max 2 Dealers/Suppliers',
      'Basic Billing & Inventory',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Growth',
    price: 'Rs 599',
    numericPrice: 599,
    period: '/mo',
    features: [
      'Up to 5 Staff Accounts',
      'Max 50 Catalog Medicines',
      'Max 10 Dealers/Suppliers',
      'Advanced FEFO Alerts',
    ],
    cta: 'Select Growth',
    highlighted: true,
  },
  {
    name: 'Pro',
    price: 'Rs 1499',
    numericPrice: 1499,
    period: '/mo',
    features: [
      'Unlimited Staff, SKUs & Dealers',
      'StockEasy AI Assistant Access',
      'Full Enterprise Analytics',
      '24/7 Priority Support',
    ],
    cta: 'Select Pro',
    highlighted: false,
  },
];

export function PricingSection({ shopId }: { shopId?: string }) {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCheckout = async (plan: typeof plans[0]) => {
    // If not logged in, redirect to registration with the selected plan
    if (!shopId) {
      router.push(`/register?plan=${plan.name.toLowerCase()}`);
      return;
    }

    // If logged in and they select the Free plan, just take them to the dashboard
    if (plan.numericPrice === 0) {
      router.push('/dashboard');
      return;
    }

    setLoadingPlan(plan.name);

    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.name, amount: plan.numericPrice }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to initiate order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mock",
        amount: data.amount,
        currency: "INR",
        name: "StockEasy Technologies",
        description: `${plan.name} Subscription Plan`,
        order_id: data.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                shop_id: shopId,
                new_plan: plan.name,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              alert(`Welcome to StockEasy ${plan.name}! Plan activated.`);
              window.location.reload();
            } else {
              alert(verifyData.error || "Payment verification failed.");
            }
          } catch (err) {
            console.error("Verification error:", err);
            alert("An error occurred while confirming your payment.");
          }
        },
        prefill: { name: "Pharmacy Owner" },
        theme: { color: "#10b981" }, // Using the emerald green
      };

      // Since we built the custom Sandbox Simulator in settings, we trigger that custom event here too!
      // This allows the landing page to use the exact same beautiful simulated payment flow if they are logged in.
      const event = new CustomEvent("open-razorpay-simulation", { detail: options });
      window.dispatchEvent(event);

      // Fallback for native razorpay if the simulation listener isn't mounted on the landing page
      if (!(window as any).Razorpay && !document.querySelector('.fixed.inset-0.z-\\[100\\]')) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }

    } catch (error: any) {
      console.error("Subscription Error:", error);
      alert(error.message || "Could not process subscription checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="relative py-16 sm:py-24 md:py-32 w-full overflow-hidden bg-background transition-colors duration-300">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 md:px-16">

        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-20 animate-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-foreground mb-3 sm:mb-6 tracking-tight px-2">
            Transparent Pricing
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-lg leading-relaxed font-medium px-4">
            Investment models engineered for pharmacies of all scales.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto items-center">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 sm:p-8 flex flex-col bg-card transition-all duration-300 animate-in fade-in zoom-in-95 fill-mode-both ${plan.highlighted
                ? 'border-2 border-primary shadow-xl md:-translate-y-4 z-10'
                : 'border border-border shadow-sm hover:shadow-md'
                }`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {/* Popular Badge */}
              {plan.highlighted && (
                <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2">
                  <span className="px-3 sm:px-4 py-1 bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-widest shadow-sm whitespace-nowrap">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <p className={`text-xs sm:text-sm font-bold tracking-widest uppercase mb-3 sm:mb-4 ${plan.highlighted ? 'text-primary' : 'text-muted-foreground'}`}>
                {plan.name}
              </p>

              {/* Price */}
              <div className="mb-6 sm:mb-8 flex items-baseline">
                <span className="text-4xl sm:text-5xl font-extrabold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-sm sm:text-base text-muted-foreground font-medium ml-1.5">{plan.period}</span>}
              </div>

              {/* Features */}
              <ul className="space-y-4 sm:space-y-5 mb-8 sm:mb-10 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 ${plan.highlighted ? 'text-primary' : 'text-primary/70'}`} />
                    <span className="text-xs sm:text-sm text-muted-foreground font-medium">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <button
                onClick={() => handleCheckout(plan)}
                disabled={loadingPlan === plan.name}
                className={`w-full py-3.5 sm:py-4 rounded-xl text-sm sm:text-base font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${plan.highlighted
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-background border border-border text-foreground hover:bg-muted'
                  } disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
              >
                {loadingPlan === plan.name ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> Processing...
                  </>
                ) : (
                  plan.cta
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}