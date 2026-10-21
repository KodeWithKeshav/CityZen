/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,jsx}'],
	theme: {
		// Override ALL border-radius to enforce 0px sharp corners
		borderRadius: {
			none: '0px',
			DEFAULT: '0px',
			sm: '0px',
			md: '0px',
			lg: '0px',
			xl: '0px',
			'2xl': '0px',
			'3xl': '0px',
			full: '0px',
		},
		extend: {
			colors: {
				// Achromatic primary palette
				primary: {
					DEFAULT: '#000000',
					50: '#F7F9FF',
					100: '#F1F2F4',
					200: '#E0E2E8',
					300: '#CFC4C5',
					400: '#7E7576',
					500: '#5D5F5F',
					600: '#474747',
					700: '#2D3135',
					800: '#1B1B1B',
					900: '#000000',
				},
				// Admin uses the same achromatic scheme
				admin: {
					50: '#F7F9FF',
					100: '#F1F2F4',
					200: '#E0E2E8',
					300: '#CFC4C5',
					400: '#7E7576',
					500: '#5D5F5F',
					600: '#474747',
					700: '#2D3135',
					800: '#1B1B1B',
					900: '#000000',
				},
				// Design system semantic colors
				surface: {
					DEFAULT: '#FFFFFF',
					dim: '#D8DADF',
					bright: '#F7F9FF',
					container: {
						lowest: '#FFFFFF',
						low: '#F1F4F9',
						DEFAULT: '#ECEEF3',
						high: '#E6E8EE',
						highest: '#E0E2E8',
					},
				},
				'cool-pearl': '#F1F2F4',
				'on-surface': '#181C20',
				'on-surface-variant': '#4C4546',
				outline: {
					DEFAULT: '#7E7576',
					variant: '#CFC4C5',
				},
				'civic-error': '#BA1A1A',
				'on-error': '#FFFFFF',
				'error-container': '#FFDAD6',
			},
			fontFamily: {
				epilogue: ['Epilogue', 'sans-serif'],
				inter: ['Inter', 'sans-serif'],
			},
			fontSize: {
				'display-xl': ['72px', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '700' }],
				'headline-lg': ['40px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
				'headline-md': ['24px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
				'body-lg': ['18px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
				'body-md': ['16px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '400' }],
				'label-sm': ['12px', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '600' }],
			},
			spacing: {
				'unit': '8px',
				'gutter': '32px',
				'margin-lg': '64px',
				'stack-sm': '16px',
				'stack-md': '32px',
				'stack-lg': '80px',
			},
			maxWidth: {
				'container': '1440px',
			},
			boxShadow: {
				// Shadows are strictly prohibited
				none: 'none',
				sm: 'none',
				DEFAULT: 'none',
				md: 'none',
				lg: 'none',
				xl: 'none',
				'2xl': 'none',
			},
		},
	},
	plugins: [],
}