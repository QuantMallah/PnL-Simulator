"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { PnlChart } from "./pnl-chart";
import { Badge } from "@/components/ui/badge";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

type ChartData = {
  marketPrice: number;
  pnl: number;
};

const evaluateFormula = (
  formula: string,
  values: {
    entryPrice: number;
    marketPrice: number;
    leverage: number;
    margin: number;
  }
): number => {
  try {
    const { entryPrice, marketPrice, leverage, margin } = values;
    const formulaWithValues = formula
      .replace(/marketPrice/g, String(marketPrice))
      .replace(/entryPrice/g, String(entryPrice))
      .replace(/leverage/g, String(leverage))
      .replace(/margin/g, String(margin));

    const result = new Function(`return ${formulaWithValues}`)();
    return Number(result);
  } catch (error) {
    console.error("Error evaluating formula:", error);
    return 0;
  }
};


export function PnlCalculator() {
  const [entryPrice, setEntryPrice] = useState("41000");
  const [marketPrice, setMarketPrice] = useState("42500");
  const [leverage, setLeverage] = useState("10");
  const [margin, setMargin] = useState("1000");
  const [pnl, setPnl] = useState<number | null>(null);
  const [roi, setRoi] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [positionType, setPositionType] = useState<"long" | "short">("long");
  const [animationKey, setAnimationKey] = useState(0);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const [inputsFocused, setInputsFocused] = useState({
    entryPrice: false,
    marketPrice: false,
    leverage: false,
    margin: false,
  });

  const debouncedEntryPrice = useDebounce(entryPrice, 500);
  const debouncedMarketPrice = useDebounce(marketPrice, 500);
  const debouncedLeverage = useDebounce(leverage, 500);
  const debouncedMargin = useDebounce(margin, 500);

  const formula = useMemo(() => {
    const baseFormula = `* (leverage * margin / marketPrice)`;
    if (positionType === "long") {
      return `(marketPrice - entryPrice)` + baseFormula;
    } else {
      return `(entryPrice - marketPrice)` + baseFormula;
    }
  }, [positionType]);

  const totalSize = useMemo(() => {
    const lev = parseFloat(leverage);
    const mar = parseFloat(margin);
    if (isNaN(lev) || isNaN(mar)) return 0;
    return lev * mar;
  }, [leverage, margin]);

  const calculatePnl = useCallback(async () => {
    const ep = parseFloat(debouncedEntryPrice);
    const mp = parseFloat(debouncedMarketPrice);
    const lev = parseFloat(debouncedLeverage);
    const mar = parseFloat(debouncedMargin);

    if (
      isNaN(ep) ||
      isNaN(mp) ||
      isNaN(lev) ||
      isNaN(mar) ||
      mp <= 0 ||
      lev <= 0 ||
      mar <= 0 ||
      ep <= 0
    ) {
      setPnl(null);
      setRoi(null);
      setChartData([]);
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const newPnl = evaluateFormula(formula, {
          entryPrice: ep,
          marketPrice: mp,
          leverage: lev,
          margin: mar,
        });

        setPnl(newPnl);
        setRoi((newPnl / mar) * 100);
        setAnimationKey((prev) => prev + 1);

        const priceRange = mp - ep;
        const steps = 20;
        const step = priceRange / (steps - 1);

        const data: ChartData[] = Array.from({ length: steps }, (_, i) => {
          const currentMarketPrice = ep + (step * i);
          if (currentMarketPrice <= 0) return { marketPrice: 0, pnl: 0 };
          const pnlValue = evaluateFormula(formula, {
            entryPrice: ep,
            marketPrice: currentMarketPrice,
            leverage: lev,
            margin: mar,
          });
          return {
            marketPrice: parseFloat(currentMarketPrice.toFixed(2)),
            pnl: parseFloat(pnlValue.toFixed(2)),
          };
        });
        setChartData(data.filter(d => d.marketPrice > 0));

      } catch (error) {
        console.error("Error calculating PnL:", error);
        setPnl(null);
        setRoi(null);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    }, 100);

  }, [debouncedEntryPrice, debouncedMarketPrice, debouncedLeverage, debouncedMargin, formula]);

  useEffect(() => {
    calculatePnl();
  }, [calculatePnl]);

  const handleInputFocus = (inputName: keyof typeof inputsFocused) => {
    if (!inputsFocused[inputName]) {
      setInputsFocused(prev => ({ ...prev, [inputName]: true }));
      
      switch (inputName) {
        case 'entryPrice':
          setEntryPrice('');
          break;
        case 'marketPrice':
          setMarketPrice('');
          break;
        case 'leverage':
          setLeverage('');
          break;
        case 'margin':
          setMargin('');
          break;
      }
    }
  };

  const pnlColor =
    pnl === null ? "text-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const pnlPrefix = pnl !== null && pnl > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-2">
      <Card className="w-full">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0">
          <div className="space-y-1">
            <Label>Position</Label>
            <Tabs
              defaultValue="long"
              onValueChange={(value) => setPositionType(value as "long" | "short")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
                <TabsTrigger
                  value="long"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:bg-muted/40 data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-green-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400"
                >
                  Long
                </TabsTrigger>
                <TabsTrigger
                  value="short"
                  className="data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-muted/40 data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-red-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400"
                >
                  Short
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="entryPrice">Entry Price (USDT)</Label>
              <Input
                id="entryPrice"
                type="number"
                placeholder="e.g., 40000"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                onFocus={() => handleInputFocus('entryPrice')}
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marketPrice">Market Price (USDT)</Label>
              <Input
                id="marketPrice"
                type="number"
                placeholder="e.g., 42000"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                onFocus={() => handleInputFocus('marketPrice')}
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="leverage">Leverage (x)</Label>
              <Input
                id="leverage"
                type="number"
                placeholder="e.g., 10"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                onFocus={() => handleInputFocus('leverage')}
                min="0"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="margin">Margin (USDT)</Label>
              <Input
                id="margin"
                type="number"
                placeholder="e.g., 1000"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                onFocus={() => handleInputFocus('margin')}
                min="0"
              />
            </div>
          </div>
          <div className="pt-3">
            <div className="space-y-1 rounded-md border border-border/70 p-3 bg-muted/40">
             <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Size:</span>
                <span className="font-semibold">{totalSize.toLocaleString()} USDT</span>
             </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="p-4 pb-2">
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4 pt-0">
          <div className="flex flex-col items-center justify-center space-y-1 rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">PnL</p>
            {loading ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <p
                key={animationKey}
                className={`text-4xl font-bold ${pnlColor} transition-colors duration-300 animate-in fade-in`}
              >
                {pnl !== null ? `${pnlPrefix}${pnl.toFixed(2)}` : "-.--"}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {roi !== null ? `ROI: ${roi.toFixed(2)}%` : 'ROI: -.--%'}
            </p>
          </div>
          
          <div className="space-y-1 rounded-md border border-border/70 p-3">
            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Key values:</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1">
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">{entryPrice}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Market Price:</span>
                <span className="font-semibold">{marketPrice}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Margin:</span>
                <span className="font-semibold">{margin}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Leverage:</span>
                <span className="font-semibold">{leverage}x</span>
              </div>
            </div>
          </div>
          
          <div className="h-40">
            <PnlChart
              data={chartData}
              pnl={pnl}
              entryPrice={parseFloat(entryPrice)}
              marketPrice={parseFloat(marketPrice)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
