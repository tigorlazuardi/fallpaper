<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Use $derived to ensure reactivity when data changes (e.g., after form submission)
	const superFormResult = $derived(superForm(data.form));
	const form = $derived(superFormResult.form);
	const errors = $derived(superFormResult.errors);
	const message = $derived(superFormResult.message);
	const enhance = $derived(superFormResult.enhance);

	// Helper to format ms to human readable
	function msToMinutes(ms: number): number {
		return Math.round(ms / 60000);
	}

	function minutesToMs(minutes: number): number {
		return minutes * 60000;
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold">Settings</h1>
		<p class="text-muted-foreground">
			Configure application settings. Changes are saved to:
			<code class="bg-muted px-1 rounded text-sm">{data.configPath}</code>
		</p>
		{#if !data.fileExists}
			<p class="text-sm text-yellow-600 mt-1">Config file does not exist yet. It will be created when you save.</p>
		{/if}
	</div>

	{#if $message}
		<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
			{$message}
		</div>
	{/if}

	<form method="POST" action="?/save" use:enhance class="space-y-6">
		<!-- Database Section -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Database</Card.Title>
				<Card.Description>SQLite database configuration</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="database.path">Database Path</Label>
					<Input
						id="database.path"
						name="database.path"
						bind:value={$form.database.path}
						placeholder={data.defaults.database.path}
					/>
					{#if $errors.database?.path}
						<p class="text-sm text-red-500">{$errors.database.path}</p>
					{/if}
					<p class="text-sm text-muted-foreground">Path to SQLite database file</p>
				</div>

				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label for="database.logging">Query Logging</Label>
						<p class="text-sm text-muted-foreground">Enable database query logging</p>
					</div>
					<input type="hidden" name="database.logging" value={$form.database.logging.toString()} />
					<Switch
						id="database.logging"
						checked={$form.database.logging}
						onCheckedChange={(v) => ($form.database.logging = v)}
					/>
				</div>

				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label for="database.tracing">OpenTelemetry Tracing</Label>
						<p class="text-sm text-muted-foreground">Enable OTEL tracing for queries</p>
					</div>
					<input type="hidden" name="database.tracing" value={$form.database.tracing.toString()} />
					<Switch
						id="database.tracing"
						checked={$form.database.tracing}
						onCheckedChange={(v) => ($form.database.tracing = v)}
					/>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Scheduler Section -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Scheduler</Card.Title>
				<Card.Description>Run processor and retry configuration</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="scheduler.pollCron">Poll Cron Expression</Label>
					<Input
						id="scheduler.pollCron"
						name="scheduler.pollCron"
						bind:value={$form.scheduler.pollCron}
						placeholder={data.defaults.scheduler.pollCron}
					/>
					{#if $errors.scheduler?.pollCron}
						<p class="text-sm text-red-500">{$errors.scheduler.pollCron}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Cron expression for run processor polling (default: every minute)
					</p>
				</div>

				<div class="space-y-2">
					<Label for="scheduler.staleRunTimeoutMs">Stale Run Timeout (minutes)</Label>
					<Input
						id="scheduler.staleRunTimeoutMinutes"
						type="number"
						min="1"
						value={msToMinutes($form.scheduler.staleRunTimeoutMs)}
						onchange={(e) => ($form.scheduler.staleRunTimeoutMs = minutesToMs(parseInt(e.currentTarget.value)))}
					/>
					<input type="hidden" name="scheduler.staleRunTimeoutMs" value={$form.scheduler.staleRunTimeoutMs} />
					{#if $errors.scheduler?.staleRunTimeoutMs}
						<p class="text-sm text-red-500">{$errors.scheduler.staleRunTimeoutMs}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Time before a running job is considered stuck (default: 30 min)
					</p>
				</div>

				<div class="space-y-2">
					<Label for="scheduler.maxPendingRunsPerPoll">Max Runs Per Poll</Label>
					<Input
						id="scheduler.maxPendingRunsPerPoll"
						name="scheduler.maxPendingRunsPerPoll"
						type="number"
						min="1"
						max="100"
						bind:value={$form.scheduler.maxPendingRunsPerPoll}
					/>
					{#if $errors.scheduler?.maxPendingRunsPerPoll}
						<p class="text-sm text-red-500">{$errors.scheduler.maxPendingRunsPerPoll}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Maximum pending runs to process per poll cycle (default: 10)
					</p>
				</div>

				<div class="space-y-2">
					<Label for="scheduler.retryBackoffBaseMs">Retry Backoff Base (minutes)</Label>
					<Input
						id="scheduler.retryBackoffBaseMinutes"
						type="number"
						min="1"
						value={msToMinutes($form.scheduler.retryBackoffBaseMs)}
						onchange={(e) => ($form.scheduler.retryBackoffBaseMs = minutesToMs(parseInt(e.currentTarget.value)))}
					/>
					<input type="hidden" name="scheduler.retryBackoffBaseMs" value={$form.scheduler.retryBackoffBaseMs} />
					{#if $errors.scheduler?.retryBackoffBaseMs}
						<p class="text-sm text-red-500">{$errors.scheduler.retryBackoffBaseMs}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Base delay for exponential retry backoff (default: 1 min)
					</p>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Runner Section -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Runner</Card.Title>
				<Card.Description>Image download and processing configuration</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="runner.imageDir">Image Directory</Label>
					<Input
						id="runner.imageDir"
						name="runner.imageDir"
						bind:value={$form.runner.imageDir}
						placeholder={data.defaults.runner.imageDir}
					/>
					{#if $errors.runner?.imageDir}
						<p class="text-sm text-red-500">{$errors.runner.imageDir}</p>
					{/if}
					<p class="text-sm text-muted-foreground">Directory for storing downloaded images</p>
				</div>

				<div class="space-y-2">
					<Label for="runner.tempDir">Temp Directory</Label>
					<Input
						id="runner.tempDir"
						name="runner.tempDir"
						bind:value={$form.runner.tempDir}
						placeholder={data.defaults.runner.tempDir}
					/>
					{#if $errors.runner?.tempDir}
						<p class="text-sm text-red-500">{$errors.runner.tempDir}</p>
					{/if}
					<p class="text-sm text-muted-foreground">Temporary directory for downloads in progress</p>
				</div>

				<div class="space-y-2">
					<Label for="runner.maxConcurrentDownloads">Max Concurrent Downloads</Label>
					<Input
						id="runner.maxConcurrentDownloads"
						name="runner.maxConcurrentDownloads"
						type="number"
						min="1"
						max="20"
						bind:value={$form.runner.maxConcurrentDownloads}
					/>
					{#if $errors.runner?.maxConcurrentDownloads}
						<p class="text-sm text-red-500">{$errors.runner.maxConcurrentDownloads}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Maximum parallel downloads (default: 5)
					</p>
				</div>

				<div class="space-y-2">
					<Label for="runner.minSpeedBytesPerSec">Min Download Speed (KB/s)</Label>
					<Input
						id="runner.minSpeedKBps"
						type="number"
						min="1"
						value={Math.round($form.runner.minSpeedBytesPerSec / 1024)}
						onchange={(e) => ($form.runner.minSpeedBytesPerSec = parseInt(e.currentTarget.value) * 1024)}
					/>
					<input type="hidden" name="runner.minSpeedBytesPerSec" value={$form.runner.minSpeedBytesPerSec} />
					{#if $errors.runner?.minSpeedBytesPerSec}
						<p class="text-sm text-red-500">{$errors.runner.minSpeedBytesPerSec}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Minimum speed before download is considered slow (default: 10 KB/s)
					</p>
				</div>

				<div class="space-y-2">
					<Label for="runner.slowSpeedTimeoutMs">Slow Speed Timeout (seconds)</Label>
					<Input
						id="runner.slowSpeedTimeoutSeconds"
						type="number"
						min="1"
						value={Math.round($form.runner.slowSpeedTimeoutMs / 1000)}
						onchange={(e) => ($form.runner.slowSpeedTimeoutMs = parseInt(e.currentTarget.value) * 1000)}
					/>
					<input type="hidden" name="runner.slowSpeedTimeoutMs" value={$form.runner.slowSpeedTimeoutMs} />
					{#if $errors.runner?.slowSpeedTimeoutMs}
						<p class="text-sm text-red-500">{$errors.runner.slowSpeedTimeoutMs}</p>
					{/if}
					<p class="text-sm text-muted-foreground">
						Abort slow downloads after this duration (default: 30 sec)
					</p>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Actions -->
		<div class="flex gap-4">
			<Button type="submit">Save Configuration</Button>
			<Button type="submit" variant="outline" formaction="?/reset">Reset to Defaults</Button>
		</div>
	</form>
</div>
