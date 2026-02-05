<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { superForm, type SuperValidated } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import {
		redditSourceSchema,
		SCHEDULE_PRESETS,
		REDDIT_SORT_OPTIONS,
		REDDIT_TOP_PERIOD_OPTIONS,
		type RedditSourceFormData
	} from '$lib/schemas/source';
	import { Play, Plus, X } from 'lucide-svelte';
	import type { Device } from '@packages/database';

	type Props = {
		data: SuperValidated<RedditSourceFormData>;
		devices: Device[];
		submitLabel: string;
		showFetchNow?: boolean;
	};

	let { data, devices, submitLabel, showFetchNow = true }: Props = $props();

	const superFormResult = untrack(() =>
		superForm(data, {
			dataType: 'json',
			validators: zod4Client(redditSourceSchema),
			validationMethod: 'onblur'
		})
	);

	const { form, errors, message, enhance, submitting } = superFormResult;

	// Action state for submit buttons
	let submitAction = $state<string | undefined>(undefined);

	// Schedule management
	let newScheduleMode = $state<'preset' | 'custom'>('preset');
	let newSchedulePreset = $state('');
	let newScheduleCustom = $state('');

	function getPresetLabel(cron: string): string {
		const preset = SCHEDULE_PRESETS.find((p) => p.value === cron);
		return preset?.label || cron;
	}

	function addSchedule() {
		const scheduleToAdd = newScheduleMode === 'custom' ? newScheduleCustom : newSchedulePreset;
		if (scheduleToAdd && !$form.schedules.includes(scheduleToAdd)) {
			$form.schedules = [...$form.schedules, scheduleToAdd];
		}
		// Reset
		newSchedulePreset = '';
		newScheduleCustom = '';
		newScheduleMode = 'preset';
	}

	function removeSchedule(index: number) {
		$form.schedules = $form.schedules.filter((_, i) => i !== index);
	}

	function handleNewSchedulePresetChange(value: string) {
		if (value === '__custom__') {
			newScheduleMode = 'custom';
			newSchedulePreset = '';
		} else {
			newScheduleMode = 'preset';
			newSchedulePreset = value;
		}
	}

	const newSchedulePresetLabel = $derived(() => {
		if (newScheduleMode === 'custom') return 'Custom...';
		if (!newSchedulePreset) return 'Select schedule...';
		return getPresetLabel(newSchedulePreset);
	});

	// Device subscription handling
	function toggleDevice(deviceId: string, checked: boolean) {
		if (checked) {
			if (!$form.deviceIds.includes(deviceId)) {
				$form.deviceIds = [...$form.deviceIds, deviceId];
			}
		} else {
			$form.deviceIds = $form.deviceIds.filter((id) => id !== deviceId);
		}
	}

	function isDeviceSelected(deviceId: string): boolean {
		return $form.deviceIds.includes(deviceId);
	}
</script>

