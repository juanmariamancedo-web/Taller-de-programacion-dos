/// <reference types="vite/client" />

declare module '*.png?asset' {
	const source: string
	export default source
}
