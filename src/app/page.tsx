import { PnlCalculator } from "@/components/pnl-calculator";

export default function Home() {
  return (
    <div className="min-h-screen bg-background p-2 md:p-4 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="my-4 md:my-8 text-center">
          <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold tracking-tight text-foreground">
            Trade PnL Simulator
          </h1>
          <p className="mt-2 md:mt-4 text-sm md:text-lg text-muted-foreground">
            Accurate step-by-step PnL using calculation formula.
          </p>
        </div>
        
        <PnlCalculator />
      </div>
    </div>
  );
}
