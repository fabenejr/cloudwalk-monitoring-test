const fs = require('fs');
const csv = require('csv-parser');
// Chart generation removed to avoid native dependency issues
// const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

class DataAnalysis {
  constructor() {
    // Chart generation functionality simplified to avoid native dependencies
    this.chartGeneration = false;
    
    // Cache para evitar reprocessamento desnecessário
    this.cache = new Map();
    
    // Configurações de thresholds mais robustas
    this.thresholds = {
      failureRate: { warning: 3, critical: 5 },
      reversalRate: { warning: 2, critical: 3 },
      denialRate: { warning: 7, critical: 10 },
      approvalRate: { warning: 85, critical: 80 }
    };
    
    // Estatísticas de performance
    this.stats = {
      processingTime: 0,
      recordsProcessed: 0,
      anomaliesFound: 0
    };
  }

  // Load and parse CSV data with caching and optimization
  async loadCSVData(filename) {
    // Verificar cache primeiro para evitar reprocessamento
    const fullPath = filename.includes('data/') ? filename : `data/${filename}`;
    const cacheKey = `csv_${fullPath}_${this.getFileModTime(fullPath)}`;
    
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Using cached data for ${filename}`);
      return this.cache.get(cacheKey);
    }
    
    return new Promise((resolve, reject) => {
      const results = [];
      const startTime = Date.now();
      
      // Verificar se arquivo existe
      if (!fs.existsSync(fullPath)) {
        reject(new Error(`File not found: ${fullPath}`));
        return;
      }
      
      fs.createReadStream(fullPath)
        .pipe(csv())
        .on('data', (data) => {
          // Validar dados durante o carregamento
          if (this.validateRowData(data, filename)) {
            results.push(data);
          }
        })
        .on('end', () => {
          const processingTime = Date.now() - startTime;
          console.log(`✅ Loaded ${results.length} records from ${filename} in ${processingTime}ms`);
          
          // Cachear resultado
          this.cache.set(cacheKey, results);
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`❌ Error loading ${filename}:`, error.message);
          reject(error);
        });
    });
  }
  
  // Validar dados da linha durante carregamento
  validateRowData(row, filename) {
    if (filename.includes('transactions')) {
      return row.timestamp && row.status && !isNaN(parseInt(row.count));
    } else if (filename.includes('checkout')) {
      return row.time && !isNaN(parseInt(row.today)) && !isNaN(parseInt(row.yesterday));
    }
    return true; // Para outros tipos de arquivo
  }
  
  // Obter timestamp de modificação do arquivo para cache
  getFileModTime(filename) {
    try {
      return fs.statSync(filename).mtime.getTime();
    } catch {
      return Date.now();
    }
  }

  // Analyze transaction data with enhanced statistical analysis
  async analyzeTransactions() {
    console.log('=== TRANSACTION DATA ANALYSIS ===\n');
    const startTime = Date.now();
    
    try {
      const transactions = await this.loadCSVData('transactions.csv');
      
      if (!transactions || transactions.length === 0) {
        console.warn('⚠️  No transaction data found');
        return { statusCounts: {}, statusByHour: {}, anomalies: [] };
      }
      
      // Estruturas de dados otimizadas
      const statusCounts = new Map();
      const statusByHour = new Map();
      const statusStats = new Map(); // Para análise estatística
      
      // Processamento otimizado em single pass
      transactions.forEach((row, index) => {
        try {
          const status = row.status?.toLowerCase();
          const count = parseInt(row.count) || 0;
          const timestamp = new Date(row.timestamp);
          
          // Validação de dados
          if (!status || isNaN(timestamp.getTime())) {
            console.warn(`⚠️  Invalid data at row ${index + 1}`);
            return;
          }
          
          const hour = timestamp.getHours();
          
          // Count by status (usando Map para melhor performance)
          statusCounts.set(status, (statusCounts.get(status) || 0) + count);
          
          // Count by hour and status
          if (!statusByHour.has(hour)) {
            statusByHour.set(hour, new Map());
          }
          const hourMap = statusByHour.get(hour);
          hourMap.set(status, (hourMap.get(status) || 0) + count);
          
          // Coletar estatísticas por status
          if (!statusStats.has(status)) {
            statusStats.set(status, []);
          }
          statusStats.get(status).push(count);
          
        } catch (error) {
          console.warn(`⚠️  Error processing row ${index + 1}:`, error.message);
        }
      });
      
      // Converter Maps para Objects para compatibilidade
      const statusCountsObj = Object.fromEntries(statusCounts);
      const statusByHourObj = Object.fromEntries(
        Array.from(statusByHour.entries()).map(([hour, statusMap]) => 
          [hour, Object.fromEntries(statusMap)]
        )
      );
      
      this.stats.recordsProcessed = transactions.length;
      
      console.log('Transaction Status Summary:');
      console.log('==========================');
      const totalTransactions = Object.values(statusCountsObj).reduce((a, b) => a + b, 0);
      
      console.log('Transaction Status Summary:');
      console.log('==========================');
      Object.entries(statusCountsObj).forEach(([status, count]) => {
        const percentage = ((count / totalTransactions) * 100).toFixed(2);
        console.log(`${status.toUpperCase()}: ${count.toLocaleString()} (${percentage}%)`);
      });
      console.log(`TOTAL: ${totalTransactions.toLocaleString()}\n`);
      
      // Calculate anomaly indicators with improved accuracy
      console.log('Anomaly Analysis:');
      console.log('================');
      
      const approvalRate = ((statusCountsObj.approved || 0) / totalTransactions * 100).toFixed(2);
      const failureRate = ((statusCountsObj.failed || 0) / totalTransactions * 100).toFixed(2);
      const reversalRate = (((statusCountsObj.reversed || 0) + (statusCountsObj.backend_reversed || 0)) / totalTransactions * 100).toFixed(2);
      const denialRate = ((statusCountsObj.denied || 0) / totalTransactions * 100).toFixed(2);
      
      console.log(`Approval Rate: ${approvalRate}%`);
      console.log(`Failure Rate: ${failureRate}%`);
      console.log(`Reversal Rate: ${reversalRate}%`);
      console.log(`Denial Rate: ${denialRate}%\n`);
      
      // Enhanced anomaly detection with configurable thresholds
      const anomalies = this.detectTransactionAnomalies({
        statusCounts: statusCountsObj,
        statusStats,
        totalTransactions,
        rates: { approvalRate, failureRate, reversalRate, denialRate }
      });
      
      this.stats.anomaliesFound = anomalies.length;
      
      if (anomalies.length > 0) {
        console.log('🚨 ANOMALIES DETECTED:');
        anomalies.forEach(anomaly => console.log(`   - ${anomaly}`));
      } else {
        console.log('✅ No significant anomalies detected in transaction patterns.');
      }
      
      console.log('\n');
      
      // Generate text-based chart summary
      this.generateTransactionSummary(statusCountsObj);
      
      const processingTime = Date.now() - startTime;
      this.stats.processingTime += processingTime;
      
      console.log(`\n⏱️  Analysis completed in ${processingTime}ms`);
      console.log(`📊 Processed ${this.stats.recordsProcessed} records`);
      console.log(`🚨 Found ${this.stats.anomaliesFound} anomalies\n`);
      
      return { 
        statusCounts: statusCountsObj, 
        statusByHour: statusByHourObj, 
        anomalies,
        statisticalSummary: this.generateStatisticalSummary(statusStats)
      };
      
    } catch (error) {
      console.error('❌ Error analyzing transactions:', error.message);
      return { statusCounts: {}, statusByHour: {}, anomalies: [], error: error.message };
    }
  }
  
  // Detecção avançada de anomalias
  detectTransactionAnomalies({ statusCounts, statusStats, totalTransactions, rates }) {
    const anomalies = [];
    
    // Análise baseada em thresholds configuráveis
    const checks = [
      {
        condition: parseFloat(rates.failureRate) > this.thresholds.failureRate.critical,
        severity: 'high',
        message: `CRITICAL FAILURE RATE: ${rates.failureRate}% (Critical: >${this.thresholds.failureRate.critical}%)`
      },
      {
        condition: parseFloat(rates.failureRate) > this.thresholds.failureRate.warning,
        severity: 'medium', 
        message: `HIGH FAILURE RATE: ${rates.failureRate}% (Warning: >${this.thresholds.failureRate.warning}%)`
      },
      {
        condition: parseFloat(rates.reversalRate) > this.thresholds.reversalRate.critical,
        severity: 'high',
        message: `CRITICAL REVERSAL RATE: ${rates.reversalRate}% (Critical: >${this.thresholds.reversalRate.critical}%)`
      },
      {
        condition: parseFloat(rates.denialRate) > this.thresholds.denialRate.critical,
        severity: 'high',
        message: `CRITICAL DENIAL RATE: ${rates.denialRate}% (Critical: >${this.thresholds.denialRate.critical}%)`
      },
      {
        condition: parseFloat(rates.approvalRate) < this.thresholds.approvalRate.critical,
        severity: 'high',
        message: `CRITICAL LOW APPROVAL RATE: ${rates.approvalRate}% (Critical: <${this.thresholds.approvalRate.critical}%)`
      }
    ];
    
    // Aplicar checks
    checks.forEach(check => {
      if (check.condition) {
        anomalies.push(check.message);
      }
    });
    
    return anomalies;
  }
  
  // Gerar resumo estatístico
  generateStatisticalSummary(statusStats) {
    const summary = {};
    statusStats.forEach((values, status) => {
      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        summary[status] = {
          mean: mean.toFixed(2),
          median: sorted[Math.floor(sorted.length / 2)],
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    });
    return summary;
  }

  // Analyze checkout data with enhanced capabilities  
  async analyzeCheckouts() {
    console.log('=== CHECKOUT DATA ANALYSIS ===\n');
    const startTime = Date.now();
    
    try {
      const checkout1 = await this.loadCSVData('checkout_1.csv');
      const checkout2 = await this.loadCSVData('checkout_2.csv');
      
      const results = { dataset1: null, dataset2: null };
      
      console.log('Checkout Dataset 1 Analysis:');
      console.log('============================');
      results.dataset1 = this.analyzeCheckoutDataset(checkout1, 'Checkout 1');
      
      console.log('\nCheckout Dataset 2 Analysis:');
      console.log('============================');
      results.dataset2 = this.analyzeCheckoutDataset(checkout2, 'Checkout 2');
      
      // Generate enhanced checkout summary
      this.generateCheckoutSummary(checkout1, checkout2);
      
      const processingTime = Date.now() - startTime;
      console.log(`\n⏱️  Checkout analysis completed in ${processingTime}ms`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error analyzing checkouts:', error.message);
      return { error: error.message };
    }
  }

  analyzeCheckoutDataset(data, datasetName) {
    const anomalies = [];
    let totalToday = 0;
    let totalYesterday = 0;
    let totalWeekAvg = 0;
    let totalMonthAvg = 0;
    
    console.log('Hour | Today | Yesterday | Week Avg | Month Avg | Anomaly');
    console.log('-----|-------|-----------|----------|-----------|--------');
    
    data.forEach(row => {
      const time = row.time;
      const today = parseInt(row.today);
      const yesterday = parseInt(row.yesterday);
      const weekAvg = parseFloat(row.avg_last_week);
      const monthAvg = parseFloat(row.avg_last_month);
      
      totalToday += today;
      totalYesterday += yesterday;
      totalWeekAvg += weekAvg;
      totalMonthAvg += monthAvg;
      
      let anomalyFlag = '   ';
      
      // Detect anomalies
      if (today > weekAvg * 2.5 || today > monthAvg * 3) {
        anomalyFlag = '🔺HIGH';
        anomalies.push({
          time,
          type: 'high_volume',
          current: today,
          expected: Math.max(weekAvg, monthAvg),
          severity: 'medium'
        });
      } else if (today === 0 && weekAvg > 5) {
        anomalyFlag = '🚨ZERO';
        anomalies.push({
          time,
          type: 'zero_volume',
          current: today,
          expected: weekAvg,
          severity: 'high'
        });
      } else if (today < weekAvg * 0.3 && weekAvg > 10) {
        anomalyFlag = '🔻LOW';
        anomalies.push({
          time,
          type: 'low_volume',
          current: today,
          expected: weekAvg,
          severity: 'medium'
        });
      }
      
      console.log(`${time.padEnd(4)} | ${today.toString().padStart(5)} | ${yesterday.toString().padStart(9)} | ${weekAvg.toFixed(1).padStart(8)} | ${monthAvg.toFixed(1).padStart(9)} | ${anomalyFlag}`);
    });
    
    console.log('-----|-------|-----------|----------|-----------|--------');
    console.log(`TOTAL| ${totalToday.toString().padStart(5)} | ${totalYesterday.toString().padStart(9)} | ${totalWeekAvg.toFixed(1).padStart(8)} | ${totalMonthAvg.toFixed(1).padStart(9)} |`);
    
    console.log(`\n${datasetName} Summary:`);
    console.log(`- Today's total: ${totalToday}`);
    console.log(`- Yesterday's total: ${totalYesterday}`);
    console.log(`- Week average total: ${totalWeekAvg.toFixed(1)}`);
    console.log(`- Month average total: ${totalMonthAvg.toFixed(1)}`);
    
    const todayVsWeek = ((totalToday - totalWeekAvg) / totalWeekAvg * 100).toFixed(1);
    const todayVsYesterday = ((totalToday - totalYesterday) / totalYesterday * 100).toFixed(1);
    
    console.log(`- Change vs week average: ${todayVsWeek}%`);
    console.log(`- Change vs yesterday: ${todayVsYesterday}%`);
    
    if (anomalies.length > 0) {
      console.log(`\n🚨 ${anomalies.length} anomalies detected:`);
      anomalies.forEach(anomaly => {
        console.log(`   - ${anomaly.time}: ${anomaly.type} (${anomaly.current} vs expected ~${anomaly.expected.toFixed(1)})`);
      });
    } else {
      console.log('\n✅ No significant anomalies detected in checkout patterns.');
    }
  }

