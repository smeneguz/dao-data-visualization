Diagram 2 

# Distribution Analysis of DAO Treasury Values: A Statistical Approach

## Overview
This analysis examines the distribution of treasury values across Decentralized Autonomous Organizations (DAOs), using advanced statistical methods to understand the concentration and spread of financial resources.

## Data Characteristics
- **Sample Size**: N = 50 DAOs
- **Near-zero Cases**: 14 DAOs (28.0%)
- **Value Range**: $2.9e-3 to $2.2e+11 USD

## Statistical Methods Used

### 1. Core Statistical Measures
- **Geometric Mean**: $2.01e+2
  - Used instead of arithmetic mean due to log-normal distribution
  - More appropriate for highly skewed financial data
  - 95% Confidence Interval: [$5.58e+0, $7.24e+3]

- **Median**: $8.98e+4
  - Robust measure of central tendency
  - Less sensitive to extreme values
  - Better represents "typical" DAO treasury size

- **Interquartile Range (IQR)**: [$1.00e-6, $5.98e+6]
  - Robust measure of spread
  - Contains middle 50% of the data
  - Shows extreme variability in treasury sizes

### 2. Advanced Statistical Measures

#### Distribution Shape Parameters
- **Skewness (γ₁)**: -0.61
  - Negative value indicates left-skewed distribution in log space
  - Suggests concentration at higher values after log transformation

- **Kurtosis (γ₂)**: -1.38
  - Negative value indicates lighter tails than normal distribution
  - Suggests fewer extreme outliers than expected

#### Robust Statistics
- **Median Absolute Deviation (MAD)**: 2.377 log₁₀ units
  - Robust measure of variability
  - Less sensitive to outliers than standard deviation
  - Confirms high variability in treasury sizes

### 3. Visualization Methods

#### Histogram Construction
- **Bin Width**: 6.936 log₁₀ units
  - Optimized using Freedman-Diaconis rule
  - Accounts for data spread and sample size
  - Formula: 2 × IQR × n^(-1/3)

#### Density Estimation
- **Adaptive Kernel Density Estimation**
  - Uses Gaussian kernel
  - Adapts bandwidth locally
  - Provides smooth representation of distribution

### 4. Category Thresholds
- **Low**: < $100M (94.0% of DAOs)
- **Medium-Low**: $100M-$1B with < 50% circulation (0.0%)
- **Medium-High**: $100M-$1B with ≥ 50% circulation (4.0%)
- **High**: > $1B (2.0%)

## Key Findings

1. **Extreme Concentration**
   - 94% of DAOs have treasuries below $100M
   - Only 2% exceed $1B
   - Significant number (28%) have near-zero treasuries

2. **Distribution Characteristics**
   - Highly skewed in natural scale
   - Log transformation reveals structured distribution
   - Large gap between mean and median indicates extreme values

3. **Treasury Size Categories**
   - Clear dominance of small treasuries
   - Very few DAOs in medium categories
   - Minimal representation in high category

## Statistical Significance
- Confidence intervals suggest high uncertainty in mean estimation
- MAD indicates substantial variability even within size categories
- Distribution shape metrics confirm non-normal distribution

## Conclusions

1. **Financial Concentration**
   - Extreme inequality in treasury distribution
   - Most DAOs operate with relatively small treasuries
   - Few "whale" DAOs control substantial resources

2. **Methodological Implications**
   - Log transformation essential for analysis
   - Robust statistics provide better insights than traditional measures
   - Multiple statistical approaches needed for comprehensive understanding

3. **Category Effectiveness**
   - Current threshold at $100M might be too high
   - Consider revising category boundaries based on empirical distribution
   - Potential need for more granular low-value categories

## Recommendations
1. Consider redefining treasury size categories based on empirical distribution
2. Implement additional analysis of near-zero treasury cases
3. Investigate correlation with other DAO metrics
4. Consider longitudinal study to track treasury evolution



Diagram 3

# Treasury Value Threshold Analysis: Statistical Methodology and Findings

## Overview
This analysis examines the distribution of treasury values across Decentralized Autonomous Organizations (DAOs) to evaluate and potentially refine existing categorization thresholds. The current framework uses fixed thresholds ($100M and $1B), while our empirical analysis suggests that quartile-based thresholds might better reflect the actual distribution of treasury values.

## Methodology

### 1. Data Processing

#### Data Preparation
- Raw treasury values are processed in USD
- Log transformation is applied: `log₁₀(max(ε, value))` where ε = 10⁻⁶
- Zero values and invalid entries are filtered out
- Both raw values and log-transformed values are maintained for different aspects of the analysis

### 2. Statistical Methods

#### Quantile Calculation
We implement a linear interpolation method for quantile calculation:
```javascript
Q(p) = x[j] + (x[j+1] - x[j]) * f
where:
- j = floor(p * (n-1))
- f = p * (n-1) - j
- p is the desired quantile (0.25 for Q₁, 0.5 for median, 0.75 for Q₃)
- n is the sample size
```

#### Kernel Density Estimation (KDE)
For smoothed distribution visualization:
```javascript
KDE(x) = (1/nh) Σᵢ K((x - xᵢ)/h)
where:
- K is the Gaussian kernel: K(u) = (1/√(2π)) * e^(-u²/2)
- h is the bandwidth (set to 0.5 for log-scale data)
- n is the sample size
```

#### Histogram Binning
- Bin width: 0.5 (in log₁₀ scale)
- Frequency calculation: (count per bin / total count) * 100%
- Bins span the entire range of observed values

### 3. Threshold Frameworks

#### Current Framework (from paper)
- Low: < $100M
- Medium: $100M - $1B
- High: > $1B

#### Proposed Empirical Framework
- Low: < Q₁
- Medium: Q₁ - Q₃
- High: > Q₃

## Results

### 1. Distribution Statistics
- Sample size (N): 50 DAOs
- Key statistical measures:
  * First Quartile (Q₁): [Q₁ value]
  * Median: [Median value]
  * Third Quartile (Q₃): [Q₃ value]

### 2. Category Distribution

#### Current Framework
- Low (<$100M): [percentage]%
- Medium ($100M-$1B): [percentage]%
- High (>$1B): [percentage]%

#### Empirical Framework
- Low (<Q₁): [percentage]%
- Medium (Q₁-Q₃): [percentage]%
- High (>Q₃): [percentage]%

## Analysis of Findings

### 1. Distribution Characteristics
- The distribution shows significant right-skewness
- Log transformation reveals a more interpretable pattern
- Density estimation indicates [describe pattern]

### 2. Threshold Comparison
- Current thresholds ($100M and $1B) appear to [analysis of how well they segment the data]
- Empirical thresholds provide [comparison of categorization effectiveness]

### 3. Implications for Categorization
- The empirical approach suggests [implications]
- The current fixed thresholds [evaluation of current framework]

## Conclusions

1. **Statistical Validity**
   - The empirical framework provides a data-driven categorization
   - Quartile-based thresholds adapt to the actual distribution of treasury values

3. **Future Considerations**
   - Regular recalculation of empirical thresholds might be necessary
   - Additional factors (e.g., token circulation) could be incorporated

## Technical Notes

1. **Visualization**
   - Log₁₀ scale used for x-axis to handle wide value range
   - Kernel density estimation provides smoothed distribution view
   - Reference lines show both current and proposed thresholds

2. **Implementation Details**
   - Data processing handles edge cases (zero values, invalid entries)
   - Statistical calculations use proper numerical methods
   - Visualization includes interactive elements for detailed exploration

