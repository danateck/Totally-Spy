import { cn } from "@/lib/utils"

export interface LogoProps {    
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
      <h1 className={cn(
      'text-4xl py-2 font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600',
      className
    )}>
      TotallySpy
    </h1>
  )
}
