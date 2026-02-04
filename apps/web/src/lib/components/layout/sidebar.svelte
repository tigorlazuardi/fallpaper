<script lang="ts">
	import { page } from '$app/stores';
	import { Images, Monitor, Database, Play } from 'lucide-svelte';

	type Props = {
		onNavigate?: () => void;
	};

	let { onNavigate }: Props = $props();

	const navItems = [
		{ href: '/', label: 'Gallery', icon: Images },
		{ href: '/devices', label: 'Devices', icon: Monitor },
		{ href: '/sources', label: 'Sources', icon: Database },
		{ href: '/runs', label: 'Runs', icon: Play }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') {
			return pathname === '/';
		}
		return pathname.startsWith(href);
	}

	function handleClick() {
		onNavigate?.();
	}
</script>

<div class="flex h-full flex-col">
	<!-- Logo -->
	<div class="flex h-14 items-center border-b border-border px-4">
		<a href="/" class="text-xl font-bold" onclick={handleClick}>Fallpaper</a>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 space-y-1 p-2">
		{#each navItems as item}
			{@const active = isActive(item.href, $page.url.pathname)}
			<a
				href={item.href}
				onclick={handleClick}
				class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors {active
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
			>
				<item.icon class="h-4 w-4" />
				{item.label}
			</a>
		{/each}
	</nav>
</div>
