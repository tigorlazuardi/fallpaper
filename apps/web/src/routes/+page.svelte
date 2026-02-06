<script lang="ts">
	import Masonry from '$lib/components/masonry/Masonry.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { ImageModal, type ImageModalData } from '$lib/components/image-modal';
	import type { PageData } from './$types';
	import type { GalleryImage } from './+page.server';

	let { data }: { data: PageData } = $props();

	// Metrics from server
	const metrics = $derived([
		{ label: 'Images', value: data.metrics.images },
		{ label: 'Devices', value: data.metrics.devices },
		{ label: 'Sources', value: data.metrics.sources },
		{ label: 'Pending Runs', value: data.metrics.pendingRuns }
	]);

	// Filter options from server
	const sourceOptions = $derived([
		{ value: 'all', label: 'All Sources' },
		...data.filterOptions.sources.map((s) => ({ value: s.id, label: s.name }))
	]);

	const deviceOptions = $derived([
		{ value: 'all', label: 'All Devices' },
		...data.filterOptions.devices.map((d) => ({ value: d.id, label: d.name }))
	]);

	const nsfwOptions = [
		{ value: 'sfw', label: 'SFW Only' },
		{ value: 'all', label: 'All' },
		{ value: 'nsfw', label: 'NSFW Only' }
	];

	let sourceFilter = $state('all');
	let deviceFilter = $state('all');
	let nsfwFilter = $state<'sfw' | 'all' | 'nsfw'>('sfw');

	const sourceLabel = $derived(
		sourceOptions.find((o) => o.value === sourceFilter)?.label ?? 'All Sources'
	);
	const deviceLabel = $derived(
		deviceOptions.find((o) => o.value === deviceFilter)?.label ?? 'All Devices'
	);
	const nsfwLabel = $derived(nsfwOptions.find((o) => o.value === nsfwFilter)?.label ?? 'SFW Only');

	// Pagination state - intentionally capture initial value, data is managed via fetchImages()
	// svelte-ignore state_referenced_locally
	let allImages = $state<GalleryImage[]>([...data.images]);
	// svelte-ignore state_referenced_locally
	let nextCursor = $state<string | null>(data.nextCursor);
	let isLoading = $state(false);
	let loadError = $state<string | null>(null);

	// Sentinel element for infinite scroll
	let sentinelEl: HTMLDivElement | undefined = $state();

	// Image modal state
	let modalOpen = $state(false);
	let selectedImage = $state<ImageModalData | null>(null);

	// Type for image with deviceImages relation
	type ImageWithDevices = GalleryImage & {
		deviceImages?: Array<{
			localPath: string;
			device?: { slug: string } | null;
		}>;
	};

	// Helper to build image URL from deviceImages relation
	function getImageUrl(img: ImageWithDevices): string {
		const deviceImage = img.deviceImages?.[0];
		if (deviceImage?.device?.slug && deviceImage.localPath) {
			const filename = deviceImage.localPath.split('/').pop();
			if (filename) {
				return `/api/images/${deviceImage.device.slug}/${filename}`;
			}
		}
		return `https://picsum.photos/seed/${img.id}/${Math.min(img.width, 400)}/${Math.round((Math.min(img.width, 400) * img.height) / img.width)}`;
	}

	// Transform images for masonry display
	const masonryItems = $derived(
		(allImages as ImageWithDevices[]).map((img) => ({
			id: img.id,
			src: getImageUrl(img),
			title: img.title || 'Untitled',
			width: img.width,
			height: img.height,
			sourceId: img.sourceId,
			sourceName: img.source?.name,
			nsfw: img.nsfw,
			deviceSlug: img.deviceImages?.[0]?.device?.slug,
			// Additional metadata for modal
			author: img.author,
			authorUrl: img.authorUrl,
			websiteUrl: img.websiteUrl,
			filesize: img.filesize,
			format: img.format,
			sourceCreatedAt: img.sourceCreatedAt
		}))
	);

	// Open image modal
	function openImageModal(item: (typeof masonryItems)[number]) {
		selectedImage = {
			id: item.id,
			src: item.src,
			fullSrc: item.src, // Same URL for now, could be different for thumbnails
			title: item.title,
			width: item.width,
			height: item.height,
			filesize: item.filesize ?? undefined,
			format: item.format ?? undefined,
			nsfw: item.nsfw ?? undefined,
			author: item.author ?? undefined,
			authorUrl: item.authorUrl ?? undefined,
			sourceName: item.sourceName ?? undefined,
			websiteUrl: item.websiteUrl ?? undefined,
			sourceCreatedAt: item.sourceCreatedAt ?? undefined
		};
		modalOpen = true;
	}

	// Build query params for API calls
	function buildQueryParams(cursor?: string | null): URLSearchParams {
		const params = new URLSearchParams();
		if (cursor) params.set('cursor', cursor);
		if (sourceFilter !== 'all') params.set('sourceId', sourceFilter);
		if (deviceFilter !== 'all') params.set('deviceId', deviceFilter);
		params.set('nsfw', nsfwFilter);
		return params;
	}

	// Fetch images from API
	async function fetchImages(cursor?: string | null, append = false) {
		if (isLoading) return;

		isLoading = true;
		loadError = null;

		try {
			const params = buildQueryParams(cursor);
			const res = await fetch(`/api/gallery?${params.toString()}`);
			if (!res.ok) {
				throw new Error(`Failed to load: ${res.status}`);
			}

			const result = await res.json();

			if (append) {
				allImages = [...allImages, ...result.images];
			} else {
				allImages = result.images;
			}
			nextCursor = result.nextCursor;
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Failed to load images';
			console.error('Failed to load images:', err);
		} finally {
			isLoading = false;
		}
	}

	// Load more (append to existing)
	function loadMore() {
		if (!nextCursor || isLoading) return;
		fetchImages(nextCursor, true);
	}

	// Track previous filter values (non-reactive to avoid effect loops)
	let prevSource = 'all';
	let prevDevice = 'all';
	let prevNsfw: 'sfw' | 'all' | 'nsfw' = 'sfw';

	// Reset and reload when filters change (skip initial mount)
	$effect(() => {
		// Read current filter values (these are tracked by the effect)
		const currentSource = sourceFilter;
		const currentDevice = deviceFilter;
		const currentNsfw = nsfwFilter;

		// Check if filters actually changed from previous values
		const changed =
			currentSource !== prevSource ||
			currentDevice !== prevDevice ||
			currentNsfw !== prevNsfw;

		if (changed) {
			// Update previous values (non-reactive, won't trigger effect)
			prevSource = currentSource;
			prevDevice = currentDevice;
			prevNsfw = currentNsfw;
			// Fetch fresh data with new filters
			fetchImages(null, false);
		}
	});

	// Setup IntersectionObserver for infinite scroll
	$effect(() => {
		if (!sentinelEl) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && nextCursor && !isLoading) {
					loadMore();
				}
			},
			{
				rootMargin: '200px' // Start loading before reaching the end
			}
		);

		observer.observe(sentinelEl);

		return () => observer.disconnect();
	});

	let innerWidth = $state(0);

	const gap = $derived(innerWidth < 640 ? 4 : 12);
	// On mobile: calculate exact width for 2 columns to fill screen
	// On desktop: use fixed min width
	const minColWidth = $derived(
		innerWidth < 640 ? Math.floor((innerWidth - gap) / 2) : 250
	);
	const fitWidth = $derived(innerWidth >= 640);
