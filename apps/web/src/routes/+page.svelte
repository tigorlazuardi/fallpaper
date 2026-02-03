<script lang="ts">
	import Masonry from 'svelte-bricks';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import type { PageData } from './$types';

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
	let nsfwFilter = $state('sfw');

	const sourceLabel = $derived(sourceOptions.find((o) => o.value === sourceFilter)?.label ?? 'All Sources');
	const deviceLabel = $derived(deviceOptions.find((o) => o.value === deviceFilter)?.label ?? 'All Devices');
	const nsfwLabel = $derived(nsfwOptions.find((o) => o.value === nsfwFilter)?.label ?? 'SFW Only');

	// Transform images for masonry display
	const masonryItems = $derived(
		data.images.map((img) => ({
			id: img.id,
			src:
				img.thumbnailPath ||
				`https://picsum.photos/seed/${img.id}/${Math.min(img.width, 400)}/${Math.round((Math.min(img.width, 400) * img.height) / img.width)}`,
			title: img.title || 'Untitled',
			width: img.width,
			height: img.height,
			sourceId: img.sourceId,
			sourceName: img.source?.name,
			nsfw: img.nsfw
		}))
	);

	// Filter images based on selected filters
	const filteredItems = $derived(
		masonryItems.filter((img) => {
			if (sourceFilter !== 'all' && img.sourceId !== sourceFilter) return false;
			if (nsfwFilter === 'sfw' && img.nsfw === 1) return false;
			if (nsfwFilter === 'nsfw' && img.nsfw !== 1) return false;
			return true;
		})
	);

	let innerWidth = $state(0);

	const minColWidth = $derived(innerWidth < 640 ? 150 : 250);
	const gap = $derived(innerWidth < 640 ? 4 : 12);
</script>

<!-- Metrics -->
<section class="mb-6">
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
	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-lg font-semibold">Recent Images</h2>
		<div class="flex flex-wrap gap-2">
			<Select.Root type="single" bind:value={sourceFilter}>
				<Select.Trigger class="w-[130px]">
					{sourceLabel}
				</Select.Trigger>
				<Select.Content>
					{#each sourceOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={deviceFilter}>
				<Select.Trigger class="w-[130px]">
					{deviceLabel}
				</Select.Trigger>
				<Select.Content>
					{#each deviceOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>

			<Select.Root type="single" bind:value={nsfwFilter}>
				<Select.Trigger class="w-[110px]">
					{nsfwLabel}
				</Select.Trigger>
				<Select.Content>
					{#each nsfwOptions as option}
						<Select.Item value={option.value} label={option.label} />
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	{#if filteredItems.length > 0}
		<Masonry items={filteredItems} {minColWidth} {gap} idKey="id" animate={true}>
			{#snippet children({ item })}
				<div class="group relative overflow-hidden rounded-lg bg-card">
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
				</div>
			{/snippet}
		</Masonry>
	{:else}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No images found</p>
			<p class="text-sm text-muted-foreground/70">Add sources and run a fetch to get started</p>
		</div>
	{/if}
</section>

<svelte:window bind:innerWidth />
