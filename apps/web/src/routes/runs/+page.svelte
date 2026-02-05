<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import { RefreshCw } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function getStateBadgeVariant(state: string): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (state) {
			case 'completed':
				return 'default';
			case 'running':
				return 'secondary';
			case 'failed':
				return 'destructive';
			case 'pending':
			default:
				return 'outline';
		}
	}

	function formatDate(date: Date | null | undefined): string {
		if (!date) return '-';
		return new Date(date).toLocaleString();
	}

	function formatDuration(startedAt: Date | null | undefined, completedAt: Date | null | undefined): string {
		if (!startedAt) return '-';
		const start = new Date(startedAt).getTime();
		const end = completedAt ? new Date(completedAt).getTime() : Date.now();
		const durationMs = end - start;

		if (durationMs < 1000) return `${durationMs}ms`;
		if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
		return `${(durationMs / 60000).toFixed(1)}m`;
	}

	function getProgressText(run: (typeof data.runs)[0]): string {
		if (run.progressMessage) return run.progressMessage;
		if (run.progressTotal && run.progressTotal > 0) {
			return `${run.progressCurrent ?? 0}/${run.progressTotal}`;
		}
		return '-';
	}

	function refresh() {
		window.location.reload();
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Runs</h1>
			<p class="text-muted-foreground">View execution history of source fetches.</p>
		</div>
		<Button variant="outline" onclick={refresh}>
			<RefreshCw class="mr-2 h-4 w-4" />
			Refresh
		</Button>
	</div>

	{#if data.runs.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No runs yet.</p>
			<p class="text-sm text-muted-foreground/70">Runs will appear here when sources are fetched.</p>
		</div>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>State</Table.Head>
						<Table.Head>Source</Table.Head>
						<Table.Head>Progress</Table.Head>
						<Table.Head>Started</Table.Head>
						<Table.Head>Duration</Table.Head>
						<Table.Head>Type</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.runs as run}
						<Table.Row>
							<Table.Cell>
								<Badge variant={getStateBadgeVariant(run.state)}>
									{run.state}
								</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if run.source}
									<a href="/sources/{run.source.id}" class="font-medium hover:underline">
										{run.source.name}
									</a>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm" class:text-destructive={run.state === 'failed'}>
									{getProgressText(run)}
								</span>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm text-muted-foreground">
									{formatDate(run.startedAt)}
								</span>
							</Table.Cell>
							<Table.Cell>
								<span class="text-sm">
									{formatDuration(run.startedAt, run.completedAt)}
								</span>
							</Table.Cell>
							<Table.Cell>
								{#if run.schedule}
									<Badge variant="outline">Scheduled</Badge>
								{:else}
									<Badge variant="secondary">Manual</Badge>
								{/if}
							</Table.Cell>
						</Table.Row>
						{#if run.error}
							<Table.Row>
								<Table.Cell colspan={6} class="bg-destructive/5">
									<p class="text-xs text-destructive font-mono">{run.error}</p>
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
		<p class="text-xs text-muted-foreground text-center">
			Showing {data.runs.length} most recent runs
		</p>
	{/if}
</div>
