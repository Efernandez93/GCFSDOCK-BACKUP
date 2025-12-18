/**
 * Metrics Bar Component - Quick stats buttons
 */

export default function MetricsBar({
    metrics,
    activeFilter,
    onFilterChange,
    isMasterList,
    mode = 'ocean'
}) {
    const isAir = mode === 'air';

    const cards = [
        {
            key: 'all',
            label: 'Total Rows',
            value: metrics.totalRows ?? 0
        },
        {
            key: 'unique_mbl',
            label: isAir ? 'Unique MAWBs' : 'Unique MBLs',
            value: metrics.uniqueMbls ?? 0,
            isInfo: true,  // Just for display, no filtering
            enabled: false  // Disable clicking - it's informational only
        },
        // Show FRL metrics for Ocean mode only (Air mode doesn't need these)
        ...(!isAir ? [
            {
                key: 'with_frl',
                label: 'With FRL',
                value: metrics.withFrl ?? 0
            },
            {
                key: 'without_frl',
                label: 'Without FRL',
                value: metrics.withoutFrl ?? 0
            },
        ] : []),
        // Only show comparison metrics for Ocean individual uploads (not Master List, not Air)
        ...(!isMasterList && !isAir ? [
            {
                key: 'new_items',
                label: 'NEW Items',
                value: metrics.newItems ?? 0,
                enabled: true
            },
            {
                key: 'updated_items',
                label: 'Removed',
                value: metrics.removedItems ?? 0,
                enabled: true
            },
            {
                key: 'new_frl',
                label: "Newly FRL'd",
                value: metrics.newFrl ?? 0,
                enabled: true
            },
        ] : []),
    ];

    return (
        <div className="metrics-bar">
            {cards.filter(card => !card.hidden).map(card => (
                <div
                    key={card.key}
                    className={`metric-card ${activeFilter === card.key ? 'active' : ''}`}
                    onClick={() => onFilterChange(card.key)}
                    style={{
                        opacity: card.enabled === false ? 0.5 : 1,
                        pointerEvents: card.enabled === false ? 'none' : 'auto'
                    }}
                >
                    <div className="metric-value">{card.value}</div>
                    <div className="metric-label">{card.label}</div>
                </div>
            ))}
        </div>
    );
}
