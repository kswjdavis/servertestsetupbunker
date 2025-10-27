import React from 'react';

interface BunkerLayoutDiagramProps {
  fanCount: number;
  orientation?: number;
}

const BunkerLayoutDiagram: React.FC<BunkerLayoutDiagramProps> = ({ fanCount, orientation = 0 }) => {
  const fans = Array.from({ length: fanCount }, (_, index) => index + 1);
  const columns = Math.min(fanCount, fanCount <= 6 ? 3 : 4);

  return (
    <div className="bunker-diagram" role="img" aria-label="Bunker fan layout diagram">
      <div className="bunker-diagram__orientation">
        <span className="bunker-diagram__orientation-label">Orientation</span>
        <span className="bunker-diagram__orientation-value">{orientation}°</span>
      </div>
      <div
        className="bunker-diagram__grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {fans.map((fan) => (
          <div key={fan} className="bunker-diagram__fan">
            <span className="bunker-diagram__fan-label">{fan}</span>
            <span className="bunker-diagram__fan-caption">Fan {fan}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BunkerLayoutDiagram;
