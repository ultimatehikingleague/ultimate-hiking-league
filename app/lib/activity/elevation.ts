type ElevationPoint = { segment: number; time?: number; elevation?: number }

// Ignore small reversals while retaining the full change between confirmed extrema.
function segmentTotals(heights: number[]) {
  const smoothed = heights.map((height, index) => index === 0 || index === heights.length - 1
    ? height
    : [heights[index - 1], height, heights[index + 1]].sort((a, b) => a - b)[1])
  const minimumChange = 3
  let anchor = smoothed[0]
  let extreme = anchor
  let ascent = 0
  let descent = 0
  for (const height of smoothed) {
    if (extreme >= anchor && height >= extreme || extreme <= anchor && height <= extreme) {
      extreme = height
    } else if (Math.abs(height - extreme) >= minimumChange) {
      if (extreme - anchor >= minimumChange) ascent += extreme - anchor
      if (anchor - extreme >= minimumChange) descent += anchor - extreme
      anchor = extreme
      extreme = height
    }
  }
  if (extreme - anchor >= minimumChange) ascent += extreme - anchor
  if (anchor - extreme >= minimumChange) descent += anchor - extreme
  return { ascent, descent }
}

export function estimateElevation(points: ElevationPoint[]) {
  if (points.length < 5) return
  let ascent = 0
  let descent = 0
  let heights: number[] = []
  for (const [index, point] of points.entries()) {
    const height = point.elevation
    if (height === undefined || height < -500 || height > 9000) return
    const previous = points[index - 1]
    if (previous && previous.segment !== point.segment) {
      if (heights.length < 3) return
      const totals = segmentTotals(heights)
      ascent += totals.ascent
      descent += totals.descent
      heights = []
    }
    if (heights.length) {
      const delta = Math.abs(height - heights[heights.length - 1])
      const seconds = ((point.time ?? NaN) - (previous.time ?? NaN)) / 1000
      if (delta > 100 || (delta > 20 && seconds <= delta / 5)) return
    }
    heights.push(height)
  }
  if (heights.length < 3) return
  const totals = segmentTotals(heights)
  return { ascent: Math.round(ascent + totals.ascent), descent: Math.round(descent + totals.descent) }
}
