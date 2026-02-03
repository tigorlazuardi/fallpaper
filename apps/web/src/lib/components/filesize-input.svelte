<script lang="ts">
	import { untrack } from 'svelte';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';

	type Props = {
		id: string;
		name: string;
		value: number | null | undefined;
		onchange: (bytes: number | null) => void;
		placeholder?: string;
		'aria-invalid'?: 'true' | undefined;
	};

	let { id, name, value, onchange, placeholder = 'Optional', 'aria-invalid': ariaInvalid }: Props = $props();

	const units = [
		{ value: 'B', label: 'B', multiplier: 1 },
		{ value: 'KB', label: 'KB', multiplier: 1024 },
		{ value: 'MB', label: 'MB', multiplier: 1024 * 1024 },
		{ value: 'GB', label: 'GB', multiplier: 1024 * 1024 * 1024 }
	];

	// Determine best unit for display based on value
	function getBestUnit(bytes: number | null | undefined): { unit: string; displayValue: number | '' } {
		if (bytes === null || bytes === undefined || bytes === 0) {
			return { unit: 'MB', displayValue: '' };
		}

		// Find the largest unit that results in a value >= 1
		for (let i = units.length - 1; i >= 0; i--) {
			const converted = bytes / units[i].multiplier;
			if (converted >= 1) {
				// Check if it's a clean number (no weird decimals)
				if (Number.isInteger(converted) || converted.toFixed(2).endsWith('00')) {
					return { unit: units[i].value, displayValue: Math.round(converted * 100) / 100 };
				}
			}
		}

		return { unit: 'B', displayValue: bytes };
	}

	const initial = untrack(() => getBestUnit(value));
	let selectedUnit = $state(initial.unit);
	let inputValue = $state<number | ''>(initial.displayValue);

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const numValue = target.value === '' ? '' : parseFloat(target.value);
		inputValue = numValue;
		updateBytes();
	}

	function handleUnitChange(newUnit: string) {
		selectedUnit = newUnit;
		updateBytes();
	}

	function updateBytes() {
		if (inputValue === '' || inputValue === null || isNaN(inputValue as number)) {
			onchange(null);
			return;
		}

		const unit = units.find((u) => u.value === selectedUnit);
		if (unit) {
			const bytes = Math.round((inputValue as number) * unit.multiplier);
			onchange(bytes);
		}
	}

	const unitLabel = $derived(units.find((u) => u.value === selectedUnit)?.label ?? 'MB');
</script>

<div class="flex gap-2">
	<Input
		{id}
		{name}
		type="number"
		value={inputValue}
		oninput={handleInputChange}
		{placeholder}
		min="0"
		step="any"
		class="flex-1"
		aria-invalid={ariaInvalid}
	/>
	<Select.Root type="single" value={selectedUnit} onValueChange={handleUnitChange}>
		<Select.Trigger class="w-[80px]">
			{unitLabel}
		</Select.Trigger>
		<Select.Content>
			{#each units as unit}
				<Select.Item value={unit.value} label={unit.label} />
			{/each}
		</Select.Content>
	</Select.Root>
</div>
