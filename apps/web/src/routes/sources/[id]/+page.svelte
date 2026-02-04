<script lang="ts">
	import SourceForm from '$lib/components/source-form.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Edit Source</h1>
		<p class="text-muted-foreground">Update configuration for {data.source.name}.</p>
	</div>

	<SourceForm data={data.form} devices={data.devices} submitLabel="Save Changes" />
</div>
