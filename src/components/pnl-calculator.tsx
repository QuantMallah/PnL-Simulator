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
  isEntry?: boolean;
  isMarket?: boolean;
};

const evaluateFormula = (
  formula: string,
  values: {
    entryPrice: number;
    marketPrice: number;
    quantity: number;
  }
): number => {
  try {
    const { entryPrice, marketPrice, quantity } = values;
    const formulaWithValues = formula
      .replace(/marketPrice/g, String(marketPrice))
      .replace(/entryPrice/g, String(entryPrice))
      .replace(/quantity/g, String(quantity));

    const result = new Function(`return ${formulaWithValues}`)();
    return Number(result);
  } catch (error) {
    console.error("Error evaluating formula:", error);
    return 0;
  }
};

export function PnlCalculator() {
  const [entryPrice, setEntryPrice] = useState("0.011");
  const [marketPrice, setMarketPrice] = useState("0.07701");
  const [quantity, setQuantity] = useState("11909");
  const [margin, setMargin] = useState("18");
  const [pnl, setPnl] = useState<number | null>(null);
  const [roi, setRoi] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [positionType, setPositionType] = useState<"long" | "short">("long");
  const [animationKey, setAnimationKey] = useState(0);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const [inputsFocused, setInputsFocused] = useState({
    entryPrice: false,
    marketPrice: false,
    quantity: false,
    margin: false,
  });

  const debouncedEntryPrice = useDebounce(entryPrice, 500);
  const debouncedMarketPrice = useDebounce(marketPrice, 500);
  const debouncedQuantity = useDebounce(quantity, 500);
  const debouncedMargin = useDebounce(margin, 500);

  // Updated formula to use quantity directly (Binance-style)
  const formula = useMemo(() => {
    if (positionType === "long") {
      return `(marketPrice - entryPrice) * quantity`;
    } else {
      return `(entryPrice - marketPrice) * quantity`;
    }
  }, [positionType]);

  // Notional position size (what Binance shows as "Size USDT")
  const notionalSize = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const qty = parseFloat(quantity);
    if (isNaN(ep) || isNaN(qty)) return 0;
    return ep * qty;
  }, [entryPrice, quantity]);

  // Effective leverage calculation
  const effectiveLeverage = useMemo(() => {
    const mar = parseFloat(margin);
    if (isNaN(mar) || mar <= 0 || notionalSize <= 0) return 0;
    return notionalSize / mar;
  }, [notionalSize, margin]);

  const calculatePnl = useCallback(async () => {
    const ep = parseFloat(debouncedEntryPrice);
    const mp = parseFloat(debouncedMarketPrice);
    const qty = parseFloat(debouncedQuantity);
    const mar = parseFloat(debouncedMargin);

    if (
      isNaN(ep) ||
      isNaN(mp) ||
      isNaN(qty) ||
      isNaN(mar) ||
      mp <= 0 ||
      qty <= 0 ||
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
          quantity: qty,
        });

        setPnl(newPnl);
        setRoi((newPnl / mar) * 100);
        setAnimationKey((prev) => prev + 1);

        // Generate chart data with more reasonable price range
        const priceRange = Math.abs(mp - ep) * 2; // Expand range around current prices
        const centerPrice = (mp + ep) / 2;
        const minPrice = Math.max(0.000001, centerPrice - priceRange);
        const maxPrice = centerPrice + priceRange;
        
        const steps = 48; // Reduced to make room for exact points
        const step = (maxPrice - minPrice) / (steps - 1);

        // Generate regular chart data
        const data: ChartData[] = Array.from({ length: steps }, (_, i) => {
          const currentMarketPrice = minPrice + (step * i);
          if (currentMarketPrice <= 0) return { marketPrice: 0, pnl: 0 };
          const pnlValue = evaluateFormula(formula, {
            entryPrice: ep,
            marketPrice: currentMarketPrice,
            quantity: qty,
          });
          return {
            marketPrice: parseFloat(currentMarketPrice.toFixed(8)),
            pnl: parseFloat(pnlValue.toFixed(2)),
          };
        });

        // Calculate exact PnL for entry and market prices
        const entryPnl = evaluateFormula(formula, {
          entryPrice: ep,
          marketPrice: ep, // At entry, PnL should be 0
          quantity: qty,
        });
        
        const currentPnl = evaluateFormula(formula, {
          entryPrice: ep,
          marketPrice: mp,
          quantity: qty,
        });

        // Add exact entry point
        data.push({
          marketPrice: parseFloat(ep.toFixed(8)),
          pnl: parseFloat(entryPnl.toFixed(2)),
          isEntry: true // Flag for identification
        } as any);
        
        // Add exact current market point
        data.push({
          marketPrice: parseFloat(mp.toFixed(8)),
          pnl: parseFloat(currentPnl.toFixed(2)),
          isMarket: true // Flag for identification
        } as any);

        // Sort by price and remove near-duplicates
        const sortedData = data
          .filter(d => d.marketPrice > 0)
          .sort((a, b) => a.marketPrice - b.marketPrice)
          .filter((item, index, array) => {
            if (index === 0) return true;
            // Keep if it's an exact point or far enough from previous
            return (item as any).isEntry || (item as any).isMarket || 
                   Math.abs(item.marketPrice - array[index - 1].marketPrice) > 0.000001;
          });
        
        setChartData(sortedData);

      } catch (error) {
        console.error("Error calculating PnL:", error);
        setPnl(null);
        setRoi(null);
        setChartData([]);
      } finally {
        setLoading(false);
      }
    }, 100);

  }, [debouncedEntryPrice, debouncedMarketPrice, debouncedQuantity, debouncedMargin, formula]);

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
        case 'quantity':
          setQuantity('');
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
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="w-full">
        <CardHeader className="p-3 md:p-4 pb-2">
          <CardTitle className="text-lg md:text-xl">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:gap-3 p-3 md:p-4 pt-0">
          <div className="space-y-1">
            <Label className="text-sm">Position</Label>
            <Tabs
              defaultValue="long"
              onValueChange={(value) => setPositionType(value as "long" | "short")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-lg border border-border bg-muted/40 p-[0.2rem] h-8 md:h-10 gap-1">
                <TabsTrigger
                  value="long"
                  className="w-full h-full flex items-center justify-center text-xs md:text-sm font-medium rounded-md px-0 py-0 m-0 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-green-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-sm transition-all hover:data-[state=inactive]:bg-muted/60"
                >
                  Long
                </TabsTrigger>
                <TabsTrigger
                  value="short"
                  className="w-full h-full flex items-center justify-center text-xs md:text-sm font-medium rounded-md px-0 py-0 m-0 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-red-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-sm transition-all hover:data-[state=inactive]:bg-muted/60"
                >
                  Short
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div className="space-y-1">
              <Label htmlFor="entryPrice" className="text-xs md:text-sm">Entry Price (USDT)</Label>
              <Input
                id="entryPrice"
                type="number"
                placeholder="e.g., 0.000846"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                onFocus={() => handleInputFocus('entryPrice')}
                min="0"
                step="any"
                className="h-8 md:h-10 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marketPrice" className="text-xs md:text-sm">Market Price (USDT)</Label>
              <Input
                id="marketPrice"
                type="number"
                placeholder="e.g., 0.000339"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                onFocus={() => handleInputFocus('marketPrice')}
                min="0"
                step="any"
                className="h-8 md:h-10 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantity" className="text-xs md:text-sm">Quantity (Coins)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="e.g., 1000000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                onFocus={() => handleInputFocus('quantity')}
                min="0"
                className="h-8 md:h-10 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="margin" className="text-xs md:text-sm">Initial Margin (USDT)</Label>
              <Input
                id="margin"
                type="number"
                placeholder="e.g., 18"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                onFocus={() => handleInputFocus('margin')}
                min="0"
                className="h-8 md:h-10 text-sm"
              />
            </div>
          </div>
          
          <div className="pt-1 md:pt-3">
            <div className="space-y-2 rounded-md border border-border/70 p-2 md:p-3 bg-muted/40">
              <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Total Size:</span>
                <span className="font-semibold">{notionalSize.toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Leverage:</span>
                <span className="font-semibold">{effectiveLeverage.toFixed(1)}x</span>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="p-3 md:p-4 pb-2">
          <CardTitle className="text-lg md:text-xl">Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3 md:p-4 pt-0">
          <div className="flex flex-col items-center justify-center space-y-1 rounded-lg bg-muted p-2 md:p-3">
            <p className="text-xs md:text-sm text-muted-foreground">PnL</p>
            {loading ? (
              <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin" />
            ) : (
              <p
                key={animationKey}
                className={`text-2xl md:text-4xl font-bold ${pnlColor} transition-colors duration-300 animate-in fade-in`}
              >
                {pnl !== null ? `${pnlPrefix}${pnl.toFixed(2)}` : "-.--"}
              </p>
            )}
            <p className="text-xs md:text-sm text-muted-foreground">
              {roi !== null ? `ROI: ${roi.toFixed(2)}%` : 'ROI: -.--%'}
            </p>
          </div>
          
          <div className="space-y-1 rounded-md border border-border/70 p-2 md:p-3">
            <div className="flex items-center justify-between text-xs md:text-sm">
                <span className="text-muted-foreground">Key values:</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 md:gap-x-4 gap-y-1 text-xs pt-1">
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Entry Price:</span>
                <span className="font-semibold">{entryPrice}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Market Price:</span>
                <span className="font-semibold">{marketPrice}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-semibold">{quantity}</span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1">
                <span className="text-muted-foreground">Margin:</span>
                <span className="font-semibold">{margin}</span>
              </div>
            </div>
          </div>
          
          <div className="h-24 md:h-40">
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
