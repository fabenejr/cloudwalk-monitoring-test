const express = require('express');
const WebSocket = require('ws');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();

console.log('🚀 CloudWalk Monitoring System v1.0 - FINAL');
console.log('==============================================\n');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database (in-memory)
const db = new sqlite3.Database(':memory:');

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 8080 });

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
	clients.add(ws);
	console.log('Client connected. Total clients:', clients.size);
  
	ws.on('close', () => {
		clients.delete(ws);
		console.log('Client disconnected. Total clients:', clients.size);
	});
});

// Broadcast to all connected clients
function broadcast(data) {
	clients.forEach(client => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(data));
		}
	});
}

// Initialize database tables
function initializeDatabase() {
	db.serialize(() => {
		// Transactions table
		db.run(`CREATE TABLE IF NOT EXISTS transactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME,
			status TEXT,
			count INTEGER
		)`);
    
		// Auth codes table
		db.run(`CREATE TABLE IF NOT EXISTS auth_codes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME,
			auth_code TEXT,
			count INTEGER
		)`);
    
		// Checkout data table
		db.run(`CREATE TABLE IF NOT EXISTS checkout_data (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			time TEXT,
			today INTEGER,
			yesterday INTEGER,
			same_day_last_week INTEGER,
			avg_last_week REAL,
			avg_last_month REAL,
			dataset_name TEXT
		)`);
    
		// Alerts table
		db.run(`CREATE TABLE IF NOT EXISTS alerts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
			alert_type TEXT,
			message TEXT,
			severity TEXT,
			data TEXT
		)`);
	});
}

// Track data loading readiness
let dataReady = false;
let dataLoaded = false;
let pendingLoads = 0;

