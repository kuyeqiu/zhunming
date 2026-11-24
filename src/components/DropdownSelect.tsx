import type { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from 'cn';

export type DropdownSelectOption<T extends string = string> = {
  value: T;
  label: string;
  triggerLabel?: string;
  group?: string;
  disabled?: boolean;
};

type DropdownSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: readonly DropdownSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  prefix?: string;
  disabled?: boolean;
  variant?: 'compact' | 'field';
  favoriteValue?: T;
  favoriteLabel?: string;
  onFavoriteChange?: (value: T) => void;
};

/**
 * 下拉选择器：shadcn Select（@base-ui/react）实现，外观走 base-nova 预设。
 * API 与旧实现一致：分组按相邻 option.group 前缀渲染，trigger 显示 triggerLabel，
 * 每项右侧可挂「设为默认」星标（onFavoriteChange）。
 */
export function DropdownSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  prefix,
  disabled = false,
  variant = 'compact',
  favoriteValue,
  favoriteLabel = '默认项',
  onFavoriteChange,
}: DropdownSelectProps<T>) {
  const selectedLabel = (current: T) => {
    const option = options.find((item) => item.value === current);
    return option?.triggerLabel ?? option?.label ?? '';
  };

  const groups: { name?: string; items: ReactNode[] }[] = [];
  for (const option of options) {
    const favoriteButton = onFavoriteChange ? (
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${option.label}设为${favoriteLabel}`}
        aria-pressed={option.value === favoriteValue}
        title={
          option.value === favoriteValue
            ? `当前${favoriteLabel}`
            : `设为${favoriteLabel}`
        }
        disabled={option.disabled}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onFavoriteChange(option.value);
        }}
        className={cn(
          'pointer-events-auto ml-auto flex size-4 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-[13px] leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-45',
          option.value === favoriteValue && 'text-foreground',
        )}
      >
        <span aria-hidden="true">
          {option.value === favoriteValue ? '★' : '☆'}
        </span>
      </button>
    ) : null;

    const item = (
      <SelectItem
        key={option.value}
        value={option.value}
        disabled={option.disabled}
        className={onFavoriteChange ? 'pr-8' : undefined}
      >
        <span>{option.label}</span>
        {favoriteButton}
      </SelectItem>
    );
    if (option.group && groups[groups.length - 1]?.name !== option.group) {
      groups.push({ name: option.group, items: [item] });
    } else {
      groups[groups.length - 1]?.items.push(item) ??
        groups.push({ items: [item] });
    }
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T);
      }}
      disabled={disabled}
      name={id}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(variant === 'field' ? 'w-full' : 'w-full')}
      >
        {prefix ? (
          <span className="shrink-0 text-[0.85em] font-medium text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <SelectValue>{(current: T) => selectedLabel(current)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {groups.map((group, index) =>
          group.name ? (
            <SelectGroup key={`${group.name}-${index}`}>
              <SelectLabel>{group.name}</SelectLabel>
              {group.items}
            </SelectGroup>
          ) : (
            <SelectGroup key={`group-${index}`}>{group.items}</SelectGroup>
          ),
        )}
      </SelectContent>
    </Select>
  );
}
