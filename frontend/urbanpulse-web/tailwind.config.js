/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,jsx}'],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#eef8ff',
					100: '#d9efff',
					200: '#bce2ff',
					300: '#8fd0ff',
					400: '#5bb8ff',
					500: '#2f99ff',
					600: '#187df0',
					700: '#1364ce',
					800: '#1552a7',
					900: '#174781',
				},
				admin: {
					50: '#eef4ff',
					100: '#dfe8ff',
					200: '#c4d5ff',
					300: '#9cb7ff',
					400: '#7592ff',
					500: '#586fff',
					600: '#4450f7',
					700: '#3a40dc',
					800: '#3138b2',
					900: '#2f368c',
				},
			},
		},
	},
	plugins: [],
}