<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import Sidebar from '$lib/components/layout/sidebar.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Menu } from 'lucide-svelte';

	let { children } = $props();

	let mobileMenuOpen = $state(false);

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Fallpaper</title>
</svelte:head>

<div class="dark min-h-screen bg-background text-foreground">
	<!-- Desktop Sidebar -->
	<aside class="fixed inset-y-0 left-0 z-50 hidden w-56 border-r border-border bg-background md:block">
		<Sidebar />
	</aside>

	<!-- Mobile Header -->
	<header class="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-sm px-4 md:hidden">
		<Sheet.Root bind:open={mobileMenuOpen}>
			<Sheet.Trigger>
				{#snippet child({ props })}
					<Button variant="ghost" size="icon" {...props}>
						<Menu class="h-5 w-5" />
						<span class="sr-only">Toggle menu</span>
					</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content side="left" class="w-56 p-0">
				<Sidebar onNavigate={closeMobileMenu} />
			</Sheet.Content>
		</Sheet.Root>
		<span class="ml-2 text-lg font-bold">Fallpaper</span>
	</header>

	<!-- Main content -->
	<main class="min-h-screen md:pl-56">
		<div class="sm:px-4 py-6 max-w-7xl mx-auto">
			{@render children()}
		</div>
	</main>
</div>
