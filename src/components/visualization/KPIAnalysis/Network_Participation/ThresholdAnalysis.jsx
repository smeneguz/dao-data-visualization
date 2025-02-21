import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, Label, ReferenceLine } from 'recharts';
import _ from 'lodash';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';


const ThresholdAnalysis = () => {
  const [data, setData] = useState(null);
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

  // Calculate variance manually
  const calculateVariance = (values, mean) => {
    return values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  };

  useEffect(() => {
    const analyzeThresholds = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Calculate participation rates
        const rates = jsonData
          .map(dao => ({
            rate: (dao.network_participation.num_distinct_voters / 
                   dao.network_participation.total_members) * 100,
            voters: dao.network_participation.num_distinct_voters,
            members: dao.network_participation.total_members
          }))
          .filter(item => item.rate <= 100 && item.rate >= 0)
          .map(item => item.rate);

        // Calculate detailed statistics
        const mean = _.mean(rates);
        const sortedRates = _.sortBy(rates);
        const median = sortedRates[Math.floor(rates.length/2)];
        const q1 = sortedRates[Math.floor(rates.length * 0.25)];
        const q3 = sortedRates[Math.floor(rates.length * 0.75)];
        const iqr = q3 - q1;
        const variance = calculateVariance(rates, mean);
        
        // Create distribution data
        const binWidth = 2; // 2% intervals for finer granularity
        const maxRate = Math.ceil(_.max(rates));
        const bins = _.range(0, maxRate + binWidth, binWidth);
        
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r < binEnd).length;
          const frequency = (count / rates.length) * 100;
          
          // Calculate density using optimal bandwidth
          const bandwidth = 1.06 * Math.min(Math.sqrt(variance), iqr/1.34) * 
                          Math.pow(rates.length, -0.2);
          const density = rates.reduce((sum, x) => {
            return sum + Math.exp(-Math.pow(((binStart + binEnd)/2 - x)/bandwidth, 2)/2) / 
                   (bandwidth * Math.sqrt(2 * Math.PI));
          }, 0) / rates.length * 100;

          return {
            binStart,
            binEnd,
            frequency,
            density,
            count
          };
        });

        // Calculate distribution across thresholds
        const thresholds = {
          current: {
            low: rates.filter(r => r < 10).length / rates.length * 100,
            medium: rates.filter(r => r >= 10 && r <= 40).length / rates.length * 100,
            high: rates.filter(r => r > 40).length / rates.length * 100
          },
          proposed: {
            veryLow: rates.filter(r => r < q1).length / rates.length * 100,
            low: rates.filter(r => r >= q1 && r < median).length / rates.length * 100,
            medium: rates.filter(r => r >= median && r < q3).length / rates.length * 100,
            high: rates.filter(r => r >= q3).length / rates.length * 100
          }
        };

        console.log("Calculated statistics:", {
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          q1: q1.toFixed(2),
          q3: q3.toFixed(2),
          thresholds
        });

        setStats({
          n: rates.length,
          mean,
          median,
          q1,
          q3,
          iqr,
          thresholds,
          variance
        });
        
        setData(histogramData);
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeThresholds();
  }, []);

  if (!data || !stats) return null;

  return (
    <div style={{ width: '100%', height: '800px', padding: '20px' }}>
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
          Figure 3: Empirical Analysis of Network Participation Thresholds
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution analysis with current and proposed thresholds (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          {`Q₁ = ${stats.q1.toFixed(1)}%, Median = ${stats.median.toFixed(1)}%, Q₃ = ${stats.q3.toFixed(1)}%`}
        </p>
      </div>

      <div style={{ width: '100%', height: '500px' }} ref={containerRef}>
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 20, right: 50, bottom: 60, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="binStart"
              tickFormatter={(value) => `${value}%`}
            >
              <Label
                value="Participation Rate (ρ)"
                position="bottom"
                offset={40}
                style={{ fontFamily: 'serif', fontSize: '12px' }}
              />
            </XAxis>
            <YAxis
              yAxisId="left"
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

            {/* Current thresholds */}
            <ReferenceLine
              yAxisId="left"
              x={10}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Current ρₗ (10%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="left"
              x={40}
              stroke="#ff0000"
              strokeDasharray="3 3"
              label={{
                value: "Current ρₕ (40%)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            {/* Proposed thresholds */}
            <ReferenceLine
              yAxisId="left"
              x={stats.q1}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: `Q₁ (${stats.q1.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="left"
              x={stats.q3}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: `Q₃ (${stats.q3.toFixed(1)}%)`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            <Bar
              yAxisId="left"
              dataKey="frequency"
              fill="#000"
              opacity={0.6}
              name="Frequency"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="density"
              stroke="#ff0000"
              strokeWidth={2}
              dot={false}
              name="Density"
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
                      <p style={{ fontWeight: 'bold' }}>
                        {`${data.binStart}-${data.binEnd}%`}
                      </p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ 
        marginTop: '20px', 
        fontFamily: 'serif', 
        fontSize: '12px', 
        fontStyle: 'italic' 
      }}>
        <p>
          <strong>Current vs. Proposed Thresholds Analysis:</strong>
        </p>
        <p>
          Current framework ({stats.thresholds.current.low.toFixed(1)}% low, 
          {stats.thresholds.current.medium.toFixed(1)}% medium, 
          {stats.thresholds.current.high.toFixed(1)}% high) could be refined based on 
          empirical quartiles. Data suggests natural breaks at Q₁ ({stats.q1.toFixed(1)}%) 
          and Q₃ ({stats.q3.toFixed(1)}%), potentially offering more granular categorization:
        </p>
        <ul style={{ marginTop: '10px', listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Very Low: &lt; {stats.q1.toFixed(1)}%</li>
          <li>Low: {stats.q1.toFixed(1)}%-{stats.median.toFixed(1)}%</li>
          <li>Medium: {stats.median.toFixed(1)}%-{stats.q3.toFixed(1)}%</li>
          <li>High: &gt; {stats.q3.toFixed(1)}%</li>
        </ul>
      </div>
    </div>
  );
};

export default ThresholdAnalysis;