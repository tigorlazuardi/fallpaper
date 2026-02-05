<script lang="ts">
	import SourceForm from '$lib/components/source-form.svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isRunning = $state(false);
	let runResult = $state<{ success: boolean; message: string } | null>(null);

	async function triggerManualRun() {
		isRunning = true;
		runResult = null;

		try {
			const response = await fetch('/api/runs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sourceId: data.source.id, immediate: true })
			});

			const result = await response.json();

			if (response.ok) {
				runResult = { success: true, message: `Run created successfully (ID: ${result.run.id})` };
			} else {
				runResult = { success: false, message: result.error || 'Failed to create run' };
			}
		} catch (err) {
			runResult = { success: false, message: 'Network error occurred' };
		} finally {
			isRunning = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold">Edit Source</h1>
			<p class="text-muted-foreground">Update configuration for {data.source.name}.</p>
		</div>
		<Button onclick={triggerManualRun} disabled={isRunning || !data.source.enabled} variant="outline">
			{#if isRunning}
				Running...
			{:else}
				Run Now
			{/if}
		</Button>
	</div>

	{#if runResult}
		<div
			class="rounded-md border px-4 py-3 text-sm {runResult.success
				? 'border-green-500/50 bg-green-500/10 text-green-600'
				: 'border-destructive/50 bg-destructive/10 text-destructive'}"
		>
			{runResult.message}
		</div>
	{/if}

	{#if !data.source.enabled}
		<div class="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
			This source is disabled. Enable it to run manually.
		</div>
	{/if}

	<SourceForm data={data.form} devices={data.devices} submitLabel="Save Changes" />
</div>