  // Generate SQL queries for analysis
  generateSQLQueries() {
    console.log('\n=== SQL QUERIES FOR ANALYSIS ===\n');
    
    const queries = {
      'Transaction Status Summary': `
-- Transaction Status Summary
SELECT 
    status,
    COUNT(*) as record_count,
    SUM(count) as total_transactions,
    AVG(count) as avg_per_minute,
    MAX(count) as max_per_minute,
    MIN(count) as min_per_minute,
    ROUND(SUM(count) * 100.0 / (SELECT SUM(count) FROM transactions), 2) as percentage
FROM transactions 
GROUP BY status 
ORDER BY total_transactions DESC;
      `,
      
      'Hourly Transaction Patterns': `
-- Hourly Transaction Patterns
SELECT 
    strftime('%H', timestamp) as hour,
    status,
    SUM(count) as total_count,
    AVG(count) as avg_count
FROM transactions 
GROUP BY strftime('%H', timestamp), status 
ORDER BY hour, status;
      `,
      
      'Anomaly Detection - Failed Transactions': `
-- Detect periods with high failed transactions
WITH failed_stats AS (
    SELECT 
        timestamp,
        count as failed_count,
        AVG(count) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as moving_avg,
        STDDEV(count) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as moving_stddev
    FROM transactions 
    WHERE status = 'failed'
)
SELECT 
    timestamp,
    failed_count,
    moving_avg,
    CASE 
        WHEN failed_count > (moving_avg + 2 * moving_stddev) THEN 'HIGH_ANOMALY'
        WHEN failed_count > (moving_avg + moving_stddev) THEN 'MEDIUM_ANOMALY'
        ELSE 'NORMAL'
    END as anomaly_level
FROM failed_stats
WHERE moving_stddev > 0
ORDER BY failed_count DESC;
      `,
      
      'Time Series Analysis': `
-- Time series analysis for pattern detection
SELECT 
    DATE(timestamp) as date,
    strftime('%H', timestamp) as hour,
    status,
    SUM(count) as hourly_total,
    LAG(SUM(count), 1) OVER (PARTITION BY status ORDER BY DATE(timestamp), strftime('%H', timestamp)) as prev_hour,
    AVG(SUM(count)) OVER (PARTITION BY status ORDER BY DATE(timestamp), strftime('%H', timestamp) ROWS BETWEEN 5 PRECEDING AND CURRENT ROW) as moving_avg_6h
FROM transactions 
GROUP BY DATE(timestamp), strftime('%H', timestamp), status
ORDER BY date, hour, status;
      `,
      
      'Checkout Analysis': `
-- Checkout anomaly detection
SELECT 
    time,
    today,
    yesterday,
    avg_last_week,
    avg_last_month,
    CASE 
        WHEN today > avg_last_week * 2.5 OR today > avg_last_month * 3 THEN 'HIGH_VOLUME'
        WHEN today = 0 AND avg_last_week > 5 THEN 'ZERO_VOLUME'
        WHEN today < avg_last_week * 0.3 AND avg_last_week > 10 THEN 'LOW_VOLUME'
        ELSE 'NORMAL'
    END as anomaly_type,
    ROUND((today - avg_last_week) / avg_last_week * 100, 2) as pct_change_week,
    ROUND((today - yesterday) / CASE WHEN yesterday = 0 THEN 1 ELSE yesterday END * 100, 2) as pct_change_yesterday
FROM checkout_data
WHERE anomaly_type != 'NORMAL'
ORDER BY 
    CASE anomaly_type 
        WHEN 'ZERO_VOLUME' THEN 1 
        WHEN 'HIGH_VOLUME' THEN 2 
        WHEN 'LOW_VOLUME' THEN 3 
    END;
      `
    };
    
    Object.entries(queries).forEach(([title, query]) => {
      console.log(`${title}:`);
      console.log('='.repeat(title.length + 1));
      console.log(query.trim());
      console.log('\n');
    });
  }

