import React, { useState, useEffect, useRef } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
         ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { exportToPNG, exportToSVG } from '../../../../utils/exportUtils';
import _ from 'lodash';

const AccumulatedFundsDistribution = () => {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const containerRef = useRef(null);

    const calculateMAD = (values, median) => {
        const deviations = values.map(v => Math.abs(v - median));
        const sortedDeviations = deviations.sort((a, b) => a - b);
        return sortedDeviations[Math.floor(deviations.length/2)];
      };

  const handleExport = (format) => {
    const svgElement = containerRef.current?.querySelector('svg');
    if (!svgElement) {
      console.error('SVG element not found');
      return;
    }
    if (format === 'png') {
      exportToPNG({ current: svgElement }, 'accumulated_funds_distribution', 3);
    } else if (format === 'svg') {
      exportToSVG({ current: svgElement }, 'accumulated_funds_distribution');
    }
  };

  // Enhanced statistical calculations
  const calculateStats = (values) => {
    const n = values.length;
    const mean = _.mean(values);
    const sortedValues = [...values].sort((a, b) => a - b);
    const median = sortedValues[Math.floor(n/2)];
    const q1 = sortedValues[Math.floor(n * 0.25)];
    const q3 = sortedValues[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
    const std = Math.sqrt(variance);
    
    // Calculate MAD manually
    const mad = calculateMAD(values, median);
    
    // Standard Error and Confidence Intervals
    const sem = std / Math.sqrt(n);
    const ci95 = 1.96 * sem;

    return {
      n, mean, median, std, q1, q3, iqr, mad,
      ci: {
        lower: mean - ci95,
        upper: mean + ci95
      }
    };
  };

  // Gaussian kernel for density estimation with adaptive bandwidth
  const gaussianKernel = (x, mean, bandwidth) => (
    Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(bandwidth, 2))) / 
    (bandwidth * Math.sqrt(2 * Math.PI))
  );

  useEffect(() => {
    const analyzeDistribution = async () => {
      try {
        const response = await fetch('/data/dao-metrics.json');
        const jsonData = await response.json();
        
        // Process treasury values with careful handling of zeros
        const EPSILON = 1e-6;
        const treasuryValues = jsonData
          .map(dao => ({
            value: Math.log10(Math.max(EPSILON, dao.accumulated_funds.treasury_value_usd)),
            rawValue: dao.accumulated_funds.treasury_value_usd,
            circulation: dao.accumulated_funds.circulating_token_percentage,
            name: dao.dao_name
          }))
          .filter(item => !isNaN(item.value));

        // Count zero/near-zero treasuries
        const zeroTreasuries = treasuryValues.filter(t => t.rawValue < EPSILON);
        
        const values = treasuryValues.map(t => t.value);
        const baseStats = calculateStats(values);
        
        // Calculate optimal bin width using Freedman-Diaconis rule
        const binWidth = 2 * baseStats.iqr * Math.pow(baseStats.n, -1/3);
        const minVal = Math.floor(_.min(values));
        const maxVal = Math.ceil(_.max(values));
        const bins = _.range(minVal, maxVal + binWidth, binWidth);

        // Create histogram data with adaptive KDE
        const histogramData = bins.slice(0, -1).map((binStart, i) => {
          const binEnd = bins[i + 1];
          const binValues = values.filter(v => v >= binStart && v < binEnd);
          const count = binValues.length;
          const frequency = (count / baseStats.n) * 100;

          // Calculate adaptive bandwidth
          const localStd = binValues.length > 1 ? 
            Math.sqrt(binValues.reduce((acc, val) => acc + Math.pow(val - _.mean(binValues), 2), 0) / (binValues.length - 1)) :
            baseStats.std;
          const adaptiveBandwidth = 0.9 * Math.min(localStd, baseStats.iqr/1.34) * 
                                  Math.pow(baseStats.n, -0.2);

          // Calculate density with adaptive bandwidth
          const x = (binStart + binEnd) / 2;
          const density = values.reduce((sum, val) => 
            sum + gaussianKernel(x, val, adaptiveBandwidth), 0) / baseStats.n * 100;

          return {
            binStart,
            binEnd,
            x,
            frequency,
            density,
            count,
            rawRange: {
              start: Math.pow(10, binStart),
              end: Math.pow(10, binEnd)
            }
          };
        });

        // Calculate categories with precise thresholds
        const lowThreshold = Math.log10(100_000_000);
        const highThreshold = Math.log10(1_000_000_000);
        
        const categories = {
          zero: zeroTreasuries.length,
          low: treasuryValues.filter(t => t.value < lowThreshold).length,
          mediumLow: treasuryValues.filter(t => 
            t.value >= lowThreshold && 
            t.value <= highThreshold &&
            t.circulation < 50
          ).length,
          mediumHigh: treasuryValues.filter(t => 
            t.value >= lowThreshold && 
            t.value <= highThreshold &&
            t.circulation >= 50
          ).length,
          high: treasuryValues.filter(t => t.value > highThreshold).length
        };

        // Calculate higher moments
        const skewness = values.reduce((acc, val) => 
          acc + Math.pow((val - baseStats.mean) / baseStats.std, 3), 0) / baseStats.n;
        const kurtosis = values.reduce((acc, val) => 
          acc + Math.pow((val - baseStats.mean) / baseStats.std, 4), 0) / baseStats.n - 3;

        setStats({
          ...baseStats,
          skewness,
          kurtosis,
          binWidth,
          categories,
          zeroCount: zeroTreasuries.length
        });

        setData(histogramData);

      } catch (error) {
        console.error('Error processing data:', error);
      }
    };

    analyzeDistribution();
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
          Figure 2: Distribution Analysis of DAO Treasury Values
        </h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          {`Histogram with adaptive kernel density estimation (N = ${stats.n}, including ${stats.zeroCount} near-zero treasuries)`}
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          {`Geometric mean = $${Math.pow(10, stats.mean).toExponential(2)} `}
          {`(95% CI: [$${Math.pow(10, stats.ci.lower).toExponential(2)}, $${Math.pow(10, stats.ci.upper).toExponential(2)}])`}
        </p>
        <p style={{ fontSize: '12px', fontStyle: 'italic' }}>
          {`Median = $${Math.pow(10, stats.median).toExponential(2)}, `}
          {`IQR = [$${Math.pow(10, stats.q1).toExponential(2)}, $${Math.pow(10, stats.q3).toExponential(2)}]`}
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

            <ReferenceLine
              x={Math.log10(100_000_000)}
              yAxisId="left"
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "Low-Medium ($100M)",
                position: "top",
                style: { fontFamily: 'serif', fontSize: '10px' }
              }}
            />
            <ReferenceLine
              x={Math.log10(1_000_000_000)}
              yAxisId="left"
              stroke="#000"
              strokeDasharray="3 3"
              label={{
                value: "Medium-High ($1B)",
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
                        Range: ${data.rawRange.start.toExponential(2)} - ${data.rawRange.end.toExponential(2)}
                      </p>
                      <p>Frequency: {data.frequency.toFixed(1)}%</p>
                      <p>Count: {data.count} DAOs</p>
                      <p>Density: {data.density.toFixed(2)}%/log₁₀ unit</p>
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
        <p style={{ marginBottom: '10px' }}><strong>Distribution Analysis:</strong></p>
        <ul style={{ listStyle: 'disc', paddingLeft: '20px' }}>
          <li>Zero/Near-zero Treasury: {((stats.categories.zero/stats.n)*100).toFixed(1)}%</li>
          <li>Low Treasury (&lt;$100M): {((stats.categories.low/stats.n)*100).toFixed(1)}%</li>
          <li>Medium Treasury ($100M-$1B):
            <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
              <li>With Low Circulation (&lt;50%): {((stats.categories.mediumLow/stats.n)*100).toFixed(1)}%</li>
              <li>With High Circulation (≥50%): {((stats.categories.mediumHigh/stats.n)*100).toFixed(1)}%</li>
            </ul>
          </li>
          <li>High Treasury (&gt;$1B): {((stats.categories.high/stats.n)*100).toFixed(1)}%</li>
        </ul>
        <p style={{ marginTop: '10px', fontStyle: 'italic', fontSize: '11px' }}>
          Note: Distribution in log₁₀ space shows skewness (γ₁) = {stats.skewness.toFixed(2)}, 
          kurtosis (γ₂) = {stats.kurtosis.toFixed(2)}. 
          Bin width optimized using Freedman-Diaconis rule (width = {stats.binWidth.toFixed(3)} log₁₀ units). 
          MAD = {stats.mad.toFixed(3)} log₁₀ units. Near-zero values set to 10⁻⁶ for log transformation.
        </p>
      </div>
    </div>
  );
};

export default AccumulatedFundsDistribution;