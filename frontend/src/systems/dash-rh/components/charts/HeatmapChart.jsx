import GlassCard from '../ui/GlassCard';
import { COLORS } from '../../utils/colors';

/**
 * Heatmap table for role sentiment analysis.
 *
 * @param {object} props
 * @param {Array<object>} props.data — rows of role data
 * @param {Array<{key: string, label: string, format?: function}>} props.columns
 * @param {string} props.rowKey — key for the row label
 * @param {string} [props.heatKey] — column key to apply heat coloring
 */
export default function HeatmapChart({ data, columns, rowKey, heatKey }) {
  if (!data?.length) return null;

  // Calculate min/max for heat coloring
  let heatMin = Infinity, heatMax = -Infinity;
  if (heatKey) {
    data.forEach(row => {
      const v = row[heatKey];
      if (v < heatMin) heatMin = v;
      if (v > heatMax) heatMax = v;
    });
  }

  const getHeatColor = (value) => {
    if (!heatKey || heatMin === heatMax) return 'transparent';
    const ratio = (value - heatMin) / (heatMax - heatMin);
    if (ratio >= 0.7) return 'rgba(74, 222, 128, 0.15)';
    if (ratio >= 0.4) return 'rgba(251, 191, 36, 0.12)';
    return 'rgba(248, 113, 113, 0.12)';
  };

  return (
    <div className="heatmap-wrapper">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th className="heatmap-th heatmap-th--label">{rowKey === 'role' ? 'Cargo' : rowKey}</th>
            {columns.map(col => (
              <th key={col.key} className="heatmap-th">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="heatmap-row">
              <td className="heatmap-td heatmap-td--label">{row[rowKey]}</td>
              {columns.map(col => (
                <td
                  key={col.key}
                  className="heatmap-td"
                  style={{
                    background: col.key === heatKey ? getHeatColor(row[col.key]) : 'transparent',
                  }}
                >
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
