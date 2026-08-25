import type {
  Order,
  OrderWithItems,
  ShippingDetails,
} from "@/domain/entities/order";

export interface NewOrderItem {
  productId: string;
  variantId: string | null;
  nameSnapshot: string;
  unitPrice: number; // minor units
  qty: number;
}

export interface NewOrder {
  userId: string;
  currency: string;
  subtotal: number; // minor units (order currency)
  shippingCost: number; // minor units (order currency)
  tax: number; // minor units
  discount: number; // minor units
  /** Cart weight the postage was priced on — kept for audit and reprints. */
  totalWeightGrams: number;
  total: number; // minor units (subtotal - discount + shipping + tax)
  /** Method *code*: legacy "standard"/"express" or an engine-defined code. */
  shippingMethod: string | null;
  shipping: ShippingDetails;
  items: NewOrderItem[];
}

/** Raised when stock ran out between pricing the basket and writing the order. */
export class OutOfStockError extends Error {
  constructor(message = "Sorry — that item just sold out.") {
    super(message);
    this.name = "OutOfStockError";
  }
}

/** Port: order persistence, independent of any particular database. */
export interface OrderRepository {
  /**
   * Create a pending order with its line items, **decrementing stock in the
   * same transaction**. Returns the new order id.
   *
   * Throws `OutOfStockError` if any line can no longer be satisfied. The
   * use-case checks stock while pricing, but that check reads a snapshot: two
   * customers pricing the last dress both see one in stock. Only a conditional
   * decrement at write time can decide between them, and it has to share the
   * transaction with the order or a crash between the two leaves stock sold
   * with no order, or an order with stock still on the shelf.
   */
  create(input: NewOrder): Promise<string>;

  /** Orders belonging to a single user, newest first. */
  listByUser(userId: string): Promise<Order[]>;

  /**
   * A single order with its line items, **scoped to its owner**. Returns null
   * if the order does not exist OR belongs to someone else — the caller cannot
   * tell the difference, which is the point.
   *
   * Under Supabase there was one unscoped `findById`, and Row Level Security
   * supplied the `user_id = auth.uid()` filter invisibly. With RLS gone that
   * filter has to be somewhere, and a parameter the caller is forced to pass is
   * the one place it cannot be forgotten. Taking `userId` is therefore not
   * ceremony: it is the security control.
   */
  findByIdForUser(id: string, userId: string): Promise<OrderWithItems | null>;

  /**
   * Any order, regardless of owner. **Callers MUST have established admin
   * rights first** (see `requireAdmin`). Deliberately named so that an
   * unguarded call reads as wrong at the call site.
   */
  findByIdAsAdmin(id: string): Promise<OrderWithItems | null>;

  /**
   * Cancel an order the customer owns and has not paid for.
   *
   * Scoped and conditional in a single statement, on purpose. Read-then-write
   * would leave a window in which a payment lands between the check and the
   * update, cancelling an order the customer has just been charged for. The
   * predicate carries all four conditions — right owner, right order, not paid,
   * not already progressed — so the database decides, once.
   *
   * Returns true only if a row actually changed.
   */
  cancelUnpaidForUser(id: string, userId: string): Promise<boolean>;

  /**
   * Put an order's stock back on the shelf.
   *
   * Idempotent per order: calling it twice must not credit stock twice, which
   * would be a slow leak of phantom inventory. Implementations key that off the
   * order already being cancelled.
   */
  restoreStock(orderId: string): Promise<void>;
}
