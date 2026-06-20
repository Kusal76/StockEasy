"use client";

import { useState, useEffect } from 'react';
import { CheckCircle, BarChart3, TrendingUp, ShieldAlert, ArrowRight, Play, X } from 'lucide-react';

export function HeroSection() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Your Supabase Video URL
  const DEMO_VIDEO_URL = "https://ubyvmkwfxfjappfbdutu.supabase.co/storage/v1/object/public/public_assets/StockEasy%20_%20Modern%20Pharmacy%20Management%20_%20demo.mp4";

  // Prevent scrolling on the main page when the video modal is open
  useEffect(() => {
    if (isVideoModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isVideoModalOpen]);

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-background transition-colors duration-300">
      {/* Subtle enterprise grid background instead of massive neon glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="relative max-w-[1280px] mx-auto px-4 md:px-6 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* Left Content */}
          <div className="space-y-8 animate-in slide-in-from-left-8 duration-700">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/20 bg-primary/10 rounded-full text-xs font-bold text-primary uppercase tracking-widest shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Status: Optimized
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground">
              Stop losing money on <br />
              <span className="text-destructive">
                expired
              </span> medicine.
            </h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed font-medium">
              Precision medical inventory management driven by FEFO (First Expire, First Out) logic. Leverage AI insights to eliminate waste and maximize pharmacy profitability.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4 pt-4">
              <a
                href="/register"
                className="group flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                Register Your Shop
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="group flex items-center gap-2 px-8 py-4 bg-card border border-border text-foreground rounded-xl font-bold hover:bg-muted transition-all shadow-sm cursor-pointer"
              >
                <Play className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                View Demo
              </button>
            </div>
          </div>

          {/* Right Content - Enterprise Dashboard Preview */}
          <div className="relative animate-in slide-in-from-right-8 duration-700 delay-150 fill-mode-both hidden lg:block">

            {/* Floating Expiry Alert - Top Left (Untilted, structural) */}
            <div className="absolute -top-6 -left-6 z-20 bg-card border border-border shadow-xl rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Batch: Z180-F</p>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-warning" />
                <p className="text-warning font-bold text-sm">Expires 10 Days</p>
              </div>
            </div>

            {/* Floating Batch Status - Bottom Right (Untilted, structural) */}
            <div className="absolute -bottom-6 -right-6 z-20 bg-card border border-border shadow-xl rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Batch: X982-A</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <p className="text-emerald-500 font-bold text-sm">Healthy Status</p>
              </div>
            </div>

            {/* Main Dashboard UI Mockup */}
            <div className="bg-card border border-border rounded-2xl p-2 relative z-10 shadow-2xl">
              <div className="aspect-[4/3] bg-background rounded-xl overflow-hidden relative flex flex-col border border-border">
                {/* Browser-style Header */}
                <div className="bg-muted/30 border-b border-border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-2 w-16 bg-muted-foreground/20 rounded-full" />
                    <div className="h-2 w-8 bg-primary/40 rounded-full" />
                  </div>
                </div>

                {/* Mockup Body */}
                <div className="p-6 flex-1 flex flex-col gap-6">
                  <div className="grid grid-cols-3 gap-4">
                    {[CheckCircle, BarChart3, TrendingUp].map((Icon, i) => (
                      <div key={i} className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
                        <Icon className="w-5 h-5 text-primary mb-3" />
                        <div className="space-y-2">
                          <div className="h-2 w-full bg-muted rounded" />
                          <div className="h-3 w-2/3 bg-primary/40 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex-1 flex items-end justify-between gap-2">
                    {[40, 65, 45, 80, 55, 70, 60, 75, 50, 85, 65, 70].map((height, i) => (
                      <div
                        key={i}
                        className="w-full bg-primary/20 rounded-t-sm transition-all hover:bg-primary relative group cursor-pointer"
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-bold py-1 px-2 rounded">
                          {height}k
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Cinematic Video Modal Overlay */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-300">
          {/* Click outside background to close */}
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsVideoModalOpen(false)} />

          <div className="relative w-full max-w-5xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 z-10">

            {/* Close Button */}
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="p-2 bg-background/80 hover:bg-destructive text-foreground hover:text-white rounded-full backdrop-blur-sm transition-all cursor-pointer border border-border"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video Player connected to Supabase */}
            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <video
                controls
                autoPlay
                className="w-full h-full object-cover"
              >
                <source src={DEMO_VIDEO_URL} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-border bg-muted/20 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                <Play className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1">StockEasy Platform Walkthrough</h3>
                <p className="text-muted-foreground text-sm font-medium">A complete overview of clinical inventory management, FEFO tracking, and intelligent POS.</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </section>
  )
}