<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Plus, Pencil, Trash2 } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleteTarget: { id: string; name: string } | null = $state(null);

	function getNsfwLabel(nsfw: number) {
		switch (nsfw) {
			case 0:
				return 'Accept All';
			case 1:
				return 'SFW Only';
			case 2:
				return 'NSFW Only';
			default:
				return 'Unknown';
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;

		const response = await fetch(`/devices/${deleteTarget.id}`, {
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
			<h1 class="text-2xl font-bold">Devices</h1>
			<p class="text-muted-foreground">Manage your device configurations for wallpaper collection.</p>
		</div>
		<Button href="/devices/new">
			<Plus class="mr-2 h-4 w-4" />
			Add Device
		</Button>
	</div>

	{#if data.devices.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<p class="text-muted-foreground">No devices configured yet.</p>
			<p class="text-sm text-muted-foreground/70">Add a device to start collecting wallpapers.</p>
			<Button href="/devices/new" class="mt-4">
				<Plus class="mr-2 h-4 w-4" />
				Add Device
			</Button>
		</div>
	{:else}
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Resolution</Table.Head>
						<Table.Head>Aspect Ratio Deviation</Table.Head>
						<Table.Head>NSFW</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="w-[100px]">Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.devices as device}
						<Table.Row>
							<Table.Cell>
								<div>
									<p class="font-medium">{device.name}</p>
									<p class="text-xs text-muted-foreground">{device.slug}</p>
								</div>
							</Table.Cell>
							<Table.Cell>{device.width} x {device.height}</Table.Cell>
							<Table.Cell>{device.aspectRatioDeviation}</Table.Cell>
							<Table.Cell>{getNsfwLabel(device.nsfw)}</Table.Cell>
							<Table.Cell>
								{#if device.enabled}
									<Badge variant="default">Enabled</Badge>
								{:else}
									<Badge variant="secondary">Disabled</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-2">
									<Button variant="ghost" size="icon" href="/devices/{device.id}">
										<Pencil class="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onclick={() => (deleteTarget = { id: device.id, name: device.name })}
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
			<AlertDialog.Title>Delete Device</AlertDialog.Title>
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
