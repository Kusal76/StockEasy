import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-8 sm:py-6 mt-auto relative overflow-hidden transition-colors duration-300">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row md:px-16 md:gap-0">

        {/* 1. LOGO */}
        <div className="flex w-full justify-center md:w-1/3 md:justify-start">
          <Link href="/" className="group flex items-center">
            {/* LIGHT MODE LOGO */}
            <Image
              src="/Receipt_logo.png"
              alt="StockEasy Logo"
              width={120}
              height={28}
              className="object-contain block dark:hidden opacity-80 group-hover:opacity-100 transition-opacity sm:w-[140px]"
            />
            {/* DARK MODE LOGO */}
            <Image
              src="/StockEasy_logo.png"
              alt="StockEasy Logo"
              width={120}
              height={28}
              className="object-contain hidden dark:block opacity-80 group-hover:opacity-100 transition-opacity sm:w-[140px]"
            />
          </Link>
        </div>

        {/* 2. COPYRIGHT */}
        <div className="flex w-full justify-center text-center text-[10px] sm:text-xs text-muted-foreground md:w-1/3 font-medium">
          © {new Date().getFullYear()} StockEasy Technologies. <br className="md:hidden" /> All rights reserved.
        </div>

        {/* 3. LINKS */}
        <div className="flex w-full justify-center gap-6 sm:gap-8 text-[10px] sm:text-xs text-muted-foreground md:w-1/3 md:justify-end font-bold uppercase sm:capitalize tracking-wider sm:tracking-normal">
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
        </div>

      </div>
    </footer>
  )
}