// Load CSV data into database (only once on startup)
function loadCSVData() {
	if (dataLoaded) {
		console.log('CSV data already loaded, skipping...');
		return;
	}
	
	console.log('Loading CSV data...');
	dataReady = false;
	pendingLoads = 0;
	// Note: Preserving existing data for persistence - only loading CSV data once on startup
	// New transactions will be added via /api/transaction endpoint
  
	// Shared offset for aligning CSV timestamps to current time
	let txOffsetMs = null;
	// Buffers and flags for coordinating inserts
	const txRows = [];
	const authRows = [];
	let authEnded = false;
	let authProcessed = false;

	function maybeFinish() {
		if (pendingLoads === 0) {
			dataReady = true;
			dataLoaded = true;
			console.log('All CSV data loaded.');
		}
	}

	function maybeProcessAuth() {
		if (authProcessed) return;
		if (txOffsetMs === null || !authEnded) return; // wait for both
		// Insert buffered auth rows using the same offset as transactions
		const parseTs = (s) => {
			const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
			return new Date(iso);
		};
		const pad = (n) => String(n).padStart(2, '0');
		const formatTs = (d) => {
			// Use local time instead of UTC
			const year = d.getFullYear();
			const mon = pad(d.getMonth() + 1);
			const day = pad(d.getDate());
			const hh = pad(d.getHours());
			const mm = pad(d.getMinutes());
			const ss = pad(d.getSeconds());
			return `${year}-${mon}-${day} ${hh}:${mm}:${ss}`;
		};
		const stmt = db.prepare('INSERT INTO auth_codes (timestamp, auth_code, count) VALUES (?, ?, ?)');
		for (const row of authRows) {
			const t = parseTs(row.timestamp);
			const shifted = new Date(t.getTime() + txOffsetMs);
			const code = row.auth_code;
			const count = parseInt(row.count, 10);
			stmt.run([formatTs(shifted), code, isNaN(count) ? 0 : count]);
		}
		stmt.finalize();
		console.log('Auth codes data loaded (shifted with transactions offset)');
		authProcessed = true;
		pendingLoads--; // auth_codes load complete
		maybeFinish();
	}

	// Load transactions to compute shift offset
	pendingLoads++;
	fs.createReadStream('data/transactions.csv')
		.pipe(csv())
		.on('data', (row) => { txRows.push(row); })
		.on('end', () => {
			if (txRows.length === 0) {
				console.warn('transactions.csv appears empty');
			}
			// Compute offset: align dataset max timestamp to now
			const parseTs = (s) => {
				const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
				return new Date(iso);
			};
			const maxTs = txRows.reduce((acc, r) => {
				const t = parseTs(r.timestamp).getTime();
				return Math.max(acc, isFinite(t) ? t : acc);
			}, 0);
			const now = Date.now();
			const offsetMs = Math.max(0, now - maxTs);
			txOffsetMs = offsetMs;
			// Insert shifted rows with local timezone
			const pad = (n) => String(n).padStart(2, '0');
			const formatTs = (d) => {
				// Use local time instead of UTC to match system timezone
				const year = d.getFullYear();
				const mon = pad(d.getMonth() + 1);
				const day = pad(d.getDate());
				const hh = pad(d.getHours());
				const mm = pad(d.getMinutes());
				const ss = pad(d.getSeconds());
				return `${year}-${mon}-${day} ${hh}:${mm}:${ss}`;
			};
			const stmt = db.prepare('INSERT INTO transactions (timestamp, status, count) VALUES (?, ?, ?)');
			for (const r of txRows) {
				const t = parseTs(r.timestamp);
				const shifted = new Date(t.getTime() + offsetMs);
				const status = r.status;
				const count = parseInt(r.count, 10);
				stmt.run([formatTs(shifted), status, isNaN(count) ? 0 : count]);
			}
			stmt.finalize();
			console.log('Transactions data loaded (shifted to current time)');
			pendingLoads--; 
			maybeProcessAuth();
			maybeFinish();
		});
  
	// Buffer auth codes to apply same offset
	pendingLoads++;
	fs.createReadStream('data/transactions_auth_codes.csv')
		.pipe(csv())
		.on('data', (row) => {
			authRows.push(row);
		})
		.on('end', () => {
			authEnded = true;
			maybeProcessAuth();
		});
  
	// Load checkout data 1
	pendingLoads++;
	fs.createReadStream('data/checkout_1.csv')
		.pipe(csv())
		.on('data', (row) => {
			const time = row.time;
			const today = parseInt(row.today, 10);
			const yesterday = parseInt(row.yesterday, 10);
			const same = parseInt(row.same_day_last_week, 10);
			const avgW = parseFloat(row.avg_last_week);
			const avgM = parseFloat(row.avg_last_month);
			db.run('INSERT INTO checkout_data (time, today, yesterday, same_day_last_week, avg_last_week, avg_last_month, dataset_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
				[time, isNaN(today) ? 0 : today, isNaN(yesterday) ? 0 : yesterday, 
				 isNaN(same) ? 0 : same, isNaN(avgW) ? 0 : avgW, 
				 isNaN(avgM) ? 0 : avgM, 'checkout_1']);
		})
		.on('end', () => {
			console.log('Checkout 1 data loaded');
			pendingLoads--; maybeFinish();
		});
  
	// Load checkout data 2
	pendingLoads++;
	fs.createReadStream('data/checkout_2.csv')
		.pipe(csv())
		.on('data', (row) => {
			const time = row.time;
			const today = parseInt(row.today, 10);
			const yesterday = parseInt(row.yesterday, 10);
			const same = parseInt(row.same_day_last_week, 10);
			const avgW = parseFloat(row.avg_last_week);
			const avgM = parseFloat(row.avg_last_month);
			db.run('INSERT INTO checkout_data (time, today, yesterday, same_day_last_week, avg_last_week, avg_last_month, dataset_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
				[time, isNaN(today) ? 0 : today, isNaN(yesterday) ? 0 : yesterday, 
				 isNaN(same) ? 0 : same, isNaN(avgW) ? 0 : avgW, 
				 isNaN(avgM) ? 0 : avgM, 'checkout_2']);
		})
		.on('end', () => {
			console.log('Checkout 2 data loaded');
			pendingLoads--; maybeFinish();
		});
}

// Anomaly detection algorithms
class AnomalyDetector {
	constructor() {
		this.thresholds = {
			failed: { multiplier: 2.5, minCount: 10 },
			denied: { multiplier: 2.0, minCount: 5 },
			reversed: { multiplier: 3.0, minCount: 8 },
			backend_reversed: { multiplier: 2.5, minCount: 3 }
		};
	}

