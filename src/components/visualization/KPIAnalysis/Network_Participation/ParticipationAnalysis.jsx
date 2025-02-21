import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label } from 'recharts';

import React, { useState, useEffect, useRef } from 'react';  
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';  

const ParticipationAnalysis = () => {
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const containerRef = useRef(null);

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'participation_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'participation_analysis');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Process data and validate participation rates
        const processedData = jsonData
          .map(dao => {
            const calculatedRate = (dao.network_participation.num_distinct_voters / 
                                  dao.network_participation.total_members) * 100;
            return {
              name: dao.dao_name,
              x: Math.log10(Math.max(1, dao.network_participation.total_members)),
              y: calculatedRate,
              raw: {
                members: dao.network_participation.total_members,
                voters: dao.network_participation.num_distinct_voters,
                storedRate: dao.network_participation.participation_rate,
                unique_proposers: dao.network_participation.unique_proposers,
                calculatedRate: calculatedRate
              }
            };
          })
          .filter(item => item.y <= 100 && item.y >= 0); // Filter valid rates

        // Find anomalies for reporting
        const anomalousData = jsonData
          .filter(dao => {
            const rate = (dao.network_participation.num_distinct_voters / 
                         dao.network_participation.total_members) * 100;
            return rate > 100 || rate < 0;
          })
          .map(dao => ({
            name: dao.dao_name,
            voters: dao.network_participation.num_distinct_voters,
            members: dao.network_participation.total_members,
            calculatedRate: (dao.network_participation.num_distinct_voters / 
                           dao.network_participation.total_members) * 100
          }));
        
        setAnomalies(anomalousData);

        // Calculate statistics on valid data
        const rates = processedData.map(d => d.y);
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const sortedRates = [...rates].sort((a, b) => a - b);
        
        setData(processedData);
        setStats({
          n: rates.length,
          mean,
          median: sortedRates[Math.floor(rates.length/2)],
          std: Math.sqrt(rates.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (rates.length - 1)),
          distribution: {
            low: rates.filter(r => r < 10).length,
            medium: rates.filter(r => r >= 10 && r <= 40).length,
            high: rates.filter(r => r > 40).length
          },
          quartiles: {
            q1: sortedRates[Math.floor(rates.length * 0.25)],
            q3: sortedRates[Math.floor(rates.length * 0.75)]
          }
        });

        // Log anomalies if found
        if (anomalousData.length > 0) {
          console.warn('Found anomalous participation rates:', anomalousData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
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
          style={{ 
            marginRight: '10px',
            padding: '8px 16px',
            fontFamily: 'serif'
          }}
        >
          Export SVG
        </button>
        <button 
          onClick={() => handleExport('png')}
          style={{ 
            padding: '8px 16px',
            fontFamily: 'serif'
          }}
        >
          Export High-Res PNG
        </button>
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'serif', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>
          Figure 1: Network Participation Distribution in DAOs
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Analysis of participation rates across community sizes (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          μ = {stats.mean.toFixed(2)}%; σ = {stats.std.toFixed(2)}%; 
          Median = {stats.median.toFixed(2)}%; 
          IQR = [{stats.quartiles.q1.toFixed(2)}%, {stats.quartiles.q3.toFixed(2)}%]
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 60, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                domain={['auto', 'auto']}
                tickFormatter={(value) => `10^${value.toFixed(0)}`}
              >
                <Label
                  value="Community Size (log₁₀ scale)"
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
                  value="Participation Rate (%)"
                  angle={-90}
                  position="left"
                  offset={45}
                  style={{ fontFamily: 'serif', fontSize: '12px' }}
                />
              </YAxis>

              <ReferenceLine
                y={10}
                stroke="#000"
                strokeDasharray="3 3"
                label={{
                  value: "Low Threshold (10%)",
                  position: "right",
                  style: { fontFamily: 'serif', fontSize: '11px' }
                }}
              />
              <ReferenceLine
                y={40}
                stroke="#000"
                strokeDasharray="3 3"
                label={{
                  value: "High Threshold (40%)",
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
                        <p>Members: {data.raw.members.toLocaleString()}</p>
                        <p>Voters: {data.raw.voters.toLocaleString()}</p>
                        <p>Participation: {data.y.toFixed(2)}%</p>
                        <p>Proposers: {data.raw.unique_proposers}</p>
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
          <li>Low participation (&lt;10%): {((stats.distribution.low/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>Medium participation (10-40%): {((stats.distribution.medium/stats.n)*100).toFixed(1)}% of DAOs</li>
          <li>High participation (&gt;40%): {((stats.distribution.high/stats.n)*100).toFixed(1)}% of DAOs</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: The horizontal lines represent theoretical boundaries for participation categories.
        </p>
      </div>
    </div>
  );
};

export default ParticipationAnalysis;