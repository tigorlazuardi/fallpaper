<script lang="ts">
	import DeviceForm from '$lib/components/device-form.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">New Device</h1>
		<p class="text-muted-foreground">Create a new device configuration for wallpaper collection.</p>
	</div>

	<DeviceForm data={data.form} submitLabel="Create Device" />
</div>