	// Calculate statistical anomalies using Z-score
	calculateZScore(current, mean, stdDev) {
		if (stdDev === 0) return 0;
		return Math.abs((current - mean) / stdDev);
	}

	// Calculate moving average
	calculateMovingAverage(data, windowSize = 10) {
		if (data.length < windowSize) return data.reduce((a, b) => a + b, 0) / data.length;
    
		const window = data.slice(-windowSize);
		return window.reduce((a, b) => a + b, 0) / windowSize;
	}

	// Detect transaction anomalies (24h window relative to now)
	async detectTransactionAnomalies() {
		return new Promise((resolve, reject) => {
			// Use proper time filtering for recent data only
			const now = new Date();
			const cutoffTime = new Date(now.getTime() - (24 * 60 * 60 * 1000));
			const pad = (n) => String(n).padStart(2, '0');
			const cutoffStr = `${cutoffTime.getFullYear()}-${pad(cutoffTime.getMonth() + 1)}-${pad(cutoffTime.getDate())} ${pad(cutoffTime.getHours())}:${pad(cutoffTime.getMinutes())}:${pad(cutoffTime.getSeconds())}`;
			
			const query = `
				SELECT 
					status,
					COUNT(*) as total_count,
					AVG(count) as avg_count,
					MAX(count) as max_count,
					MIN(count) as min_count
				FROM transactions 
				WHERE timestamp >= '${cutoffStr}'
				GROUP BY status
			`;
      
			db.all(query, [], (err, rows) => {
				if (err) {
					reject(err);
					return;
				}
        
				const anomalies = [];
        
				rows.forEach(row => {
					const { status, avg_count, max_count } = row;
          
					if (this.thresholds[status]) {
						const threshold = this.thresholds[status];
            
						// Rule-based detection
						if (avg_count > threshold.minCount && max_count > avg_count * threshold.multiplier) {
							anomalies.push({
								type: 'transaction_anomaly',
								status: status,
								current_avg: avg_count,
								max_count: max_count,
								threshold: avg_count * threshold.multiplier,
								severity: max_count > avg_count * threshold.multiplier * 1.5 ? 'high' : 'medium',
								message: `${status} transactions showing unusual activity: ${max_count} peak vs ${avg_count.toFixed(2)} average`
							});
						}
					}
				});
        
				resolve(anomalies);
			});
		});
	}

	// Detect checkout anomalies
	async detectCheckoutAnomalies() {
		return new Promise((resolve, reject) => {
			const query = `
				SELECT 
					time,
					today,
					yesterday,
					avg_last_week,
					avg_last_month,
					dataset_name
				FROM checkout_data
			`;
      
			db.all(query, [], (err, rows) => {
				if (err) {
					reject(err);
					return;
				}
        
				const anomalies = [];
        
				rows.forEach(row => {
					const { time, today, avg_last_week, avg_last_month, dataset_name } = row;
          
					// Compare today with historical averages
					const weekThreshold = avg_last_week * 2.5;
					const monthThreshold = avg_last_month * 3.0;
          
					if (today > weekThreshold || today > monthThreshold) {
						anomalies.push({
							type: 'checkout_anomaly',
							time: time,
							dataset: dataset_name,
							current: today,
							week_avg: avg_last_week,
							month_avg: avg_last_month,
							severity: today > Math.max(weekThreshold, monthThreshold) * 1.5 ? 'high' : 'medium',
							message: `Unusual checkout activity at ${time}: ${today} vs week avg ${avg_last_week.toFixed(2)}, month avg ${avg_last_month.toFixed(2)}`
						});
					}
          
					// Detect sudden drops (potential system issues)
					if (today === 0 && avg_last_week > 5) {
						anomalies.push({
							type: 'checkout_drop',
							time: time,
							dataset: dataset_name,
							current: today,
							expected: avg_last_week,
							severity: 'high',
							message: `Critical: Zero checkouts at ${time}, expected ~${avg_last_week.toFixed(2)} based on historical data`
						});
					}
				});
        
				resolve(anomalies);
			});
		});
	}
}

const anomalyDetector = new AnomalyDetector();