</script>

<!-- Metrics -->
<section class="mb-6 px-4 sm:px-0">
	<div class="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
		{#each metrics as metric}
			<Card.Root>
				<Card.Content class="p-3 sm:p-4">
					<p class="text-xs sm:text-sm text-muted-foreground">{metric.label}</p>
					<p class="text-xl sm:text-2xl font-bold">
						{metric.value.toLocaleString()}
					</p>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>
</section>

<!-- Gallery -->
<section>
	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-0 overflow-hidden">
		<h2 class="text-lg font-semibold shrink-0">Recent Images (Last 72h)</h2>
		<div class="flex flex-wrap gap-2 min-w-0">
			<Select.Root type="single" bind:value={sourceFilter}>
				<Select.Trigger class="min-w-[120px] max-w-[180px]">
					<span class="truncate">{sourceLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each sourceOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={deviceFilter}>
				<Select.Trigger class="min-w-[120px] max-w-[200px]">
					<span class="truncate">{deviceLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each deviceOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={nsfwFilter}>
				<Select.Trigger class="w-[100px]">
					<span class="truncate">{nsfwLabel}</span>
				</Select.Trigger>
				<Select.Content>
					{#each nsfwOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	{#if masonryItems.length > 0}
		<Masonry items={masonryItems} columnWidth={minColWidth} gutter={gap} idKey="id" {fitWidth}>
			{#snippet children({ item })}
				<button
					type="button"
					class="group relative overflow-hidden rounded-lg bg-card cursor-pointer w-full text-left"
					onclick={() => openImageModal(item)}
				>
					<img
						src={item.src}
						alt={item.title}
						width={item.width}
						height={item.height}
						class="w-full h-auto transition-transform duration-300 group-hover:scale-105"
						loading="lazy"
					/>
					<div
						class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
					>
						<div class="absolute bottom-0 left-0 right-0 p-3">
							<p class="text-sm font-medium text-white">{item.title}</p>
							{#if item.sourceName}
								<p class="text-xs text-white/70">{item.sourceName}</p>
							{/if}
						</div>
					</div>
				</button>
			{/snippet}
		</Masonry>

		<!-- Sentinel for infinite scroll -->
		<div bind:this={sentinelEl} class="h-4"></div>

		<!-- Loading indicator -->
		{#if isLoading}
			<div class="flex justify-center py-8">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				></div>
			</div>
		{/if}

		<!-- Error message -->
		{#if loadError}
			<div class="py-4 text-center text-destructive">
				<p>{loadError}</p>
				<button class="mt-2 text-sm underline" onclick={loadMore}>Try again</button>
			</div>
		{/if}

		<!-- End of results -->
		{#if !nextCursor && !isLoading}
			<p class="py-8 text-center text-muted-foreground">No more images</p>
		{/if}
	{:else if isLoading}
		<div class="flex justify-center py-16">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
			></div>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No images found</p>
			<p class="text-sm text-muted-foreground/70">
				{#if sourceFilter !== 'all' || deviceFilter !== 'all' || nsfwFilter !== 'sfw'}
					Try adjusting your filters
				{:else}
					Add sources and run a fetch to get started
				{/if}
			</p>
		</div>
	{/if}
</section>

<svelte:window bind:innerWidth />

<!-- Image Modal -->
<ImageModal bind:open={modalOpen} image={selectedImage} />