<form method="POST" use:enhance class="space-y-6">
	{#if $message}
		<div class="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
			{$message}
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Basic Information</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="flex items-center gap-4">
				<Switch bind:checked={$form.enabled} id="enabled" name="enabled" />
				<Label for="enabled">Enabled</Label>
			</div>

			<div class="space-y-2">
				<Label for="name">Name <span class="text-destructive">*</span></Label>
				<Input
					id="name"
					name="name"
					bind:value={$form.name}
					placeholder="My Reddit Source"
					aria-invalid={$errors.name ? 'true' : undefined}
				/>
				{#if $errors.name}
					<p class="text-xs text-destructive">{$errors.name}</p>
				{/if}
			</div>

			<!-- Hidden kind field -->
			<input type="hidden" name="kind" value={$form.kind} />
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Reddit Configuration</Card.Title>
			<Card.Description>Configure the Reddit source to fetch wallpapers from.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="subreddit">Subreddit / User <span class="text-destructive">*</span></Label>
				<Input
					id="subreddit"
					name="subreddit"
					bind:value={$form.subreddit}
					placeholder="/r/wallpapers"
					aria-invalid={$errors.subreddit ? 'true' : undefined}
				/>
				<p class="text-xs text-muted-foreground">
					Format: <code class="bg-muted px-1 rounded">/r/subreddit</code>,
					<code class="bg-muted px-1 rounded">/user/username</code>, or
					<code class="bg-muted px-1 rounded">/u/username</code>
				</p>
				{#if $errors.subreddit}
					<p class="text-xs text-destructive">{$errors.subreddit}</p>
				{/if}
			</div>

			<div class="grid gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<Label for="sort">Sort By</Label>
					<Select.Root type="single" bind:value={$form.sort} name="sort">
						<Select.Trigger id="sort">
							{REDDIT_SORT_OPTIONS.find((o) => o.value === $form.sort)?.label || 'Select...'}
						</Select.Trigger>
						<Select.Content>
							{#each REDDIT_SORT_OPTIONS as option}
								<Select.Item value={option.value} label={option.label} />
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				{#if $form.sort === 'top'}
					<div class="space-y-2">
						<Label for="topPeriod">Time Period</Label>
						<Select.Root type="single" bind:value={$form.topPeriod} name="topPeriod">
							<Select.Trigger id="topPeriod">
								{REDDIT_TOP_PERIOD_OPTIONS.find((o) => o.value === $form.topPeriod)?.label || 'Select...'}
							</Select.Trigger>
							<Select.Content>
								{#each REDDIT_TOP_PERIOD_OPTIONS as option}
									<Select.Item value={option.value} label={option.label} />
								{/each}
							</Select.Content>
						</Select.Root>
					</div>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="lookupLimit">Lookup Limit <span class="text-destructive">*</span></Label>
				<Input
					id="lookupLimit"
					name="lookupLimit"
					type="number"
					bind:value={$form.lookupLimit}
					placeholder="300"
					min="1"
					max="1000"
					aria-invalid={$errors.lookupLimit ? 'true' : undefined}
				/>
				<p class="text-xs text-muted-foreground">
					Maximum number of posts to check for images (not the number of images to download).
				</p>
				{#if $errors.lookupLimit}
					<p class="text-xs text-destructive">{$errors.lookupLimit}</p>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Device Subscriptions</Card.Title>
			<Card.Description>Select which devices should receive wallpapers from this source.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if devices.length === 0}
				<p class="text-sm text-muted-foreground">
					No devices configured yet. <a href="/devices/new" class="text-primary underline">Create a device</a> first.
				</p>
			{:else}
				<div class="space-y-3">
					{#each devices as device}
						<div class="flex items-center gap-3">
							<Checkbox
								id="device-{device.id}"
								checked={isDeviceSelected(device.id)}
								onCheckedChange={(checked) => toggleDevice(device.id, checked === true)}
							/>
							<Label for="device-{device.id}" class="flex-1 cursor-pointer">
								<span class="font-medium">{device.name}</span>
								<span class="text-muted-foreground text-sm ml-2">
									({device.width}x{device.height})
								</span>
							</Label>
						</div>
					{/each}
				</div>
				<!-- Hidden inputs for device IDs -->
				{#each $form.deviceIds as deviceId}
					<input type="hidden" name="deviceIds" value={deviceId} />
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Schedules</Card.Title>
			<Card.Description>Configure when to automatically fetch wallpapers. You can add multiple schedules.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- Current schedules -->
			{#if $form.schedules.length > 0}
				<div class="space-y-2">
					<Label>Active Schedules</Label>
					<div class="space-y-2">
						{#each $form.schedules as schedule, index}
							<div class="flex items-center gap-2 p-2 bg-muted rounded-md">
								<span class="flex-1 text-sm">
									<span class="font-medium">{getPresetLabel(schedule)}</span>
									{#if !SCHEDULE_PRESETS.some((p) => p.value === schedule)}
										<code class="ml-2 text-xs bg-background px-1 rounded">{schedule}</code>
									{/if}
								</span>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="h-6 w-6"
									onclick={() => removeSchedule(index)}
								>
									<X class="h-4 w-4" />
								</Button>
								<input type="hidden" name="schedules" value={schedule} />
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Add new schedule -->
			<div class="space-y-2">
				<Label>Add Schedule</Label>
				<p class="text-xs text-muted-foreground">
					Select a schedule and press the + button to add it to the list. Schedules won't be saved until added.
				</p>
				<div class="flex gap-2">
					<Select.Root
						type="single"
						value={newScheduleMode === 'custom' ? '__custom__' : newSchedulePreset}
						onValueChange={handleNewSchedulePresetChange}
					>
						<Select.Trigger class="flex-1 sm:w-[280px] sm:flex-none">
							{newSchedulePresetLabel()}
						</Select.Trigger>
						<Select.Content>
							{#each SCHEDULE_PRESETS.filter((p) => p.value !== '') as preset}
								<Select.Item value={preset.value} label={preset.label} />
							{/each}
							<Select.Item value="__custom__" label="Custom..." />
						</Select.Content>
					</Select.Root>

					{#if newScheduleMode === 'custom'}
						<Input
							bind:value={newScheduleCustom}
							placeholder="0 */6 * * *"
							class="flex-1"
						/>
					{/if}

					<Button
						type="button"
						variant="outline"
						size="icon"
						onclick={addSchedule}
						disabled={newScheduleMode === 'preset' ? !newSchedulePreset : !newScheduleCustom}
					>
						<Plus class="h-4 w-4" />
					</Button>
				</div>
				{#if newScheduleMode === 'custom'}
					<p class="text-xs text-muted-foreground">
						Cron syntax: <code class="bg-muted px-1 rounded">minute hour day month weekday</code>
					</p>
				{/if}
			</div>

			{#if $form.schedules.length === 0}
				<p class="text-sm text-muted-foreground">
					No schedules configured. You can manually trigger fetches from the sources list.
				</p>
			{/if}
		</Card.Content>
	</Card.Root>

	<input type="hidden" name="submitAction" value={submitAction ?? ''} />

	<div class="flex flex-wrap gap-4">
		<Button type="submit" disabled={$submitting} onclick={() => (submitAction = undefined)}>
			{$submitting ? 'Saving...' : submitLabel}
		</Button>
		{#if showFetchNow}
			<Button
				type="submit"
				variant="secondary"
				disabled={$submitting}
				onclick={() => (submitAction = 'create_and_fetch')}
			>
				<Play class="mr-2 h-4 w-4" />
				{submitLabel === 'Create Source' ? 'Create and Fetch Now' : 'Save and Fetch Now'}
			</Button>
		{/if}
		<Button type="button" variant="outline" href="/sources">Cancel</Button>
	</div>
</form>