// Store alert in database
function storeAlert(alert) {
	db.run('INSERT INTO alerts (alert_type, message, severity, data) VALUES (?, ?, ?, ?)',
		[alert.type, alert.message, alert.severity, JSON.stringify(alert)],
		function(err) {
			if (err) {
				console.error('Error storing alert:', err);
			} else {
				console.log('Alert stored with ID:', this.lastID);
			}
		});
}

// API Routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
	res.json({ status: 'ok', dataReady });
});

// Note: Removed /admin/reload endpoint - data persistence is now handled automatically

// Endpoint to receive transaction data
app.post('/api/transaction', async (req, res) => {
	try {
		const { timestamp, status, count } = req.body;
    
		if (!timestamp || !status || count === undefined) {
			return res.status(400).json({ error: 'Missing required fields: timestamp, status, count' });
		}
    
		// Store transaction in database
		db.run('INSERT INTO transactions (timestamp, status, count) VALUES (?, ?, ?)',
			[timestamp, status, count], function(err) {
				if (err) {
					console.error('Error inserting transaction:', err);
					return res.status(500).json({ error: 'Database error' });
				}
			});
    
		// Check for anomalies
		const anomalies = await anomalyDetector.detectTransactionAnomalies();
    
		let recommendation = 'normal';
		if (anomalies.length > 0) {
			recommendation = 'alert';
      
			// Store and broadcast alerts
			anomalies.forEach(alert => {
				storeAlert(alert);
				broadcast({
					type: 'alert',
					data: alert
				});
			});
		}
    
		// Broadcast real-time data
		broadcast({
			type: 'transaction',
			data: { timestamp, status, count }
		});
    
		res.json({
			recommendation,
			anomalies,
			message: anomalies.length > 0 ? 'Anomalies detected' : 'Transaction processed normally'
		});
    
	} catch (error) {
		console.error('Error processing transaction:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get current transaction statistics
app.get('/api/stats', (req, res) => {
	const hours = req.query.hours ? parseInt(req.query.hours, 10) : null; // e.g., 1, 6, 24, 720, 4320
	
	// Create proper time-based filter
	let where = '';
	if (hours && !isNaN(hours)) {
		const now = new Date();
		const cutoffTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
		const pad = (n) => String(n).padStart(2, '0');
		const cutoffStr = `${cutoffTime.getFullYear()}-${pad(cutoffTime.getMonth() + 1)}-${pad(cutoffTime.getDate())} ${pad(cutoffTime.getHours())}:${pad(cutoffTime.getMinutes())}:${pad(cutoffTime.getSeconds())}`;
		where = `WHERE timestamp >= '${cutoffStr}'`;
	}
	
	const query = `
		SELECT 
			status,
			COUNT(*) as total,
			AVG(count) as avg_count,
			MAX(count) as max_count,
			MIN(count) as min_count,
			SUM(count) as sum_count
		FROM transactions 
		${where}
		GROUP BY status
		ORDER BY sum_count DESC
	`;
  
	db.all(query, [], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		// If windowed query returned empty, return recent data instead of all-time
		if ((!rows || rows.length === 0) && hours) {
			const fallback = `
				SELECT 
					status,
					COUNT(*) as total,
					AVG(count) as avg_count,
					MAX(count) as max_count,
					MIN(count) as min_count,
					SUM(count) as sum_count
				FROM transactions 
				WHERE timestamp >= datetime('now', '-24 hours')
				GROUP BY status
				ORDER BY sum_count DESC
			`;
			db.all(fallback, [], (err2, rows2) => {
				if (err2) return res.status(500).json({ error: err2.message });
				return res.json(rows2);
			});
		} else {
			res.json(rows);
		}
	});
});

// Get recent alerts
app.get('/api/alerts', (req, res) => {
	const limit = req.query.limit || 50;
	const query = `
		SELECT * FROM alerts 
		ORDER BY timestamp DESC 
		LIMIT ?
	`;
  
	db.all(query, [limit], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
    
		// Parse JSON data field
		const alerts = rows.map(row => ({
			...row,
			data: JSON.parse(row.data)
		}));
    
		res.json(alerts);
	});
});

// Get time series data for charts
app.get('/api/timeseries', (req, res) => {
	const hours = req.query.hours ? parseInt(req.query.hours, 10) : null; // e.g., 1, 6, 24, 720, 4320
	// Use proper time filtering based on actual recent time, not shifted CSV data
	const now = new Date();
	const cutoffTime = hours ? new Date(now.getTime() - (hours * 60 * 60 * 1000)) : null;
	
	let where = '';
	if (cutoffTime) {
		// Format cutoff time for SQLite comparison
		const pad = (n) => String(n).padStart(2, '0');
		const cutoffStr = `${cutoffTime.getFullYear()}-${pad(cutoffTime.getMonth() + 1)}-${pad(cutoffTime.getDate())} ${pad(cutoffTime.getHours())}:${pad(cutoffTime.getMinutes())}:${pad(cutoffTime.getSeconds())}`;
		where = `WHERE timestamp >= '${cutoffStr}'`;
	}
	
	const query = `
		SELECT 
			datetime(timestamp, 'localtime') as time_local,
			status,
			SUM(count) as total_count
		FROM transactions 
		${where}
		GROUP BY datetime(timestamp, 'localtime'), status
		ORDER BY time_local
	`;
  
	db.all(query, [], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		// Fallback to full series if windowed result is empty
		if ((!rows || rows.length === 0) && hours) {
			// If no data in the requested time window, return recent data instead
			const fallback = `
				SELECT 
					datetime(timestamp, 'localtime') as time_local,
					status,
					SUM(count) as total_count
				FROM transactions 
				WHERE timestamp >= datetime('now', '-24 hours')
				GROUP BY datetime(timestamp, 'localtime'), status
				ORDER BY time_local DESC
				LIMIT 100
			`;
			db.all(fallback, [], (err2, rows2) => {
				if (err2) return res.status(500).json({ error: err2.message });
				return res.json(rows2);
			});
		} else {
			res.json(rows);
		}
	});
});

// Get checkout analysis data
app.get('/api/checkout-analysis', (req, res) => {
	const query = `
		SELECT * FROM checkout_data
		ORDER BY 
			CASE time
				WHEN '00h' THEN 0 WHEN '01h' THEN 1 WHEN '02h' THEN 2 WHEN '03h' THEN 3
				WHEN '04h' THEN 4 WHEN '05h' THEN 5 WHEN '06h' THEN 6 WHEN '07h' THEN 7
				WHEN '08h' THEN 8 WHEN '09h' THEN 9 WHEN '10h' THEN 10 WHEN '11h' THEN 11
				WHEN '12h' THEN 12 WHEN '13h' THEN 13 WHEN '14h' THEN 14 WHEN '15h' THEN 15
				WHEN '16h' THEN 16 WHEN '17h' THEN 17 WHEN '18h' THEN 18 WHEN '19h' THEN 19
				WHEN '20h' THEN 20 WHEN '21h' THEN 21 WHEN '22h' THEN 22 WHEN '23h' THEN 23
				ELSE 24
			END,
			dataset_name
	`;
  
	db.all(query, [], (err, rows) => {
		if (err) {
			res.status(500).json({ error: err.message });
			return;
		}
		res.json(rows);
	});
});

// Scheduled anomaly detection
cron.schedule('*/5 * * * *', async () => {
	console.log('Running scheduled anomaly detection...');
  
	try {
		if (!dataReady) {
			console.log('Data not ready yet, skipping this run.');
			return;
		}
		const transactionAnomalies = await anomalyDetector.detectTransactionAnomalies();
		const checkoutAnomalies = await anomalyDetector.detectCheckoutAnomalies();
    
		const allAnomalies = [...transactionAnomalies, ...checkoutAnomalies];
    
		if (allAnomalies.length > 0) {
			console.log(`Found ${allAnomalies.length} anomalies`);
      
			allAnomalies.forEach(alert => {
				storeAlert(alert);
				broadcast({
					type: 'scheduled_alert',
					data: alert
				});
			});
		}
	} catch (error) {
		console.error('Error in scheduled anomaly detection:', error);
	}
});

// Initialize and start server
initializeDatabase();

// Load CSV data after a short delay to ensure database is ready
setTimeout(loadCSVData, 1000);

app.listen(PORT, () => {
	console.log(`Monitoring server running on port ${PORT}`);
	console.log(`WebSocket server running on port 8080`);
	console.log(`Dashboard available at http://localhost:${PORT}`);
});

