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
import { Loader2, Settings2 } from "lucide-react";
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
  // Primary inputs (always manual)
  const [entryPrice, setEntryPrice] = useState("0.011");
  const [marketPrice, setMarketPrice] = useState("0.07701");
  
  // Auto-changeable parameters
  const [quantity, setQuantity] = useState("11909");
  const [totalSize, setTotalSize] = useState("130.999");
  const [margin, setMargin] = useState("18");
  const [leverage, setLeverage] = useState("7.3");
  
  // Track which parameter was last changed
  const [lastChanged, setLastChanged] = useState<'quantity' | 'totalSize' | 'margin' | 'leverage'>('quantity');
  
  // Other states
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
    totalSize: false,
    margin: false,
    leverage: false,
  });

  const debouncedEntryPrice = useDebounce(entryPrice, 300);
  const debouncedMarketPrice = useDebounce(marketPrice, 300);
  const debouncedQuantity = useDebounce(quantity, 300);
  const debouncedTotalSize = useDebounce(totalSize, 300);
  const debouncedMargin = useDebounce(margin, 300);
  const debouncedLeverage = useDebounce(leverage, 300);

  // Formula for PnL calculation
  const formula = useMemo(() => {
    if (positionType === "long") {
      return `(marketPrice - entryPrice) * quantity`;
    } else {
      return `(entryPrice - marketPrice) * quantity`;
    }
  }, [positionType]);

  // Auto-calculation logic
  useEffect(() => {
    const ep = parseFloat(debouncedEntryPrice);
    const qty = parseFloat(debouncedQuantity);
    const ts = parseFloat(debouncedTotalSize);
    const mar = parseFloat(debouncedMargin);
    const lev = parseFloat(debouncedLeverage);

    // Skip if entry price is invalid
    if (isNaN(ep) || ep <= 0) return;

    // Skip if currently focused on any input to avoid interrupting user typing
    const anyFocused = Object.values(inputsFocused).some(focused => focused);
    if (anyFocused) return;

    try {
      switch (lastChanged) {
        case 'quantity':
          if (!isNaN(qty) && qty > 0) {
            // Calculate Total Size = Entry Price × Quantity
            const newTotalSize = ep * qty;
            setTotalSize(newTotalSize.toFixed(6));
            
            // Calculate Leverage or Margin (prefer maintaining leverage if margin is reasonable)
            if (!isNaN(mar) && mar > 0) {
              const newLeverage = newTotalSize / mar;
              setLeverage(newLeverage.toFixed(3));
            } else if (!isNaN(lev) && lev > 0) {
              const newMargin = newTotalSize / lev;
              setMargin(newMargin.toFixed(6));
            }
          }
          break;

        case 'totalSize':
          if (!isNaN(ts) && ts > 0) {
            // Calculate Quantity = Total Size / Entry Price
            const newQuantity = ts / ep;
            setQuantity(newQuantity.toFixed(0));
            
            // Calculate Leverage or Margin
            if (!isNaN(mar) && mar > 0) {
              const newLeverage = ts / mar;
              setLeverage(newLeverage.toFixed(3));
            } else if (!isNaN(lev) && lev > 0) {
              const newMargin = ts / lev;
              setMargin(newMargin.toFixed(6));
            }
          }
          break;

        case 'margin':
          if (!isNaN(mar) && mar > 0 && !isNaN(ts) && ts > 0) {
            // Calculate Leverage = Total Size / Initial Margin
            const newLeverage = ts / mar;
            setLeverage(newLeverage.toFixed(3));
          }
          break;

        case 'leverage':
          if (!isNaN(lev) && lev > 0 && !isNaN(ts) && ts > 0) {
            // Calculate Initial Margin = Total Size / Leverage
            const newMargin = ts / lev;
            setMargin(newMargin.toFixed(6));
          }
          break;
      }
    } catch (error) {
      console.error("Error in auto-calculation:", error);
    }
  }, [debouncedQuantity, debouncedTotalSize, debouncedMargin, debouncedLeverage, debouncedEntryPrice, lastChanged, inputsFocused]);

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
        const priceRange = Math.abs(mp - ep) * 2;
        const centerPrice = (mp + ep) / 2;
        const minPrice = Math.max(0.000001, centerPrice - priceRange);
        const maxPrice = centerPrice + priceRange;
        
        const steps = 48;
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
          marketPrice: ep,
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
          isEntry: true
        } as any);
        
        // Add exact current market point
        data.push({
          marketPrice: parseFloat(mp.toFixed(8)),
          pnl: parseFloat(currentPnl.toFixed(2)),
          isMarket: true
        } as any);

        // Sort by price and remove near-duplicates
        const sortedData = data
          .filter(d => d.marketPrice > 0)
          .sort((a, b) => a.marketPrice - b.marketPrice)
          .filter((item, index, array) => {
            if (index === 0) return true;
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
    setInputsFocused(prev => ({ ...prev, [inputName]: true }));
    
    // Clear the field when focused for the first time
    setTimeout(() => {
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
        case 'totalSize':
          setTotalSize('');
          break;
        case 'margin':
          setMargin('');
          break;
        case 'leverage':
          setLeverage('');
          break;
      }
    }, 50);
  };

  const handleInputBlur = (inputName: keyof typeof inputsFocused) => {
    setInputsFocused(prev => ({ ...prev, [inputName]: false }));
  };

  const handleParameterChange = (
    parameter: 'quantity' | 'totalSize' | 'margin' | 'leverage',
    value: string,
    setValue: (value: string) => void
  ) => {
    setValue(value);
    setLastChanged(parameter);
  };

  const pnlColor = pnl === null ? "text-foreground" : pnl >= 0 ? "text-green-500" : "text-red-500";
  const pnlPrefix = pnl !== null && pnl > 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 lg:gap-6">
      <Card className="w-full">
        <CardHeader className="p-3 md:p-4 pb-2">
          <CardTitle className="text-lg md:text-xl">Inputs</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:gap-3 p-3 md:p-4 !pt-0">
          <div className="space-y-1">
            <Label className="text-sm">Position</Label>
            <Tabs
              defaultValue="long"
              onValueChange={(value) => setPositionType(value as "long" | "short")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-lg border border-border bg-muted/40 p-[0.2rem] h-8 md:h-10 gap-1">
                <TabsTrigger value="long" className="w-full h-full flex items-center justify-center text-xs md:text-sm font-medium rounded-md px-0 py-0 m-0 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-green-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-sm transition-all hover:data-[state=inactive]:bg-muted/60">
                  Long
                </TabsTrigger>
                <TabsTrigger value="short" className="w-full h-full flex items-center justify-center text-xs md:text-sm font-medium rounded-md px-0 py-0 m-0 data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-500 dark:data-[state=active]:bg-red-600 dark:data-[state=active]:text-white dark:data-[state=inactive]:text-slate-400 data-[state=active]:shadow-sm transition-all hover:data-[state=inactive]:bg-muted/60">
                  Short
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Primary Inputs (Always Manual) */}
          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div className="space-y-1">
              <Label htmlFor="entryPrice" className="text-xs md:text-sm font-medium flex items-center gap-1">
                Entry Price (USDT)
                <Badge variant="outline" className="text-[9px] px-1 py-0">PRIMARY</Badge>
              </Label>
              <Input
                id="entryPrice"
                type="number"
                placeholder="e.g., 0.011"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                onFocus={() => handleInputFocus('entryPrice')}
                onBlur={() => handleInputBlur('entryPrice')}
                min="0"
                step="any"
                className="h-8 md:h-10 text-sm border-blue-200 focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="marketPrice" className="text-xs md:text-sm font-medium">Market Price (USDT)</Label>
              <Input
                id="marketPrice"
                type="number"
                placeholder="e.g., 0.07701"
                value={marketPrice}
                onChange={(e) => setMarketPrice(e.target.value)}
                onFocus={() => handleInputFocus('marketPrice')}
                onBlur={() => handleInputBlur('marketPrice')}
                min="0"
                step="any"
                className="h-8 md:h-10 text-sm"
              />
            </div>
          </div>

          {/* Auto-Changeable Parameters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs md:text-sm text-muted-foreground">Auto-Calculated Parameters</Label>
              <Settings2 className="h-3 w-3 text-muted-foreground" />
            </div>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div className="space-y-1">
                <Label htmlFor="quantity" className="text-xs md:text-sm flex items-center gap-1">
                  Quantity (Coins)
                  {lastChanged !== 'quantity' && <Badge variant="secondary" className="text-[9px] px-1 py-0">AUTO</Badge>}
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="e.g., 11909"
                  value={quantity}
                  onChange={(e) => handleParameterChange('quantity', e.target.value, setQuantity)}
                  onFocus={() => handleInputFocus('quantity')}
                  onBlur={() => handleInputBlur('quantity')}
                  min="0"
                  className={`h-8 md:h-10 text-sm ${lastChanged === 'quantity' ? 'border-green-200 bg-green-50/50' : 'bg-muted/30'}`}
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="totalSize" className="text-xs md:text-sm flex items-center gap-1">
                  Total Size (USDT)
                  {lastChanged !== 'totalSize' && <Badge variant="secondary" className="text-[9px] px-1 py-0">AUTO</Badge>}
                </Label>
                <Input
                  id="totalSize"
                  type="number"
                  placeholder="e.g., 130.999"
                  value={totalSize}
                  onChange={(e) => handleParameterChange('totalSize', e.target.value, setTotalSize)}
                  onFocus={() => handleInputFocus('totalSize')}
                  onBlur={() => handleInputBlur('totalSize')}
                  min="0"
                  step="any"
                  className={`h-8 md:h-10 text-sm ${lastChanged === 'totalSize' ? 'border-green-200 bg-green-50/50' : 'bg-muted/30'}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="margin" className="text-xs md:text-sm flex items-center gap-1">
                  Initial Margin (USDT)
                  {lastChanged !== 'margin' && <Badge variant="secondary" className="text-[9px] px-1 py-0">AUTO</Badge>}
                </Label>
                <Input
                  id="margin"
                  type="number"
                  placeholder="e.g., 18"
                  value={margin}
                  onChange={(e) => handleParameterChange('margin', e.target.value, setMargin)}
                  onFocus={() => handleInputFocus('margin')}
                  onBlur={() => handleInputBlur('margin')}
                  min="0"
                  step="any"
                  className={`h-8 md:h-10 text-sm ${lastChanged === 'margin' ? 'border-green-200 bg-green-50/50' : 'bg-muted/30'}`}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="leverage" className="text-xs md:text-sm flex items-center gap-1">
                  Leverage
                  {lastChanged !== 'leverage' && <Badge variant="secondary" className="text-[9px] px-1 py-0">AUTO</Badge>}
                </Label>
                <Input
                  id="leverage"
                  type="number"
                  placeholder="e.g., 7.3"
                  value={leverage}
                  onChange={(e) => handleParameterChange('leverage', e.target.value, setLeverage)}
                  onFocus={() => handleInputFocus('leverage')}
                  onBlur={() => handleInputBlur('leverage')}
                  min="0"
                  step="0.1"
                  className={`h-8 md:h-10 text-sm ${lastChanged === 'leverage' ? 'border-green-200 bg-green-50/50' : 'bg-muted/30'}`}
                />
              </div>
            </div>
          </div>
          
          <div className="pt-1 md:pt-2">
            <div className="relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-r from-muted/30 via-muted/20 to-muted/30 p-3 md:p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-medium text-muted-foreground">Last changed</span>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-[10px] px-2.5 py-0.5 font-semibold capitalize bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 shadow-sm"
                >
                  {lastChanged.replace(/([A-Z])/g, ' $1').toLowerCase()}
                </Badge>
              </div>
              {/* Subtle decorative element */}
              <div className="absolute top-0 right-0 h-full w-1 bg-gradient-to-b from-green-400/50 via-green-500/30 to-green-600/50"></div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Result Card remains the same */}
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
                <span className="text-muted-foreground">Current values:</span>
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
                <span className="text-muted-foreground">Total Size:</span>
                <span className="font-semibold">{totalSize}</span>
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