  // Chart generation methods simplified
  generateTransactionSummary(statusCounts) {
    console.log('\n📊 Transaction Status Chart Data:');
    console.log('=================================');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const bar = '█'.repeat(Math.floor(count / 1000));
      console.log(`${status.padEnd(20)} ${count.toLocaleString().padStart(8)} ${bar}`);
    });
    console.log('\n(Visual charts available in web dashboard at http://localhost:3000)');
  }

  generateCheckoutSummary(checkout1, checkout2) {
    console.log('\n📊 Checkout Volume Summary:');
    console.log('===========================');
    
    const maxToday1 = Math.max(...checkout1.map(r => parseInt(r.today)));
    const maxToday2 = Math.max(...checkout2.map(r => parseInt(r.today)));
    const maxValue = Math.max(maxToday1, maxToday2);
    
    console.log('Hour | Checkout 1 | Checkout 2 | Visual');
    console.log('-----|------------|------------|-------');
    
    checkout1.forEach((row, i) => {
      const today1 = parseInt(row.today);
      const today2 = parseInt(checkout2[i].today);
      const bar1 = '▓'.repeat(Math.floor((today1 / maxValue) * 20));
      const bar2 = '░'.repeat(Math.floor((today2 / maxValue) * 20));
      
      console.log(`${row.time.padEnd(4)} | ${today1.toString().padStart(10)} | ${today2.toString().padStart(10)} | ${bar1}${bar2}`);
    });
    
    console.log('\n(Interactive charts available in web dashboard at http://localhost:3000)');
  }

  // Run complete analysis with performance monitoring
  async runCompleteAnalysis() {
    const overallStartTime = Date.now();
    
    console.log('🔍 CloudWalk Advanced Data Analysis Started');
    console.log('==========================================\n');
    console.log(`🕐 Started at: ${new Date().toLocaleString()}`);
    console.log(`💾 Cache status: ${this.cache.size} items cached\n`);
    
    const results = {
      transactions: null,
      checkouts: null,
      performance: null
    };
    
    try {
      // Analyze transactions
      console.log('1️⃣ Analyzing transaction data...');
      results.transactions = await this.analyzeTransactions();
      
      // Analyze checkouts
      console.log('\n2️⃣ Analyzing checkout data...');
      results.checkouts = await this.analyzeCheckouts();
      
      // Generate SQL queries
      console.log('\n3️⃣ Generating SQL analysis queries...');
      this.generateSQLQueries();
      
      // Performance summary
      const totalTime = Date.now() - overallStartTime;
      results.performance = {
        totalTime,
        recordsProcessed: this.stats.recordsProcessed,
        anomaliesFound: this.stats.anomaliesFound,
        cacheHits: this.cache.size,
        efficiency: this.stats.recordsProcessed / totalTime // records per ms
      };
      
      // Final report
      console.log('\n' + '='.repeat(50));
      console.log('⚡ PERFORMANCE METRICS');
      console.log('='.repeat(50));
      console.log(`⏱️  Total analysis time: ${totalTime}ms`);
      console.log(`📊 Records processed: ${this.stats.recordsProcessed.toLocaleString()}`);
      console.log(`🚨 Total anomalies found: ${this.stats.anomaliesFound}`);
      console.log(`💾 Cache efficiency: ${this.cache.size} items`);
      console.log(`🏃 Processing speed: ${(this.stats.recordsProcessed / totalTime * 1000).toFixed(0)} records/second`);
      
      console.log('\n✅ Analysis complete! Check the dashboard at http://localhost:3000');
      console.log('💡 For real-time monitoring, the system is continuously analyzing new data.');
      
      return results;
      
    } catch (error) {
      console.error('❌ Error during analysis:', error.message);
      return { error: error.message, results };
    }
  }
}

// Run analysis if this file is executed directly
if (require.main === module) {
  const analysis = new DataAnalysis();
  analysis.runCompleteAnalysis();
}

module.exports = DataAnalysis;