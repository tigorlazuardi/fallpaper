<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { ExternalLink, User, Calendar, HardDrive, Image as ImageIcon } from 'lucide-svelte';
	import type { ImageModalData } from './types';

	type Props = {
		/** Whether the modal is open */
		open: boolean;
		/** Callback when open state changes */
		onOpenChange?: (open: boolean) => void;
		/** Image data to display */
		image: ImageModalData | null;
	};

	let { open = $bindable(false), onOpenChange, image }: Props = $props();

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onOpenChange?.(newOpen);
	}

	function openFullImage() {
		if (!image) return;
		const url = image.fullSrc || image.src;
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function formatFilesize(bytes?: number): string {
		if (!bytes) return 'Unknown';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function formatDate(date?: Date | string | number): string {
		if (!date) return 'Unknown';
		const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
		return d.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content
		class="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0"
		showCloseButton={true}
	>
		{#if image}
			<!-- Image container - clickable to open full quality -->
			<button
				type="button"
				class="relative flex-1 min-h-0 bg-black/50 cursor-pointer overflow-hidden"
				onclick={openFullImage}
				title="Click to open full quality image in new tab"
			>
				<img
					src={image.src}
					alt={image.title || 'Image'}
					class="w-full h-full object-contain max-h-[60vh]"
				/>
				<!-- Hover hint -->
				<div
					class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
				>
					<div class="flex items-center gap-2 text-white bg-black/60 px-4 py-2 rounded-lg">
						<ExternalLink class="h-5 w-5" />
						<span>Open full quality</span>
					</div>
				</div>
			</button>

			<!-- Metadata section -->
			<div class="p-4 space-y-3 bg-background border-t overflow-y-auto max-h-[30vh]">
				<!-- Title and badges -->
				<div class="flex flex-wrap items-start gap-2">
					<h3 class="text-lg font-semibold flex-1 min-w-0">
						{image.title || 'Untitled'}
					</h3>
					{#if image.nsfw === 1}
						<Badge variant="destructive">NSFW</Badge>
					{/if}
					{#if image.format}
						<Badge variant="secondary">{image.format.toUpperCase()}</Badge>
					{/if}
				</div>

				<!-- Metadata grid -->
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
					<!-- Resolution -->
					<div class="flex items-center gap-2 text-muted-foreground">
						<ImageIcon class="h-4 w-4 shrink-0" />
						<span>{image.width} x {image.height}</span>
					</div>

					<!-- File size -->
					<div class="flex items-center gap-2 text-muted-foreground">
						<HardDrive class="h-4 w-4 shrink-0" />
						<span>{formatFilesize(image.filesize)}</span>
					</div>

					<!-- Source -->
					{#if image.sourceName}
						<div class="flex items-center gap-2 text-muted-foreground">
							<span class="font-medium">Source:</span>
							<span>{image.sourceName}</span>
						</div>
					{/if}

					<!-- Author -->
					{#if image.author}
						<div class="flex items-center gap-2 text-muted-foreground">
							<User class="h-4 w-4 shrink-0" />
							{#if image.authorUrl}
								<a
									href={image.authorUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="hover:text-foreground hover:underline"
								>
									{image.author}
								</a>
							{:else}
								<span>{image.author}</span>
							{/if}
						</div>
					{/if}

					<!-- Date -->
					{#if image.sourceCreatedAt}
						<div class="flex items-center gap-2 text-muted-foreground">
							<Calendar class="h-4 w-4 shrink-0" />
							<span>{formatDate(image.sourceCreatedAt)}</span>
						</div>
					{/if}
				</div>

				<!-- Links -->
				{#if image.websiteUrl}
					<div class="pt-2 border-t">
						<a
							href={image.websiteUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
						>
							<ExternalLink class="h-4 w-4" />
							View original post
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
