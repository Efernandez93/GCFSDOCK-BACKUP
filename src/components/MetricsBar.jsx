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
            isInfo: true  // Just for display, no filtering
        },
        // Only show FRL metrics for Ocean mode
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
        {
            key: 'new_items',
            label: isMasterList ? 'NEW Items' : 'NEW Items',
            value: metrics.newItems ?? 0,
            enabled: true
        },
        {
            key: 'updated_items',
            label: isMasterList ? 'Updated' : 'Removed',
            value: isMasterList ? (metrics.updatedItems ?? 0) : (metrics.removedItems ?? 0),
            enabled: true,
            hidden: isAir // Hide for Air mode since we don't track this yet
        },
        // Only show Newly FRL'd for Ocean mode
        ...(!isAir ? [
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
