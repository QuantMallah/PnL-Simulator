"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Dot,
  ReferenceLine,
} from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"

type ChartData = {
  marketPrice: number
  pnl: number
  isEntry?: boolean
  isMarket?: boolean
}

interface PnlChartProps {
  data: ChartData[]
  pnl: number | null
  entryPrice: number
  marketPrice: number
}

const chartConfig = {
  pnl: {
    label: "PnL",
  },
} satisfies ChartConfig

// Format price for display
const formatPrice = (value: number): string => {
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.01) return value.toFixed(4)
  if (value >= 0.0001) return value.toFixed(6)
  return value.toFixed(8)
}

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  
  // Check if this is an exact entry or market point
  if (payload.isEntry) {
    return (
      <g>
        <Dot cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={3} />
        <text 
          x={cx} 
          y={cy - 20} 
          fill="#1e40af" 
          fontSize={11} 
          fontWeight="bold"
          textAnchor="middle"
        >
          Entry
        </text>
      </g>
    );
  }
  
  if (payload.isMarket) {
    return (
      <g>
        <Dot cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={3} />
        <text 
          x={cx} 
          y={cy - 20} 
          fill="#dc2626" 
          fontSize={11} 
          fontWeight="bold"
          textAnchor="middle"
        >
          Current
        </text>
      </g>
    );
  }
  
  return null;
};

export function PnlChart({ data, pnl, entryPrice, marketPrice }: PnlChartProps) {
  const pnlColor = pnl === null ? "#888888" : pnl >= 0 ? "#22c55e" : "#ef4444"

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <AreaChart
        data={data}
        margin={{
          left: -10,
          right: 15,
          top: 25,
          bottom: 15,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        
        {/* Zero line reference */}
        <ReferenceLine y={0} stroke="#666" strokeDasharray="2 2" opacity={0.7} />
        
        <XAxis
          dataKey="marketPrice"
          type="number"
          scale="linear"
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatPrice}
          tickLine={false}
          axisLine={false}
          fontSize={10}
        />
        
        <YAxis
          tickFormatter={(value) => `$${value}`}
          tickLine={false}
          axisLine={false}
          fontSize={10}
          width={50}
        />
        
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload as ChartData;
              return (
                <div className="rounded-lg border bg-background p-3 shadow-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-muted-foreground">Price:</span>
                      <span className="font-mono text-sm">${formatPrice(data.marketPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                      <span className="text-xs text-muted-foreground">PnL:</span>
                      <span className={`font-bold text-sm ${data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${data.pnl.toFixed(2)}
                      </span>
                    </div>
                    {data.isEntry && (
                      <div className="text-xs text-blue-600 font-semibold">Entry Point</div>
                    )}
                    {data.isMarket && (
                      <div className="text-xs text-red-600 font-semibold">Current Price</div>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        
        <defs>
          <linearGradient id="fillPnl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={pnlColor} stopOpacity={0.8} />
            <stop offset="95%" stopColor={pnlColor} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        
        <Area
          dataKey="pnl"
          type="monotone"
          fill="url(#fillPnl)"
          stroke={pnlColor}
          strokeWidth={2}
          dot={<CustomDot />}
        />
      </AreaChart>
    </ChartContainer>
  )
}
