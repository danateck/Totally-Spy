import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

export interface LogoProps {
  className?: string
}

//logo details
export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Search size={28} className="text-green-500 mr-2" />   
      <h1 className="text-4xl font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600">
        TotallySpy
      </h1>
    </div>
  )
}
