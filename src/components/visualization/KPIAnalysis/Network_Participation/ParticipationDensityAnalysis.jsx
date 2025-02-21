import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, Label, ReferenceLine } from 'recharts';
import _ from 'lodash';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';


const ParticipationDensityAnalysis = () => {
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

  // Gaussian kernel for KDE
  const gaussianKernel = (x, mean, bandwidth) => (
    Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(bandwidth, 2))) / 
    (bandwidth * Math.sqrt(2 * Math.PI))
  );

  // KDE calculation
  const calculateKDE = (data, points = 100, bandwidth = 5) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const step = (max - min) / points;
    
    return Array.from({ length: points + 1 }, (_, i) => {
      const x = min + i * step;
      const density = data.reduce((sum, point) => 
        sum + gaussianKernel(x, point, bandwidth), 0) / data.length;
      return { x, density };
    });
  };

  useEffect(() => {
    const fetchData = async () => {
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

        // Create histogram data
        const binWidth = 5;
        const maxRate = Math.ceil(Math.max(...rates) / binWidth) * binWidth;
        const bins = _.range(0, maxRate + binWidth, binWidth);
        
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = rates.filter(r => r >= binStart && r < binEnd).length;
          const frequency = (count / rates.length) * 100;
          
          return {
            binStart,
            binEnd,
            interval: `${binStart}-${binEnd}%`,
            frequency,
            count
          };
        });

        // Calculate statistics
        const mean = _.mean(rates);
        const sortedRates = _.sortBy(rates);
        const median = sortedRates[Math.floor(rates.length/2)];
        const std = Math.sqrt(_.sumBy(rates, r => Math.pow(r - mean, 2)) / (rates.length - 1));
        const skewness = _.sumBy(rates, r => Math.pow((r - mean) / std, 3)) / rates.length;

        // Calculate KDE
        const kde = calculateKDE(rates);
        
        // Combine data
        const combinedData = histogramData.map((bin, i) => ({
          ...bin,
          density: kde.find(k => Math.abs(k.x - (bin.binStart + binWidth/2)) < binWidth/2)?.density * 100 || 0
        }));

        setStats({
          n: rates.length,
          mean,
          median,
          std,
          skewness,
          thresholds: {
            low: rates.filter(r => r < 10).length / rates.length * 100,
            high: rates.filter(r => r > 40).length / rates.length * 100
          }
        });
        
        setData(combinedData);
        
        console.log("Data processed:", {
          dataPoints: rates.length,
          bins: combinedData.length,
          statistics: { mean, median, std, skewness }
        });
      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    fetchData();
  }, []);

  if (!data || !stats) return null;

  return (
    <div style={{ width: '100%', height: '700px', padding: '20px' }}>
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
          Figure 2.1: Distribution of Network Participation Rates
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Histogram with kernel density estimation (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          μ = {stats.mean.toFixed(1)}%, σ = {stats.std.toFixed(1)}%, 
          Median = {stats.median.toFixed(1)}%, 
          Skewness = {stats.skewness.toFixed(2)}
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
              yAxisId="frequency"
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

            <ReferenceLine
              yAxisId="frequency"
              x={10}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "ρₗ = 10%",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              yAxisId="frequency"
              x={40}
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "ρₕ = 40%",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />

            <Bar
              yAxisId="frequency"
              dataKey="frequency"
              fill="#000"
              opacity={0.6}
              name="Frequency"
            />
            <Line
              yAxisId="frequency"
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
                      <p style={{ fontWeight: 'bold' }}>{data.interval}</p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count}</p>
                      <p>Density: {(data.density).toFixed(2)}%</p>
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
          Note: The distribution shows strong right-skew (skewness = {stats.skewness.toFixed(2)}), 
          with {stats.thresholds.low.toFixed(1)}% of DAOs below ρₗ and {stats.thresholds.high.toFixed(1)}% 
          above ρₕ. The red line represents the kernel density estimation, providing a continuous 
          approximation of the distribution.
        </p>
      </div>
    </div>
  );
};

export default ParticipationDensityAnalysis;

