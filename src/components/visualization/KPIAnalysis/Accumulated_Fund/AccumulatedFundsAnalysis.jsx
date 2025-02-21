import React, { useState, useEffect, useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label, ZAxis } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';

const AccumulatedFundsAnalysis = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'accumulated_funds_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'accumulated_funds_analysis');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Process data
        const processedData = jsonData
          .map(dao => ({
            name: dao.dao_name,
            x: Math.log10(Math.max(1, dao.accumulated_funds.treasury_value_usd)),
            y: dao.accumulated_funds.circulating_token_percentage,
            raw: {
              treasury: dao.accumulated_funds.treasury_value_usd,
              circulating: dao.accumulated_funds.circulating_token_percentage,
              total_supply: dao.accumulated_funds.total_supply,
              velocity: dao.accumulated_funds.token_velocity
            }
          }))
          .filter(item => !isNaN(item.x) && !isNaN(item.y));

        // Calculate statistics
        const treasuryValues = processedData.map(d => d.raw.treasury);
        const circulatingValues = processedData.map(d => d.raw.circulating);
        
        setStats({
          n: processedData.length,
          treasury: {
            mean: treasuryValues.reduce((a, b) => a + b, 0) / processedData.length,
            median: [...treasuryValues].sort((a, b) => a - b)[Math.floor(processedData.length/2)],
            low: treasuryValues.filter(v => v < 100_000_000).length,
            medium: treasuryValues.filter(v => v >= 100_000_000 && v <= 1_000_000_000).length,
            high: treasuryValues.filter(v => v > 1_000_000_000).length
          },
          circulation: {
            mean: circulatingValues.reduce((a, b) => a + b, 0) / processedData.length,
            low_circ: processedData.filter(d => 
              d.raw.treasury >= 100_000_000 && 
              d.raw.treasury <= 1_000_000_000 && 
              d.raw.circulating < 50
            ).length,
            high_circ: processedData.filter(d => 
              d.raw.treasury >= 100_000_000 && 
              d.raw.treasury <= 1_000_000_000 && 
              d.raw.circulating >= 50
            ).length
          }
        });
        
        setData(processedData);
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    fetchData();
  }, []);

  if (!data.length || !stats) return <div>Loading...</div>;

  return (
    <div style={{ width: '100%', padding: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <button 
          onClick={() => handleExport('svg')}
          style={{ marginRight: '10px', padding: '8px 16px', fontFamily: 'serif' }}
        >
          Export SVG
        </button>
        <button 
          onClick={() => handleExport('png')}
          style={{ padding: '8px 16px', fontFamily: 'serif' }}
        >
          Export High-Res PNG
        </button>
      </div>

      <div style={{ textAlign: 'center', fontFamily: 'serif', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>
          Figure 1: DAO Treasury and Token Distribution Analysis
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Relationship between treasury value and circulating token percentage (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Treasury categories: Low ({((stats.treasury.low/stats.n)*100).toFixed(1)}%), 
          Medium ({((stats.treasury.medium/stats.n)*100).toFixed(1)}%), 
          High ({((stats.treasury.high/stats.n)*100).toFixed(1)}%)
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 20, right: 60, bottom: 60, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 'auto']}
              tickFormatter={(value) => `$${Math.pow(10, value).toExponential(0)}`}
            >
              <Label
                value="Treasury Value (USD, log₁₀ scale)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            >
              <Label
                value="Circulating Token Percentage"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Thresholds */}
            <ReferenceLine
              x={Math.log10(100_000_000)}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "$100M",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '11px' }
              }}
            />
            <ReferenceLine
              x={Math.log10(1_000_000_000)}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "$1B",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '11px' }
              }}
            />
            <ReferenceLine
              y={50}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "50% Circulation",
                position: "right",
                style: { fontFamily: 'serif', fontSize: '11px' }
              }}
            />

            <Scatter
              data={data}
              fill="#000"
              fillOpacity={0.6}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div style={{
                      backgroundColor: 'white',
                      padding: '10px',
                      border: '1px solid #ccc',
                      fontFamily: 'serif'
                    }}>
                      <p style={{ fontWeight: 'bold' }}>{data.name}</p>
                      <p>Treasury: ${data.raw.treasury.toLocaleString()}</p>
                      <p>Circulating: {data.raw.circulating.toFixed(2)}%</p>
                      <p>Total Supply: {data.raw.total_supply.toLocaleString()}</p>
                      <p>Token Velocity: {data.raw.velocity.toFixed(4)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Distribution Analysis:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Low Treasury (&lt;$100M): {((stats.treasury.low/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>Medium Treasury ($100M-$1B):
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>With Low Circulation (&lt;50%): {((stats.circulation.low_circ/stats.n)*100).toFixed(1)}%</li>
              <li>With High Circulation (≥50%): {((stats.circulation.high_circ/stats.n)*100).toFixed(1)}%</li>
            </ul>
          </li>
          <li>High Treasury (&gt;$1B): {((stats.treasury.high/stats.n)*100).toFixed(1)}% of DAOs</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Treasury values are shown on logarithmic scale. Reference lines indicate category thresholds.
        </p>
      </div>
    </div>
  );
};

export default AccumulatedFundsAnalysis;