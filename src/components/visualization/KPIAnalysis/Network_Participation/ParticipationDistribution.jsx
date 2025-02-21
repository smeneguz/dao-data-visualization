import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, Label, ReferenceLine } from 'recharts';

import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';


const ParticipationDistribution = () => {
  const [distributionData, setDistributionData] = useState(null);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);
  
  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'your_diagram_name', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'your_diagram_name');
    }
  };

  useEffect(() => {
    const calculateDistribution = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Calculate valid participation rates
        const rates = jsonData
          .map(dao => ({
            rate: (dao.network_participation.num_distinct_voters / 
                   dao.network_participation.total_members) * 100,
            voters: dao.network_participation.num_distinct_voters,
            members: dao.network_participation.total_members
          }))
          .filter(item => item.rate <= 100 && item.rate >= 0)
          .map(item => item.rate);

        // Modified distribution intervals to align with theoretical thresholds
        const distribution = [
          {
            category: '0-1%',
            value: rates.filter(r => r <= 1).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 1).length / rates.length * 100,
            label: 'Very Low'
          },
          {
            category: '1-5%',
            value: rates.filter(r => r > 1 && r <= 5).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 5).length / rates.length * 100,
            label: 'Low'
          },
          {
            category: '5-10%',
            value: rates.filter(r => r > 5 && r <= 10).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 10).length / rates.length * 100,
            label: 'Low'
          },
          {
            category: '10-20%',
            value: rates.filter(r => r > 10 && r <= 20).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 20).length / rates.length * 100,
            label: 'Medium'
          },
          {
            category: '20-40%',
            value: rates.filter(r => r > 20 && r <= 40).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 40).length / rates.length * 100,
            label: 'Medium'
          },
          {
            category: '40-60%',
            value: rates.filter(r => r > 40 && r <= 60).length / rates.length * 100,
            cumulative: rates.filter(r => r <= 60).length / rates.length * 100,
            label: 'High'
          },
          {
            category: '>60%',
            value: rates.filter(r => r > 60).length / rates.length * 100,
            cumulative: 100,
            label: 'High'
          }
        ];

        // Calculate key statistics
        const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
        const sortedRates = [...rates].sort((a, b) => a - b);
        setStats({
          n: rates.length,
          mean: mean,
          median: sortedRates[Math.floor(rates.length/2)],
          lowThreshold: rates.filter(r => r < 10).length / rates.length * 100,
          highThreshold: rates.filter(r => r > 40).length / rates.length * 100,
          quartiles: {
            q1: sortedRates[Math.floor(rates.length * 0.25)],
            q3: sortedRates[Math.floor(rates.length * 0.75)]
          }
        });
        
        setDistributionData(distribution);
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    calculateDistribution();
  }, []);

  if (!distributionData || !stats) return null;

  return (
    <div style={{ width: '100%', height: '600px', padding: '20px' }}>
      <div style={{ marginBottom: '10px' }}>
        <button onClick={() => handleExport('svg')} 
                style={{ marginRight: '10px', padding: '8px 16px', fontFamily: 'serif' }}>
          Export SVG
        </button>
        <button onClick={() => handleExport('png')}
                style={{ padding: '8px 16px', fontFamily: 'serif' }}>
          Export High-Res PNG
        </button>
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'serif', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '10px' }}>
          Figure 2: Distribution of Network Participation Rates
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Frequency distribution across participation rate intervals (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          Q1 = {stats.quartiles.q1.toFixed(1)}%, Median = {stats.median.toFixed(1)}%, 
          Q3 = {stats.quartiles.q3.toFixed(1)}%
        </p>
      </div>

      <div style={{ width: '100%', height: '400px' }} ref={containerRef}>
        <ResponsiveContainer>
          <BarChart
            data={distributionData}
            margin={{ top: 20, right: 30, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="category"
              tick={{ fontFamily: 'serif', fontSize: '11px' }}
            >
              <Label
                value="Participation Rate (ρ) Intervals"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              tickFormatter={(value) => `${value.toFixed(0)}%`}
            >
              <Label
                value="Relative Frequency (%)"
                angle={-90}
                position="left"
                offset={45}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </YAxis>

            {/* Theoretical threshold lines */}
            <ReferenceLine
              x="5-10%"
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "ρₗ = 10%",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              x="20-40%"
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "ρₕ = 40%",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            <Bar
              dataKey="value"
              fill="#000"
              opacity={0.8}
            />

            <Tooltip
              cursor={{ fillOpacity: 0.1 }}
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
                      <p style={{ fontWeight: 'bold' }}>{data.category}</p>
                      <p>Category: {data.label} Participation</p>
                      <p>Frequency: {data.value.toFixed(1)}%</p>
                      <p>Cumulative: {data.cumulative.toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ 
        marginTop: '20px', 
        fontFamily: 'serif', 
        fontSize: '12px', 
        fontStyle: 'italic' 
      }}>
        <p>
          Note: Distribution analysis shows {stats.lowThreshold.toFixed(1)}% of DAOs below ρₗ (10%) 
          and {stats.highThreshold.toFixed(1)}% above ρₕ (40%). The mean participation 
          rate is {stats.mean.toFixed(1)}%, indicating significant right-skew in the distribution.
        </p>
      </div>
    </div>
  );
};

export default ParticipationDistribution;