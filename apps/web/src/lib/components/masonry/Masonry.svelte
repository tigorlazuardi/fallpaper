<script lang="ts" generics="T">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type MasonryLayoutType from 'masonry-layout';
	import type ImagesLoadedType from 'imagesloaded';

	interface Props {
		items: T[];
		idKey?: keyof T | ((item: T) => string | number);
		columnWidth?: number | string;
		gutter?: number;
		fitWidth?: boolean;
		percentPosition?: boolean;
		horizontalOrder?: boolean;
		class?: string;
		children: Snippet<[{ item: T; index: number }]>;
	}

	let {
		items,
		idKey = 'id' as keyof T,
		columnWidth = 250,
		gutter = 12,
		fitWidth = true,
		percentPosition = false,
		horizontalOrder = true,
		class: className = '',
		children
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let masonry: MasonryLayoutType | null = null;
	let mounted = $state(false);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let MasonryLayout: any = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let imagesLoadedFn: any = null;

	function getId(item: T): string | number {
		if (typeof idKey === 'function') return idKey(item);
		return item[idKey] as string | number;
	}

	function initMasonry() {
		if (!container || !MasonryLayout) return;

		// Destroy existing instance
		if (masonry) {
			masonry.destroy?.();
			masonry = null;
		}

		masonry = new MasonryLayout(container, {
			itemSelector: '.masonry-item',
			columnWidth: '.masonry-sizer',
			gutter,
			fitWidth,
			percentPosition,
			horizontalOrder,
			transitionDuration: '0.2s'
		});

		// Layout after images load
		if (imagesLoadedFn) {
			imagesLoadedFn(container, () => {
				masonry?.layout?.();
			});
		}
	}

	function relayout() {
		if (!masonry || !container) return;

		requestAnimationFrame(() => {
			masonry?.reloadItems?.();
			// Wait for images in new items
			if (imagesLoadedFn) {
				imagesLoadedFn(container!, () => {
					masonry?.layout?.();
				});
			} else {
				masonry?.layout?.();
			}
		});
	}

	onMount(() => {
		// Dynamic imports to avoid SSR issues
		Promise.all([import('masonry-layout'), import('imagesloaded')]).then(
			([masonryModule, imagesLoadedModule]) => {
				MasonryLayout = masonryModule.default;
				imagesLoadedFn = imagesLoadedModule.default;

				mounted = true;

				// Small delay to ensure DOM is ready
				requestAnimationFrame(() => {
					initMasonry();
				});
			}
		);

		return () => {
			masonry?.destroy?.();
			masonry = null;
		};
	});

	// Re-layout when items change
	$effect(() => {
		// Track items array
		const _len = items.length;

		if (mounted && masonry) {
			relayout();
		}
	});

	// Reinit masonry when options change (fitWidth, gutter, columnWidth)
	$effect(() => {
		// Track props
		const _fitWidth = fitWidth;
		const _gutter = gutter;
		const _columnWidth = columnWidth;

		if (mounted && MasonryLayout) {
			requestAnimationFrame(() => {
				initMasonry();
			});
		}
	});
</script>

<div bind:this={container} class="masonry-container {className}">
	<!-- Sizer element for column width -->
	<div
		class="masonry-sizer"
		style:width="{typeof columnWidth === 'number' ? columnWidth : 250}px"
	></div>

	{#each items as item, index (getId(item))}
		<div
			class="masonry-item"
			style:width="{typeof columnWidth === 'number' ? columnWidth : 250}px"
			style:margin-bottom="{gutter}px"
		>
			{@render children({ item, index })}
		</div>
	{/each}
</div>

<style>
	.masonry-container {
		margin: 0 auto;
	}

	.masonry-sizer {
		position: absolute;
		visibility: hidden;
	}
</style>
