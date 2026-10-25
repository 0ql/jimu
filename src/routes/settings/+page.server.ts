import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "#lib/server/db/index.js";
import { oauthGrants, users } from "#lib/server/db/schema.js";
import { resourceUrl } from "#lib/server/oauth.js";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = (
		await db
			.select({ username: users.username })
			.from(users)
			.where(eq(users.uuid, locals.user.uuid))
	)[0];
	// Apps connected over OAuth (e.g. Claude): grants that got past the code exchange.
	const connections = await db
		.select({
			id: oauthGrants.id,
			name: oauthGrants.clientName,
			clientId: oauthGrants.clientId,
			createdAt: oauthGrants.createdAt,
			lastUsedAt: oauthGrants.lastUsedAt,
		})
		.from(oauthGrants)
		.where(and(eq(oauthGrants.userUuid, locals.user.uuid), isNotNull(oauthGrants.refreshHash)))
		.orderBy(desc(oauthGrants.createdAt));
	return {
		username: user?.username ?? "",
		connectorUrl: resourceUrl(url.origin),
		connections: connections.map((c) => ({
			id: c.id,
			name: c.name,
			host: new URL(c.clientId).host,
			createdAt: c.createdAt.getTime(),
			lastUsedAt: c.lastUsedAt?.getTime() ?? null,
		})),
	};
};
