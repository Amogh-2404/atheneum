export default function UnknownBlock({ type }: { type: string }) {
  return (
    <div className="my-2 rounded border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
      Unknown block type: <code className="font-mono">{type}</code>
    </div>
  )
}
