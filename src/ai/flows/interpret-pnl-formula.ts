// This is a server-side file.
'use server';

/**
 * @fileOverview A P&L calculation formula interpretation AI agent.
 *
 * - interpretPnLFormula - A function that handles the interpretation and application of a P&L formula.
 * - InterpretPnLFormulaInput - The input type for the interpretPnLFormula function.
 * - InterpretPnLFormulaOutput - The return type for the interpretPnLFormula function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InterpretPnLFormulaInputSchema = z.object({
  entryPrice: z.number().describe('The entry price of the asset.'),
  marketPrice: z.number().describe('The current market price of the asset.'),
  leverage: z.number().describe('The leverage used in the trade.'),
  margin: z.number().describe('The margin (actual investment) in USDT.'),
  formula: z
    .string()
    .describe(
      'The P&L calculation formula to be applied.  Use `entryPrice`, `marketPrice`, `leverage`, and `margin` as variables.'
    ),
});
export type InterpretPnLFormulaInput = z.infer<typeof InterpretPnLFormulaInputSchema>;

const InterpretPnLFormulaOutputSchema = z.object({
  pnl: z
    .number()
    .describe('The calculated profit and loss based on the provided formula.'),
});
export type InterpretPnLFormulaOutput = z.infer<typeof InterpretPnLFormulaOutputSchema>;

export async function interpretPnLFormula(input: InterpretPnLFormulaInput): Promise<InterpretPnLFormulaOutput> {
  return interpretPnLFormulaFlow(input);
}

const interpretPnLFormulaPrompt = ai.definePrompt({
  name: 'interpretPnLFormulaPrompt',
  input: {schema: InterpretPnLFormulaInputSchema},
  output: {schema: InterpretPnLFormulaOutputSchema},
  prompt: `You are an expert financial analyst specializing in calculating profit and loss (P&L) for trades.

You will receive a formula, the entry price, market price, leverage, and margin.
Apply the formula using the provided values to calculate the P&L.

entryPrice: {{{entryPrice}}}
marketPrice: {{{marketPrice}}}
leverage: {{{leverage}}}
margin: {{{margin}}}
formula: {{{formula}}}

Calculate the P&L based on the formula and return the numerical result.
`,
});

const interpretPnLFormulaFlow = ai.defineFlow(
  {
    name: 'interpretPnLFormulaFlow',
    inputSchema: InterpretPnLFormulaInputSchema,
    outputSchema: InterpretPnLFormulaOutputSchema,
  },
  async input => {
    // This flow is no longer doing the primary calculation to improve performance.
    // The frontend now handles the calculation directly.
    // This flow can be used for more complex analysis in the future if needed.
    const {output} = await interpretPnLFormulaPrompt(input);
    return output!;
  }
);
