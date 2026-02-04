<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Plus, Pencil, Trash2 } from 'lucide-svelte';
	import { SOURCE_KINDS } from '$lib/schemas/source';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleteTarget: { id: string; name: string } | null = $state(null);

	function getKindLabel(kind: string) {
		return SOURCE_KINDS.find((k) => k.value === kind)?.label ?? kind;
	}

	function getSubreddit(params: unknown): string {
		if (typeof params === 'string') {
			try {
				const parsed = JSON.parse(params);
				return parsed.subreddit || '-';
			} catch {
				return '-';
			}
		}
		if (params && typeof params === 'object' && 'subreddit' in params) {
			return (params as { subreddit: string }).subreddit;
		}
		return '-';
	}

	async function handleDelete() {
		if (!deleteTarget) return;

		const response = await fetch(`/sources/${deleteTarget.id}`, {
			method: 'DELETE'
		});

		if (response.ok) {
			window.location.reload();
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Sources</h1>
			<p class="text-muted-foreground">Manage wallpaper sources for collection.</p>
		</div>
		<Button href="/sources/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Source
		</Button>
	</div>

	{#if data.sources.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No sources configured yet.</p>
			<p class="text-sm text-muted-foreground/70">Add a source to start collecting wallpapers.</p>
			<Button href="/sources/new" class="mt-4">
				<Plus class="mr-2 h-4 w-4" />
				Add Source
			</Button>
		</div>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Type</Table.Head>
						<Table.Head>Target</Table.Head>
						<Table.Head>Lookup Limit</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-[100px]">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.sources as source}
						<Table.Row>
							<Table.Cell>
								<p class="font-medium">{source.name}</p>
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{getKindLabel(source.kind)}</Badge>
							</Table.Cell>
							<Table.Cell>
								<code class="text-xs bg-muted px-1.5 py-0.5 rounded">{getSubreddit(source.params)}</code>
							</Table.Cell>
							<Table.Cell>{source.lookupLimit}</Table.Cell>
							<Table.Cell>
								{#if source.enabled}
									<Badge variant="default">Enabled</Badge>
								{:else}
									<Badge variant="secondary">Disabled</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-2">
									<Button variant="ghost" size="icon" href="/sources/{source.id}">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => (deleteTarget = { id: source.id, name: source.name })}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>

<AlertDialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && (deleteTarget = null)}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Delete Source</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to delete "{deleteTarget?.name ?? ''}"? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDelete}>Delete</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
