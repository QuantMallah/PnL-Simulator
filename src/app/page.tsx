import { PnlCalculator } from "@/components/pnl-calculator";

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Trade PnL Simulator
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Accurate step-by-step PnL using calculation formula.
          </p>
        </div>
        
        <PnlCalculator />
      </div>
    </div>
  );
}
