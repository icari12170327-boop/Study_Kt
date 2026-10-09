import { BLOCK_SLOT_LABELS, blocksGeometry, type BlockPoint, type BlocksView } from '../../content/puzzles/blocks';
import type { PuzzleRendererProps } from './renderers';
const points = (face: BlockPoint[]) => face.map(point => `${point.x},${point.y}`).join(' ');

export function BlocksPuzzle({ puzzle }: PuzzleRendererProps) {
  const { heights } = puzzle.view as BlocksView;
  const geometry = blocksGeometry(heights);
  return <div className="blocks-puzzle">
    <svg className="blocks-picture" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="바닥부터 빈틈없이 쌓인 블록 그림">
      <g transform={`translate(${geometry.offsetX} ${geometry.offsetY})`} strokeLinejoin="round">
        {geometry.floor.map((face, i) => <polygon key={i} className="blocks-floor" points={points(face)} />)}
        {geometry.labels.map((point, index) => <g className="blocks-slot" key={index} aria-label={`바닥 자리 ${index + 1}`}>
          <circle cx={point.x} cy={point.y} r={7} /><text x={point.x} y={point.y} dy=".35em">{index + 1}</text>
        </g>)}
        {geometry.cubes.map(cube => <g key={`${cube.cell.x}:${cube.cell.y}:${cube.cell.z}`}>
          <polygon className="blocks-left" points={points(cube.left)} />
          <polygon className="blocks-right" points={points(cube.right)} />
          <polygon className="blocks-top" points={points(cube.top)} />
        </g>)}
        {geometry.columnLabels.map(point => <g className="blocks-column-label" key={point.index} aria-label={`기둥 자리 ${point.index + 1}`}>
          <circle cx={point.x} cy={point.y} r={7} /><text x={point.x} y={point.y} dy=".35em">{point.index + 1}</text>
        </g>)}
      </g>
    </svg>
    <div className="blocks-map">
      <strong>위에서 본 층 수</strong>
      <p className="small muted">동그라미 번호는 자리 표시예요. 같은 번호의 층 수를 찾아요.</p>
      <div className="blocks-heights" style={{ gridTemplateColumns: `repeat(${heights.length}, 1fr)` }} role="group" aria-label="위에서 본 각 자리의 층 수">
        {heights.flatMap((row, r) => row.map((height, c) => <span key={`${r}:${c}`} aria-label={`${BLOCK_SLOT_LABELS[r * heights.length + c]} 자리, ${r + 1}행 ${c + 1}열 ${height}층`}><small>{BLOCK_SLOT_LABELS[r * heights.length + c]}</small>{height || '없음'}</span>))}
      </div>
    </div>
  </div>;
}
