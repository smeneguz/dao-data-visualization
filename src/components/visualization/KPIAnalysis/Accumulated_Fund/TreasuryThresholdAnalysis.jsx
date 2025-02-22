import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const formatCurrency = (value) => {
  if (value < 0.01) {
    return `${value.toExponential(2)}`;  // No $ for very small values
  }
  if (value >= 1000000) {
    const millions = value / 1000000;
    return `$${millions.toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value);
};

const TreasuryThresholdAnalysis = () => {
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
      exportToPNG({ current: svgElement }, 'treasury_threshold_analysis', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'treasury_threshold_analysis');
    }
  };

  useEffect(() => {
    const analyzeThresholds = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Process treasury values
        const EPSILON = 1e-6;
        const treasuryValues = jsonData
          .map(dao => ({
            value: dao.accumulated_funds.treasury_value_usd,
            logValue: Math.log10(Math.max(EPSILON, dao.accumulated_funds.treasury_value_usd)),
            circulation: dao.accumulated_funds.circulating_token_percentage,
            name: dao.dao_name
          }))
          .filter(item => !isNaN(item.value) && item.value !== 0);

        const values = treasuryValues.map(t => t.value);
        
        // Calculate statistics
        const getQuantile = (arr, q) => {
          const sortedArr = [...arr].sort((a, b) => a - b);
          const pos = (sortedArr.length - 1) * q;
          const base = Math.floor(pos);
          const rest = pos - base;
          if (sortedArr[base + 1] !== undefined) {
            return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
          } else {
            return sortedArr[base];
          }
        };

        const q1 = getQuantile(values, 0.25);
        const median = getQuantile(values, 0.5);
        const q3 = getQuantile(values, 0.75);

        // Define thresholds
        const thresholds = {
          current: {
            low: 100_000_000,    // $100M
            high: 1_000_000_000  // $1B
          }
        };

        // Calculate categories
        const categories = {
          current: {
            low: values.filter(v => v < thresholds.current.low).length,
            medium: values.filter(v => v >= thresholds.current.low && v <= thresholds.current.high).length,
            high: values.filter(v => v > thresholds.current.high).length
          },
          empirical: {
            low: values.filter(v => v < q1).length,
            medium: values.filter(v => v >= q1 && v <= q3).length,
            high: values.filter(v => v > q3).length
          }
        };

        // Create histogram data
        const logValues = treasuryValues.map(t => t.logValue);
        const binWidth = 0.5;
        const minVal = Math.floor(Math.min(...logValues));
        const maxVal = Math.ceil(Math.max(...logValues));
        const bins = _.range(minVal, maxVal + binWidth, binWidth);

        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const count = logValues.filter(v => v >= binStart && v < binEnd).length;
          
          // Calculate kernel density
          const bandwidth = 0.5;
          const density = logValues.reduce((sum, x) => {
            return sum + Math.exp(-Math.pow((binStart - x)/bandwidth, 2)/2) / 
                   (bandwidth * Math.sqrt(2 * Math.PI));
          }, 0) / values.length * 100;

          return {
            binStart,
            binEnd,
            x: (binStart + binEnd) / 2,
            frequency: (count / values.length) * 100,
            density,
            count,
            rawRange: {
              start: Math.pow(10, binStart),
              end: Math.pow(10, binEnd)
            }
          };
        });

        setStats({
          n: values.length,
          q1,
          median,
          q3,
          categories,
          thresholds: thresholds.current,
          logThresholds: {
            current: {
              low: Math.log10(thresholds.current.low),
              high: Math.log10(thresholds.current.high)
            },
            empirical: {
              low: Math.log10(q1),
              medium: Math.log10(median),
              high: Math.log10(q3)
            }
          }
        });

        setData(histogramData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeThresholds();
  }, []);

  if (!data || !stats) return <div>Loading...</div>;

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
          Figure 3: Empirical Analysis of Treasury Value Thresholds
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Distribution analysis with current and suggested category thresholds (N = {stats.n})
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          Current categories: Low ({((stats.categories.current.low/stats.n)*100).toFixed(1)}%), 
          Medium ({((stats.categories.current.medium/stats.n)*100).toFixed(1)}%), 
          High ({((stats.categories.current.high/stats.n)*100).toFixed(1)}%)
        </p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Q₁ = {formatCurrency(stats.q1)}, 
          Median = {formatCurrency(stats.median)}, 
          Q₃ = {formatCurrency(stats.q3)}
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
              dataKey="x"
              tickFormatter={(value) => `$${Math.pow(10, value).toExponential(1)}`}
            >
              <Label
                value="Treasury Value (USD, log₁₀ scale)"
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
              x={stats.logThresholds.current.low}
              stroke="#ff0000"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: "Current Low ($100M)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#ff0000' }
              }}
            />
            <ReferenceLine
              yAxisId="left"
              x={stats.logThresholds.current.high}
              stroke="#ff0000"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: "Current High ($1B)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#ff0000' }
              }}
            />

            {/* Empirical thresholds */}
            <ReferenceLine
              yAxisId="left"
              x={stats.logThresholds.empirical.low}
              stroke="#0066cc"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `Q₁ (${formatCurrency(stats.q1)})`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#0066cc' }
              }}
            />
            <ReferenceLine
              yAxisId="left"
              x={stats.logThresholds.empirical.medium}
              stroke="#0066cc"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `Median (${formatCurrency(stats.median)})`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#0066cc' }
              }}
            />
            <ReferenceLine
              yAxisId="left"
              x={stats.logThresholds.empirical.high}
              stroke="#0066cc"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={{
                value: `Q₃ (${formatCurrency(stats.q3)})`,
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px', fill: '#0066cc' }
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
              name="Kernel Density Estimation"
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
                        Range: ${data.rawRange.start.toExponential(2)} - ${data.rawRange.end.toExponential(2)}
                      </p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count} DAOs</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: '20px', fontFamily: 'serif', fontSize: '12px' }}>
        <p style={{ marginBottom: '10px' }}><strong>Threshold Analysis:</strong></p>
        <p>Current threshold distribution (from paper):</p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Low (&lt;$100M): {((stats.categories.current.low/stats.n)*100).toFixed(1)}%</li>
          <li>Medium ($100M-$1B): {((stats.categories.current.medium/stats.n)*100).toFixed(1)}%</li>
          <li>High (&gt;$1B): {((stats.categories.current.high/stats.n)*100).toFixed(1)}%</li>
        </ul>
        <p style={{ marginTop: '10px' }}>Proposed empirical thresholds:</p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Low (&lt;Q₁): {formatCurrency(stats.q1)} ({((stats.categories.empirical.low/stats.n)*100).toFixed(1)}%)</li>
          <li>Medium (Q₁-Q₃): {formatCurrency(stats.median)} ({((stats.categories.empirical.medium/stats.n)*100).toFixed(1)}%)</li>
          <li>High (&gt;Q₃): {formatCurrency(stats.q3)} ({((stats.categories.empirical.high/stats.n)*100).toFixed(1)}%)</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: The plot shows both the empirical distribution (bars) and kernel density estimation (red line).
          Current thresholds ($100M and $1B) are shown in red, while proposed empirical thresholds are shown
          in blue. The empirical thresholds are based on quartile analysis of the actual distribution,
          providing potentially more meaningful categorization for the current state of DAOs.
        </p>
      </div>
    </div>
  );
};

export default TreasuryThresholdAnalysis;