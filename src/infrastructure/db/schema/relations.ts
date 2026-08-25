import { relations } from "drizzle-orm/relations";
import { aiConversations, aiMessages, emailCampaigns, automationLogs, newsletterSubscribers, products, colorRequests, discountCodes, discountRedemptions, orders, profiles, campaignAnalytics, emailTemplates, ngStates, ngDestinations, orderItems, productVariants, productReviews, productImages, categories, paymentEvents, shippingWeightBrackets, shippingRates, shippingMethods, shippingZones, shippingZoneCountries, subscriptionHistory, taxRules, knowledgeDocuments, knowledgeChunks, newsletterPreferences } from "./tables";

export const aiMessagesRelations = relations(aiMessages, ({one}) => ({
	aiConversation: one(aiConversations, {
		fields: [aiMessages.conversationId],
		references: [aiConversations.id]
	}),
}));

export const aiConversationsRelations = relations(aiConversations, ({one, many}) => ({
	aiMessages: many(aiMessages),
	profile: one(profiles, {
		fields: [aiConversations.userId],
		references: [profiles.id]
	}),
}));

export const automationLogsRelations = relations(automationLogs, ({one}) => ({
	emailCampaign: one(emailCampaigns, {
		fields: [automationLogs.campaignId],
		references: [emailCampaigns.id]
	}),
	newsletterSubscriber: one(newsletterSubscribers, {
		fields: [automationLogs.subscriberId],
		references: [newsletterSubscribers.id]
	}),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({one, many}) => ({
	automationLogs: many(automationLogs),
	campaignAnalytics: many(campaignAnalytics),
	profile: one(profiles, {
		fields: [emailCampaigns.createdBy],
		references: [profiles.id]
	}),
	emailTemplate: one(emailTemplates, {
		fields: [emailCampaigns.templateId],
		references: [emailTemplates.id]
	}),
}));

export const newsletterSubscribersRelations = relations(newsletterSubscribers, ({one, many}) => ({
	automationLogs: many(automationLogs),
	campaignAnalytics: many(campaignAnalytics),
	profile: one(profiles, {
		fields: [newsletterSubscribers.profileId],
		references: [profiles.id]
	}),
	subscriptionHistories: many(subscriptionHistory),
	newsletterPreferences: many(newsletterPreferences),
}));

export const colorRequestsRelations = relations(colorRequests, ({one}) => ({
	product: one(products, {
		fields: [colorRequests.productId],
		references: [products.id]
	}),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	colorRequests: many(colorRequests),
	orderItems: many(orderItems),
	productReviews: many(productReviews),
	productImages: many(productImages),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	productVariants: many(productVariants),
}));

export const discountRedemptionsRelations = relations(discountRedemptions, ({one}) => ({
	discountCode: one(discountCodes, {
		fields: [discountRedemptions.codeId],
		references: [discountCodes.id]
	}),
	order: one(orders, {
		fields: [discountRedemptions.orderId],
		references: [orders.id]
	}),
	profile: one(profiles, {
		fields: [discountRedemptions.userId],
		references: [profiles.id]
	}),
}));

export const discountCodesRelations = relations(discountCodes, ({many}) => ({
	discountRedemptions: many(discountRedemptions),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	discountRedemptions: many(discountRedemptions),
	orderItems: many(orderItems),
	productReviews: many(productReviews),
	paymentEvents: many(paymentEvents),
	profile: one(profiles, {
		fields: [orders.userId],
		references: [profiles.id]
	}),
}));

export const profilesRelations = relations(profiles, ({many}) => ({
	discountRedemptions: many(discountRedemptions),
	aiConversations: many(aiConversations),
	emailCampaigns: many(emailCampaigns),
	newsletterSubscribers: many(newsletterSubscribers),
	productReviews: many(productReviews),
	orders: many(orders),
}));

export const campaignAnalyticsRelations = relations(campaignAnalytics, ({one}) => ({
	emailCampaign: one(emailCampaigns, {
		fields: [campaignAnalytics.campaignId],
		references: [emailCampaigns.id]
	}),
	newsletterSubscriber: one(newsletterSubscribers, {
		fields: [campaignAnalytics.subscriberId],
		references: [newsletterSubscribers.id]
	}),
}));

export const emailTemplatesRelations = relations(emailTemplates, ({many}) => ({
	emailCampaigns: many(emailCampaigns),
}));

export const ngDestinationsRelations = relations(ngDestinations, ({one}) => ({
	ngState: one(ngStates, {
		fields: [ngDestinations.stateId],
		references: [ngStates.id]
	}),
}));

export const ngStatesRelations = relations(ngStates, ({many}) => ({
	ngDestinations: many(ngDestinations),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
	productVariant: one(productVariants, {
		fields: [orderItems.variantId],
		references: [productVariants.id]
	}),
}));

export const productVariantsRelations = relations(productVariants, ({one, many}) => ({
	orderItems: many(orderItems),
	product: one(products, {
		fields: [productVariants.productId],
		references: [products.id]
	}),
}));

export const productReviewsRelations = relations(productReviews, ({one}) => ({
	order: one(orders, {
		fields: [productReviews.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [productReviews.productId],
		references: [products.id]
	}),
	profile: one(profiles, {
		fields: [productReviews.profileId],
		references: [profiles.id]
	}),
}));

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	products: many(products),
}));

export const paymentEventsRelations = relations(paymentEvents, ({one}) => ({
	order: one(orders, {
		fields: [paymentEvents.orderId],
		references: [orders.id]
	}),
}));

export const shippingRatesRelations = relations(shippingRates, ({one}) => ({
	shippingWeightBracket: one(shippingWeightBrackets, {
		fields: [shippingRates.bracketId],
		references: [shippingWeightBrackets.id]
	}),
	shippingMethod: one(shippingMethods, {
		fields: [shippingRates.methodId],
		references: [shippingMethods.id]
	}),
	shippingZone: one(shippingZones, {
		fields: [shippingRates.zoneId],
		references: [shippingZones.id]
	}),
}));

export const shippingWeightBracketsRelations = relations(shippingWeightBrackets, ({many}) => ({
	shippingRates: many(shippingRates),
}));

export const shippingMethodsRelations = relations(shippingMethods, ({many}) => ({
	shippingRates: many(shippingRates),
}));

export const shippingZonesRelations = relations(shippingZones, ({many}) => ({
	shippingRates: many(shippingRates),
	shippingZoneCountries: many(shippingZoneCountries),
	taxRules: many(taxRules),
}));

export const shippingZoneCountriesRelations = relations(shippingZoneCountries, ({one}) => ({
	shippingZone: one(shippingZones, {
		fields: [shippingZoneCountries.zoneId],
		references: [shippingZones.id]
	}),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({one}) => ({
	newsletterSubscriber: one(newsletterSubscribers, {
		fields: [subscriptionHistory.subscriberId],
		references: [newsletterSubscribers.id]
	}),
}));

export const taxRulesRelations = relations(taxRules, ({one}) => ({
	shippingZone: one(shippingZones, {
		fields: [taxRules.zoneId],
		references: [shippingZones.id]
	}),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({one}) => ({
	knowledgeDocument: one(knowledgeDocuments, {
		fields: [knowledgeChunks.documentId],
		references: [knowledgeDocuments.id]
	}),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({many}) => ({
	knowledgeChunks: many(knowledgeChunks),
}));

export const newsletterPreferencesRelations = relations(newsletterPreferences, ({one}) => ({
	newsletterSubscriber: one(newsletterSubscribers, {
		fields: [newsletterPreferences.subscriberId],
		references: [newsletterSubscribers.id]
	}),
}));