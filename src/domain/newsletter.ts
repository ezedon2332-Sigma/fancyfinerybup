/** Privé Circle — domain vocabulary for the VIP newsletter & membership.
 *  Pure types and constants: no framework, no I/O. Shared by the public form,
 *  the server actions, the automation layer and the admin dashboard. */

export const SUBSCRIBER_STATUSES = [
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced",
  "complained",
] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_SOURCES = [
  "homepage",
  "modal",
  "footer",
  "checkout",
  "admin",
  "import",
] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

/** Fashion interests offered on the join form. `id` is what the database
 *  stores; `label` is what the member sees. */
export const FASHION_INTERESTS = [
  { id: "womens", label: "Women's Fashion" },
  { id: "mens", label: "Men's Fashion" },
  { id: "childrens", label: "Children's Fashion" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
  { id: "luxury", label: "Luxury Collections" },
] as const;

export const INTEREST_IDS = FASHION_INTERESTS.map((i) => i.id);
export type FashionInterest = (typeof FASHION_INTERESTS)[number]["id"];

export function interestLabel(id: string): string {
  return FASHION_INTERESTS.find((i) => i.id === id)?.label ?? id;
}

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
  "failed",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_EVENTS = [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "unsubscribed",
  "converted",
] as const;
export type CampaignEvent = (typeof CAMPAIGN_EVENTS)[number];

/** Lifecycle emails the automation layer knows how to send. */
export const AUTOMATIONS = [
  "welcome",
  "birthday",
  "new_collection",
  "vip_invitation",
  "flash_sale",
  "back_in_stock",
  "style_guide",
  "seasonal",
  "abandoned_cart",
  "review_request",
  "order_followup",
] as const;
export type Automation = (typeof AUTOMATIONS)[number];

export const SUBSCRIPTION_ACTIONS = [
  "subscribed",
  "resubscribed",
  "unsubscribed",
  "preferences_updated",
  "imported",
  "deleted",
  "bounced",
] as const;
export type SubscriptionAction = (typeof SUBSCRIPTION_ACTIONS)[number];

/** The consent sentence stored verbatim against each signup, so we can prove
 *  what a member agreed to even if the wording later changes. */
export const CONSENT_TEXT =
  "I agree to receive marketing emails from Fancy Finery and understand I can " +
  "unsubscribe at any time.";

/** Signups allowed from one IP within the window — cheap abuse brake. */
export const SIGNUP_RATE_LIMIT = { max: 5, windowMinutes: 60 } as const;

export interface Subscriber {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  country: string | null;
  birthday: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  interests: FashionInterest[];
  unsubscribeToken: string;
  createdAt: string;
  unsubscribedAt: string | null;
  lastEmailedAt: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  conversionCount: number;
  bounceCount: number;
  unsubscribeCount: number;
  createdAt: string;
}

/** Engagement rates, guarded against divide-by-zero. */
export function campaignRates(c: Campaign): {
  open: number;
  click: number;
  conversion: number;
} {
  const base = c.sentCount || 0;
  if (base === 0) return { open: 0, click: 0, conversion: 0 };
  return {
    open: (c.openCount / base) * 100,
    click: (c.clickCount / base) * 100,
    conversion: (c.conversionCount / base) * 100,
  };
}
