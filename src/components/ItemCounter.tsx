interface ItemCounterProps {
  current: number;
  total: number;
}

export function ItemCounter({ current, total }: ItemCounterProps) {
  return (
    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
      Item {current} of {total}
    </p>
  );
}
