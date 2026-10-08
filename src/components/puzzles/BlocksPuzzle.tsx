import { blocksGeometry, type BlockPoint, type BlocksView } from '../../content/puzzles/blocks';
import type { PuzzleRendererProps } from './renderers';
const points = (face: BlockPoint[]) => face.map(point => `${point.x},${point.y}`).join(' ');

export function BlocksPuzzle({ puzzle }: PuzzleRendererProps) {
  const { heights } = puzzle.view as BlocksView;
  const geometry = blocksGeometry(heights);
  return <div className="blocks-puzzle">
    <svg className="blocks-picture" viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label="바닥부터 빈틈없이 쌓인 블록 그림">
      <g transform={`translate(${geometry.offsetX} ${geometry.offsetY})`} strokeLinejoin="round">
        {geometry.floor.map((face, i) => <polygon key={i} className="blocks-floor" points={points(face)} />)}
        {geometry.cubes.map(cube => <g key={`${cube.cell.x}:${cube.cell.y}:${cube.cell.z}`}>
          <polygon className="blocks-left" points={points(cube.left)} />
          <polygon className="blocks-right" points={points(cube.right)} />
          <polygon className="blocks-top" points={points(cube.top)} />
        </g>)}
      </g>
    </svg>
    <div className="blocks-map">
      <strong>위에서 본 층 수</strong>
      <p className="small muted">가려진 곳도 알 수 있어요. 층 사이에 빈 곳은 없어요.</p>
      <div className="blocks-heights" style={{ gridTemplateColumns: `repeat(${heights.length}, 1fr)` }} role="group" aria-label="위에서 본 각 자리의 층 수">
        {heights.flatMap((row, r) => row.map((height, c) => <span key={`${r}:${c}`} aria-label={`${r + 1}행 ${c + 1}열 ${height}층`}>{height || '없음'}</span>))}
      </div>
    </div>
  </div>;
}
