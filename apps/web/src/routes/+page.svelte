<script lang="ts">
	import Masonry from 'svelte-bricks';

	// Mock data for now
	const metrics = [
		{ label: 'Images', value: 1234 },
		{ label: 'Devices', value: 3 },
		{ label: 'Sources', value: 5 },
		{ label: 'Pending Runs', value: 2 }
	];

	// Mock images with varying aspect ratios
	const images = Array.from({ length: 20 }, (_, i) => {
		// Mix of portrait, landscape, and square
		const aspects = [
			{ w: 400, h: 600 },  // portrait
			{ w: 600, h: 400 },  // landscape
			{ w: 500, h: 500 },  // square
			{ w: 800, h: 450 },  // wide landscape
			{ w: 400, h: 700 },  // tall portrait
		];
		const aspect = aspects[i % aspects.length];
		return {
			id: `img-${i}`,
			src: `https://picsum.photos/seed/${i}/${aspect.w}/${aspect.h}`,
			title: `Image ${i + 1}`,
			width: aspect.w,
			height: aspect.h,
			isLandscape: aspect.w > aspect.h
		};
	});

	let masonryItems = $state(images);
	let innerWidth = $state(0);
	
	// Responsive: smaller columns on mobile
	const minColWidth = $derived(innerWidth < 640 ? 150 : 250);
	const gap = $derived(innerWidth < 640 ? 4 : 12);
</script>

<!-- Metrics -->
<section class="mb-6">
	<div class="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-4">
		{#each metrics as metric}
			<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
				<p class="text-xs sm:text-sm text-zinc-400">{metric.label}</p>
				<p class="text-xl sm:text-2xl font-bold">{metric.value.toLocaleString()}</p>
			</div>
		{/each}
	</div>
</section>

<!-- Gallery -->
<section>
	<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<h2 class="text-lg font-semibold">Recent Images</h2>
		<div class="flex flex-wrap gap-2">
			<select class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm shrink-0">
				<option>All Sources</option>
			</select>
			<select class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm shrink-0">
				<option>All Devices</option>
			</select>
			<select class="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm shrink-0">
				<option>SFW Only</option>
				<option>All</option>
				<option>NSFW Only</option>
			</select>
		</div>
	</div>

	<Masonry
		items={masonryItems}
		minColWidth={minColWidth}
		gap={gap}
		idKey="id"
		animate={true}
	>
		{#snippet children({ item })}
			<div class="group relative overflow-hidden rounded-lg bg-zinc-900">
				<img
					src={item.src}
					alt={item.title}
					width={item.width}
					height={item.height}
					class="w-full h-auto transition-transform duration-300 group-hover:scale-105"
					loading="lazy"
				/>
				<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
					<div class="absolute bottom-0 left-0 right-0 p-3">
						<p class="text-sm font-medium">{item.title}</p>
					</div>
				</div>
			</div>
		{/snippet}
	</Masonry>
</section>

<svelte:window bind:innerWidth />
