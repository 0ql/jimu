import { defineConfig, presetWind3 } from 'unocss'
import presetIcons from '@unocss/preset-icons'

export default defineConfig({
	presets: [presetWind3(), presetIcons()],
	theme: {
		colors: {
			bg: 'var(--background)',
			'bg-alt': 'var(--background-alt)',
			fg: 'var(--foreground)',
			'fg-alt': 'var(--foreground-alt)',
			muted: 'var(--muted)',
			'muted-foreground': 'var(--muted-foreground)',
			'border': 'var(--border)',
			'border-input': 'var(--border-input)',
			'border-input-hover': 'var(--border-input-hover)',
			'border-card': 'var(--border-card)',
			'dark': 'var(--dark)',
			'destructive': 'var(--destructive)'
		},
	}
})
