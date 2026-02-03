<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Fallpaper</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden">
	<!-- Header -->
	<header class="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
		<div class="px-4 max-w-7xl mx-auto">
			<div class="flex h-14 items-center justify-between">
				<a href="/" class="text-xl font-bold shrink-0">Fallpaper</a>
				<nav class="flex items-center gap-4 sm:gap-6">
					<a href="/" class="text-sm text-zinc-400 hover:text-zinc-100">Gallery</a>
					<a href="/devices" class="text-sm text-zinc-400 hover:text-zinc-100">Devices</a>
					<a href="/sources" class="text-sm text-zinc-400 hover:text-zinc-100">Sources</a>
					<a href="/runs" class="text-sm text-zinc-400 hover:text-zinc-100">Runs</a>
				</nav>
			</div>
		</div>
	</header>

	<!-- Main content -->
	<main class="px-2 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
		{@render children()}
	</main>
</div>
