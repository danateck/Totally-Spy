import { Link } from '@tanstack/react-router'

interface Portfolio {
  id: number
  name: string
  role: string
}

interface PortfolioListProps {
  portfolios: Portfolio[]
  onCreate: () => void
}

export function PortfolioList({ portfolios, onCreate }: PortfolioListProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-primary">Portfolios</h2>
        <button
          className="px-4 py-2 bg-green-600 text-black rounded-lg font-semibold hover:bg-green-700 transition-colors"
          onClick={onCreate}
        >
          + Create Portfolio
        </button>
      </div>
      <div className="space-y-4">
        {portfolios.map((portfolio) => (
          <Link
            key={portfolio.id}
            to="/portfolio/$id"
            params={{ id: String(portfolio.id) }}
            className="block w-full p-4 bg-card rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 border border-border hover:border-accent flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div>
                <span className="text-lg font-medium text-green-400 focus:outline-none">
                  {portfolio.name}
                </span>
                <p className="text-sm text-muted-foreground">
                  Role: {portfolio.role}
                </p>
              </div>
            </div>
            <span className="text-2xl text-muted-foreground">&gt;</span>
          </Link>
        ))}
      </div>
    </div>
  )
} 