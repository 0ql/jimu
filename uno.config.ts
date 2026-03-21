import { defineConfig } from 'unocss'

export default defineConfig({
	theme: {
		colors: {
			background: 'var(--background)',
			foreground: 'var(--foreground)',
			card: 'var(--card)',
			'card-fg': 'var(--card-foreground)',
		},
		animation: {
			keyframes: {
				'accordion-down': '{ from { height: 0 } to { height: var(--bits-accordion-content-height) } }',
				'accordion-up': '{ from { height: var(--bits-accordion-content-height) } to { height: 0 } }',
			},
			durations: {
				'accordion-down': '0.2s',
				'accordion-up': '0.2s',
			},
			timingFns: {
				'accordion-down': 'ease-out',
				'accordion-up': 'ease-out',
			},
		},
	}
})
