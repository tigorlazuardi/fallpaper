<script lang="ts">
	import DeviceForm from '$lib/components/device-form.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Edit Device</h1>
		<p class="text-muted-foreground">Update configuration for {data.device.name}.</p>
	</div>

	<DeviceForm data={data.form} submitLabel="Save Changes" />
</div>
