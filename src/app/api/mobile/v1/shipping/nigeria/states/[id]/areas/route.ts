import { listDestinations } from "@/infrastructure/db/nigeria-shipping-service";
import { loadExchangeRates } from "@/infrastructure/db/exchange-rate-service";

import { requestCurrency } from "../../../../../../_lib/context";
import { money } from "../../../../../../_lib/dto";
import { handler, ok } from "../../../../../../_lib/respond";

/**
 * GET /api/mobile/v1/shipping/nigeria/states/[id]/areas
 *
 * Delivery areas for one state, with each flat fee already expressed in the
 * shopper's currency so the picker can show a price beside every area.
 *
 * Scoped to the chosen state on purpose: the table holds thousands of rows
 * across thirty-seven states, and sending all of them to a phone to filter
 * locally would undo the point of the schema.
 *
 * The fee shown here is for display only. The order and the quote both re-read
 * the price from the database by destination id, so a tampered client changes
 * what it renders and nothing about what it is charged.
 */
export const GET = handler(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;

    const [destinations, currency, rates] = await Promise.all([
      listDestinations(id),
      requestCurrency(),
      loadExchangeRates(),
    ]);

    return ok({
      items: destinations.map((d) => ({
        id: d.id,
        stateId: d.stateId,
        name: d.name,
        fee: money(d.priceKobo, currency, rates),
      })),
    });
  },
);
