import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, Tooltip, Legend, ArcElement } from 'chart.js'

ChartJS.register(Tooltip, Legend, ArcElement)

/**
 * Renders a Chart.js Doughnut chart paired with a crisp, readable bottom legend
 * anchored near the lower edge of the container with balanced bottom breathing room.
 */
export default function StatusDoughnutChart({ data, maxChartWidth = 'max-w-[230px]' }) {
  const labels = data?.labels || []
  const colors = data?.datasets?.[0]?.backgroundColor || []

  return (
    <div className="flex-1 flex flex-col w-full">
      <div className={`${maxChartWidth} w-full mx-auto my-auto py-2`}>
        <Doughnut
          data={data}
          options={{
            plugins: {
              legend: { display: false },
            },
          }}
        />
      </div>

      {labels.length > 0 && (
        <div className="mt-auto pt-6 pb-2 sm:pb-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          {labels.map((label, idx) => (
            <div key={`${label}-${idx}`} className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 shrink-0 inline-block"
                style={{ backgroundColor: colors[idx] || '#111827' }}
              />
              <span className="font-mono text-[13px] sm:text-sm font-medium text-neutral-800 leading-snug">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

