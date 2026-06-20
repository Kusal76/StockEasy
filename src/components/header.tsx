import Link from "next/link"
import Image from "next/image"
import { ThemeToggle } from "./theme-toggle" // <-- Imported your toggle component

export function Header() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-20 w-full max-w-[1600px] items-center justify-between px-6 md:px-16">

        {/* 1. LOGO */}
        <div className="flex w-1/3 justify-start">
          <Link href="/" className="flex items-center group">
            {/* LIGHT MODE LOGO - Increased Size */}
            <Image
              src="/Receipt_logo.png"
              alt="StockEasy Logo"
              width={150} // 
              height={40} // 
              className="object-contain block dark:hidden transition-transform duration-300 group-hover:opacity-80"
              priority
            />

            {/* DARK MODE LOGO - Original Size */}
            <Image
              src="/StockEasy_logo.png"
              alt="StockEasy Logo"
              width={150}
              height={40}
              className="object-contain hidden dark:block transition-transform duration-300 group-hover:opacity-80"
              priority
            />
          </Link>
        </div>

        {/* 2. NAVIGATION */}
        <nav className="hidden w-1/3 justify-center md:flex gap-8 text-sm font-bold text-muted-foreground">
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
        <div className="flex w-1/3 justify-end items-center gap-4 md:gap-6">
          {/* THEME TOGGLE ADDED HERE */}
          <ThemeToggle />

          <Link href="/login" className="hidden sm:block text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
          >
            Register
          </Link>
        </div>

      </div>
    </header>
  )
}