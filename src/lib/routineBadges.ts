/**
 * A short label and a colour for each routine, for the chips in splits: "Push" → P,
 * "Pull" → Pu, "Brust Arme" → BA. Older routines (lower id) keep the shorter label when two
 * would clash, and the colour follows the order the routines were made in (6 colours, see
 * --routine-1 … --routine-6 in main.css), so neither changes when a routine is renamed elsewhere.
 */
export type Badge = { label: string; color: number };

const PALETTE = 6;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const routineBadges = (routines: { id?: number; name: string }[]) => {
	const badges = new Map<number, Badge>();
	const used = new Set<string>();
	const sorted = [...routines].sort((a, b) => a.id! - b.id!);
	sorted.forEach((routine, i) => {
		const name = routine.name.trim() || "?";
		const words = name.split(/[\s&/+,-]+/).filter(Boolean);
		const candidates = [
			words.length > 1
				? words
						.slice(0, 3)
						.map((w) => w[0].toUpperCase())
						.join("")
				: capital(name[0]),
			capital(name.slice(0, 2)),
			capital(name.slice(0, 3)),
		];
		const label = candidates.find((c) => !used.has(c)) ?? `${capital(name[0])}${i + 1}`;
		used.add(label);
		badges.set(routine.id!, { label, color: (i % PALETTE) + 1 });
	});
	return badges;
};
