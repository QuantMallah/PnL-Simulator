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
} from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart"

type ChartData = {
  marketPrice: number
  pnl: number
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
  marketPrice: {
    label: "Market Price"
  }
} satisfies ChartConfig

const CustomDot = (props: any) => {
  const { cx, cy, stroke, payload, entryPrice, marketPrice } = props;
  const tolerance = 0.001;

  if (Math.abs(payload.marketPrice - entryPrice) < tolerance || Math.abs(payload.marketPrice - marketPrice) < tolerance) {
    let fill, label;
    if (Math.abs(payload.marketPrice - entryPrice) < tolerance) {
      fill = "#888888"; // grey
      label = "Entry";
    } else {
      fill = "#888888"; // grey
      label = "Exit";
    }
    return (
      <>
        <Dot cx={cx} cy={cy} r={5} stroke={stroke} strokeWidth={2} fill={fill} />
        <text x={cx} y={cy - 10} dy={-4} fill="#666" fontSize={12} textAnchor="middle">{label}</text>
      </>
    );
  }

  return null;
};


export function PnlChart({ data, pnl, entryPrice, marketPrice }: PnlChartProps) {
  const pnlColor = pnl === null ? "#888888" : pnl >= 0 ? "#22c55e" : "#ef4444"

  return (
    <ChartContainer config={chartConfig} className="h-full w-full">
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{
          left: -20,
          right: 10,
          top: 20,
          bottom: 10,
        }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="marketPrice"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `$${value}`}
          type="number"
          domain={['dataMin', 'dataMax']}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          cursor={false}
          content={<ChartTooltipContent 
            indicator="dot" 
            formatter={(value, name, props) => {
              if (name === 'pnl') {
                const { payload } = props;
                return (
                  <div className="flex flex-col gap-1 p-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">PnL:</span>
                      <span className="font-bold">${Number(value).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-bold">${Number(payload.marketPrice).toFixed(2)}</span>
                    </div>
                  </div>
                )
              }
              return null
            }}
          />}
        />
        <defs>
          <linearGradient id="fillPnl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={pnlColor} stopOpacity={0.8} />
            <stop offset="95%" stopColor={pnlColor} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          dataKey="pnl"
          type="natural"
          fill="url(#fillPnl)"
          stroke={pnlColor}
          stackId="a"
          dot={<CustomDot entryPrice={entryPrice} marketPrice={marketPrice} />}
        />
      </AreaChart>
    </ChartContainer>
  )
}
