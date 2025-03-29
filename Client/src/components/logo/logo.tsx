import { cn } from "@/lib/utils"

export interface LogoProps {    
  className?: string
}

export function Logo({ className }: LogoProps) {
  return (
      <h1 className={cn(
      'text-4xl py-2 font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500',
      className
    )}>
      TotallySpy
    </h1>
  )
}
