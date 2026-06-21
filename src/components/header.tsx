import Link from "next/link"
import Image from "next/image"
import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between px-4 md:px-16">

        {/* 1. LOGO */}
        <div className="flex justify-start shrink-0">
          <Link href="/" className="flex items-center group">
            {/* LIGHT MODE LOGO - Slightly scaled down for mobile, normal on md */}
            <Image
              src="/Receipt_logo.png"
              alt="StockEasy Logo"
              width={150}
              height={40}
              className="object-contain w-[120px] md:w-[150px] block dark:hidden transition-transform duration-300 group-hover:opacity-80"
              priority
            />

            {/* DARK MODE LOGO */}
            <Image
              src="/StockEasy_logo.png"
              alt="StockEasy Logo"
              width={150}
              height={40}
              className="object-contain w-[120px] md:w-[150px] hidden dark:block transition-transform duration-300 group-hover:opacity-80"
              priority
            />
          </Link>
        </div>

        {/* 2. NAVIGATION (Hidden on mobile and smaller tablets) */}
        <nav className="hidden lg:flex flex-1 justify-center gap-8 text-sm font-bold text-muted-foreground">
          {['Features', 'How it Works', 'Pricing', 'FAQ'].map((item) => (
            <Link
              key={item}
              href={`/#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="hover:text-foreground transition-colors"
            >
              {item}
            </Link>
          ))}
        </nav>

        {/* 3. AUTH BUTTONS & THEME TOGGLE */}
        <div className="flex justify-end items-center gap-3 md:gap-6 shrink-0">
          <ThemeToggle />

          {/* FIX: Removed 'hidden sm:block' so it shows on mobile */}
          <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            Login
          </Link>

          {/* Responsive padding so it doesn't break tiny phone screens */}
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 md:px-6 md:py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm whitespace-nowrap"
          >
            Register
          </Link>
        </div>

      </div>
    </header>
  )
}