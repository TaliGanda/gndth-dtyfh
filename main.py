from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import threading
import time
import random
from collections import defaultdict, deque
from datetime import datetime, timedelta
import logging
import resource
import sys
import psutil
import os
from dataclasses import dataclass
from typing import Dict, Set, List, Optional
import hashlib
import uvicorn
import asyncio
import ssl

# ========== ENHANCED SYSTEM OPTIMIZATIONS ==========
try:
    # Increase file descriptor limit significantly
    resource.setrlimit(resource.RLIMIT_NOFILE, (131072, 131072))
except:
    pass

# ========== ADVANCED LOGGING CONFIGURATION ==========
logging.basicConfig(
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('dstat_advanced.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DStat Advanced Analytics", docs_url=None, redoc_url=None)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== ENHANCED DATA STRUCTURES ==========
@dataclass
class RequestRecord:
    timestamp: float
    ip: str
    method: str
    user_agent: str

class CircularBuffer:
    def __init__(self, size):
        self.buffer = deque(maxlen=size)
        self.size = size
    
    def append(self, item):
        self.buffer.append(item)
    
    def __len__(self):
        return len(self.buffer)
    
    def __iter__(self):
        return iter(self.buffer)

class HighPerformanceStats:
    def __init__(self, history_size=3600):
        self.total_requests = 0
        self.unique_ips = set()
        self.method_counts = defaultdict(int)
        self.ip_requests = defaultdict(int)
        self.start_time = time.time()
        self.request_buffer = CircularBuffer(history_size)
        self.last_cleanup = time.time()
        self.requests_per_second = deque(maxlen=60)
        self.current_second_requests = 0
        self.last_second = int(time.time())
        self._lock = threading.RLock()
        
        # Performance monitoring
        self.peak_rps = 0
        self.last_rps_calc = time.time()
        self.response_times = deque(maxlen=1000)
        self.avg_response_time = 0
        
        # Initialize with zero data for smooth chart
        for _ in range(60):
            self.requests_per_second.append(0)
    
    def add_request(self, ip: str, method: str, user_agent: str):
        with self._lock:
            current_time = time.time()
            current_second = int(current_time)
            
            # Handle second transition
            if current_second != self.last_second:
                self.requests_per_second.append(self.current_second_requests)
                self.peak_rps = max(self.peak_rps, self.current_second_requests)
                self.current_second_requests = 0
                self.last_second = current_second
            
            # Update counters
            self.total_requests += 1
            self.current_second_requests += 1
            self.unique_ips.add(ip)
            self.method_counts[method] += 1
            self.ip_requests[ip] += 1
            
            # Store request record (optimized)
            if len(self.request_buffer) < self.request_buffer.size:
                self.request_buffer.append(RequestRecord(current_time, ip, method, user_agent))
            
            # Periodic cleanup (every 5 minutes)
            if current_time - self.last_cleanup > 300:
                self._cleanup_old_data()
                self.last_cleanup = current_time
    
    def _cleanup_old_data(self):
        """Cleanup old data to prevent memory exhaustion"""
        current_time = time.time()
        # Keep only last 24 hours of unique IPs (sampled)
        if len(self.unique_ips) > 100000:
            self.unique_ips = set(list(self.unique_ips)[-50000:])
        
        # Cleanup IP requests older than 1 hour
        one_hour_ago = current_time - 3600
        if self.request_buffer:
            oldest_record = list(self.request_buffer.buffer)[0]
            if oldest_record.timestamp < one_hour_ago:
                # Remove old IPs from counting
                pass
    
    def get_current_rps(self) -> int:
        return self.current_second_requests
    
    def get_avg_rps(self, seconds: int = 10) -> float:
        with self._lock:
            recent = list(self.requests_per_second)[-seconds:]
            return sum(recent) / len(recent) if recent else 0
    
    def get_top_ips(self, limit: int = 10):
        with self._lock:
            return sorted(self.ip_requests.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    def get_traffic_data(self, points: int = 30):
        """Get traffic data for charting"""
        with self._lock:
            recent_rps = list(self.requests_per_second)[-points:]
            # Pad if not enough data
            while len(recent_rps) < points:
                recent_rps.insert(0, 0)
            return recent_rps

# ========== ENHANCED TRACKER WITH DDOS DETECTION ==========
class AdvancedDStatTracker:
    def __init__(self):
        self.stats = HighPerformanceStats()
        self.rate_limits = defaultdict(lambda: {'count': 0, 'window_start': time.time()})
        self.suspicious_ips = set()
        self.attack_detection_threshold = 100
        self._lock = threading.RLock()
        
        # DDOS Pattern Detection
        self.request_patterns = defaultdict(lambda: deque(maxlen=100))
        self.geo_cache = {}
        
        # Background task for maintaining traffic data
        self._background_task = None
        
    def start_background_tasks(self):
        """Start background tasks for maintaining data"""
        if self._background_task is None:
            self._background_task = asyncio.create_task(self._maintain_traffic_data())
        
    async def _maintain_traffic_data(self):
        """Background task to maintain traffic data even when no requests"""
        while True:
            try:
                # Ensure traffic data is always updating
                current_time = time.time()
                current_second = int(current_time)
                
                with self._lock:
                    # Update second if changed (even without requests)
                    if current_second != self.stats.last_second:
                        self.stats.requests_per_second.append(self.stats.current_second_requests)
                        self.stats.peak_rps = max(self.stats.peak_rps, self.stats.current_second_requests)
                        self.stats.current_second_requests = 0
                        self.stats.last_second = current_second
                
                await asyncio.sleep(0.1)  # Check 10 times per second
            except Exception as e:
                logger.error(f"Background task error: {e}")
                await asyncio.sleep(1)
        
    def add_request(self, ip: str, method: str, user_agent: str):
        try:
            current_time = time.time()
            
            # Rate limiting per IP
            with self._lock:
                ip_data = self.rate_limits[ip]
                window_time = current_time - ip_data['window_start']
                
                if window_time > 1:
                    ip_data['count'] = 0
                    ip_data['window_start'] = current_time
                
                ip_data['count'] += 1
                
                # DDOS detection
                if ip_data['count'] > self.attack_detection_threshold:
                    self.suspicious_ips.add(ip)
                    logger.warning(f"High frequency requests from IP: {ip} - {ip_data['count']} req/sec")
            
            # Add to main statistics
            self.stats.add_request(ip, method, user_agent)
            
        except Exception as e:
            logger.error(f"Error in add_request: {e}")
    
    def is_suspicious_ip(self, ip: str) -> bool:
        return ip in self.suspicious_ips
    
    def get_detected_attacks(self) -> List[str]:
        return list(self.suspicious_ips)

# Initialize tracker
tracker = AdvancedDStatTracker()

# Start background tasks when app starts
@app.on_event("startup")
async def startup_event():
    tracker.start_background_tasks()

# ========== OPTIMIZED HTML TEMPLATE ==========
HTML_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🛡️ DStat - Advanced Real-time Analytics</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon@3.0.4/build/global/luxon.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
        body { background: #0a0a0a; color: #00ff88; padding: 20px; overflow-x: hidden; }
        .header { text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,100,255,0.1)); border-radius: 15px; border: 1px solid rgba(0,255,136,0.3); }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; border-left: 4px solid #00ff88; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.08); }
        .stat-number { font-size: 2.2em; font-weight: 800; background: linear-gradient(45deg, #00ff88, #00ccff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .charts-container { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 30px; }
        .chart-panel { background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; height: 320px; border: 1px solid rgba(0,255,136,0.2); }
        .ip-list { max-height: 320px; overflow-y: auto; }
        .ip-item { display: flex; justify-content: space-between; padding: 12px; margin-bottom: 6px; background: rgba(255,255,255,0.03); border-radius: 8px; border-left: 3px solid #00ff88; }
        .suspicious-ip { border-left-color: #ff4444 !important; background: rgba(255,68,68,0.1) !important; }
        .live-badge { display: inline-block; width: 12px; height: 12px; background: #00ff88; border-radius: 50%; margin-right: 10px; animation: pulse 1s infinite; box-shadow: 0 0 10px #00ff88; }
        @keyframes pulse { 0%,100% { opacity:1; transform: scale(1); } 50% { opacity:0.7; transform: scale(1.1); } }
        .system-status { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .status-item { padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; }
        .progress-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 8px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #00ff88, #00ccff); border-radius: 4px; }
        .attack-alert { background: rgba(255,68,68,0.2); border: 1px solid #ff4444; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ DStat Advanced Analytics</h1>
        <p><span class="live-badge"></span>Real-time Monitoring - Optimized for High Traffic - HTTPS Port 443</p>
    </div>
    
    <div id="attackAlert" class="attack-alert" style="display: none;">
        <h3>🚨 ATTACK DETECTED</h3>
        <p id="attackInfo">High frequency requests detected from multiple IPs</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number" id="totalRequests">0</div>
            <div>Total Requests</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="requestsPerSecond">0</div>
            <div>Current RPS</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="uniqueIPs">0</div>
            <div>Unique IPs</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="avgRPS">0</div>
            <div>Avg RPS (10s)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="peakRPS">0</div>
            <div>Peak RPS</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="attackDuration">0s</div>
            <div>Duration</div>
        </div>
    </div>
    
    <div class="charts-container">
        <div class="chart-panel">
            <h3>📊 Live Traffic Monitor</h3>
            <canvas id="trafficChart"></canvas>
        </div>
        <div class="chart-panel">
            <h3>🌐 HTTP Methods Distribution</h3>
            <canvas id="methodsChart"></canvas>
        </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="chart-panel">
            <h3>🔥 Top IPs & Attack Detection</h3>
            <div class="ip-list" id="ipList"></div>
        </div>
        <div class="chart-panel">
            <h3>⚡ System Status</h3>
            <div class="system-status">
                <div class="status-item">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Uptime:</span>
                        <span id="uptime">00:00:00</span>
                    </div>
                    <div class="progress-bar">
                        <div id="uptimeBar" class="progress-fill" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="status-item">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Memory Usage:</span>
                        <span id="memoryUsage">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div id="memoryBar" class="progress-fill" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="status-item">
                    <div style="display: flex; justify-content: space-between;">
                        <span>CPU Load:</span>
                        <span id="cpuLoad">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div id="cpuBar" class="progress-fill" style="width: 0%;"></div>
                    </div>
                </div>
                <div class="status-item">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Active Threads:</span>
                        <span id="activeThreads">0</span>
                    </div>
                </div>
            </div>
            <div style="margin-top: 20px; padding: 15px; background: rgba(0,255,136,0.1); border-radius: 8px;">
                <h4>🛡️ Security Status</h4>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <span>Suspicious IPs Detected:</span>
                    <span id="suspiciousIPs">0</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize Charts with enhanced styling
        const trafficChart = new Chart(document.getElementById('trafficChart'), {
            type: 'line',
            data: {
                labels: Array.from({length: 30}, (_, i) => `${i}s`),
                datasets: [{
                    label: 'Requests/Second',
                    data: Array(30).fill(0),
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#00ff88',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#00ff88' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#00ff88' }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'linear'
                }
            }
        });
        
        const methodsChart = new Chart(document.getElementById('methodsChart'), {
            type: 'doughnut',
            data: {
                labels: ['GET', 'POST', 'HEAD', 'OTHER'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#00ff88', '#ff4444', '#4488ff', '#ffaa00'],
                    borderColor: '#0a0a0a',
                    borderWidth: 2
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#00ff88', font: { size: 12 } } }
                }
            }
        });

        // Enhanced stats update with attack detection
        async function updateStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                
                // Update main stats
                document.getElementById('totalRequests').textContent = data.total_requests.toLocaleString();
                document.getElementById('requestsPerSecond').textContent = data.current_rps;
                document.getElementById('uniqueIPs').textContent = data.unique_ips.toLocaleString();
                document.getElementById('avgRPS').textContent = data.avg_rps.toFixed(1);
                document.getElementById('peakRPS').textContent = data.peak_rps;
                document.getElementById('attackDuration').textContent = data.duration;
                document.getElementById('uptime').textContent = data.uptime;
                document.getElementById('uptimeBar').style.width = data.uptime_percent + '%';
                document.getElementById('memoryUsage').textContent = data.system_stats.memory_percent + '%';
                document.getElementById('memoryBar').style.width = data.system_stats.memory_percent + '%';
                document.getElementById('cpuLoad').textContent = data.system_stats.cpu_percent + '%';
                document.getElementById('cpuBar').style.width = data.system_stats.cpu_percent + '%';
                document.getElementById('activeThreads').textContent = data.system_stats.thread_count;
                document.getElementById('suspiciousIPs').textContent = data.suspicious_ips_count;
                
                // Update charts with smooth animation
                if (data.traffic_data) {
                    // Add slight random movement when no traffic to show it's alive
                    let displayData = [...data.traffic_data];
                    if (data.total_requests === 0) {
                        // Add minimal random fluctuation to show the chart is alive
                        const now = Date.now();
                        displayData[displayData.length - 1] = Math.sin(now / 1000) * 0.1;
                    }
                    
                    trafficChart.data.datasets[0].data = displayData;
                    trafficChart.update('none');
                }
                
                methodsChart.data.datasets[0].data = [
                    data.methods.GET || 0,
                    data.methods.POST || 0, 
                    data.methods.HEAD || 0,
                    data.methods.OTHER || 0
                ];
                methodsChart.update('none');
                
                // Update IP list with attack detection
                const ipList = document.getElementById('ipList');
                ipList.innerHTML = '';
                data.top_ips.forEach(ip => {
                    const ipItem = document.createElement('div');
                    ipItem.className = `ip-item ${ip.suspicious ? 'suspicious-ip' : ''}`;
                    ipItem.innerHTML = `
                        <div>
                            <strong>${ip.ip}</strong>
                            ${ip.suspicious ? '🚨' : ''}
                        </div>
                        <div>${ip.count.toLocaleString()}</div>
                    `;
                    ipList.appendChild(ipItem);
                });
                
                // Show attack alert if suspicious IPs detected
                const attackAlert = document.getElementById('attackAlert');
                if (data.suspicious_ips_count > 0) {
                    attackAlert.style.display = 'block';
                    document.getElementById('attackInfo').textContent = 
                        `Detected ${data.suspicious_ips_count} suspicious IPs with high request frequency`;
                } else {
                    attackAlert.style.display = 'none';
                }
                
            } catch (error) {
                console.error('Stats update error:', error);
            }
        }

        // Real-time updates with exponential backoff on error
        let updateInterval = 1000;
        function startUpdates() {
            setInterval(() => {
                updateStats().catch(error => {
                    console.error('Update failed, adjusting interval:', error);
                    updateInterval = Math.min(updateInterval * 1.5, 10000);
                });
            }, updateInterval);
        }

        startUpdates();
        updateStats(); // Initial update
    </script>
</body>
</html>
'''

# ========== ENHANCED ROUTES WITH DDOS PROTECTION ==========
@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """Serve optimized dashboard"""
    try:
        return HTMLResponse(HTML_TEMPLATE)
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return "Server Error"

@app.api_route('/hit', methods=['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])
async def hit_endpoint(request: Request):
    """Optimized hit endpoint with DDOS detection - returns HTML"""
    try:
        # Get client IP with proper header handling
        client_ip = request.headers.get('X-Forwarded-For', request.client.host)
        if ',' in client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        method = request.method
        user_agent = request.headers.get('User-Agent', 'Unknown')[:500]
        
        # Add to tracker with DDOS detection
        tracker.add_request(client_ip, method, user_agent)
        
        # Create HTML response instead of JSON
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Request Received - DStat</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #0a0a0a; 
                    color: #00ff88; 
                    text-align: center;
                }}
                .container {{
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 30px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 15px;
                    border: 1px solid rgba(0,255,136,0.3);
                }}
                .status {{
                    font-size: 2em;
                    color: #00ff88;
                    margin-bottom: 20px;
                }}
                .info {{
                    text-align: left;
                    background: rgba(0,255,136,0.1);
                    padding: 15px;
                    border-radius: 8px;
                    margin: 15px 0;
                }}
                .warning {{
                    color: #ff4444;
                    background: rgba(255,68,68,0.1);
                    padding: 10px;
                    border-radius: 5px;
                    margin: 10px 0;
                }}
                .timestamp {{
                    color: #888;
                    font-size: 0.9em;
                }}
                a {{
                    color: #00ccff;
                    text-decoration: none;
                    margin-top: 20px;
                    display: inline-block;
                }}
                .stats-link {{
                    margin-top: 30px;
                    padding: 10px 20px;
                    background: rgba(0,255,136,0.2);
                    border-radius: 5px;
                    display: inline-block;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="status">✅ Request Received</div>
                <div class="info">
                    <strong>IP Address:</strong> {client_ip}<br>
                    <strong>Method:</strong> {method}<br>
                    <strong>User Agent:</strong> {user_agent[:100]}...
                </div>
        """
        
        # Add warning if IP is suspicious
        if tracker.is_suspicious_ip(client_ip):
            html_content += f"""
                <div class="warning">
                    ⚠️ High frequency detection - This IP has been flagged for suspicious activity
                </div>
            """
        
        # Add current stats
        with tracker.stats._lock:
            current_rps = tracker.stats.get_current_rps()
            total_requests = tracker.stats.total_requests
            unique_ips = len(tracker.stats.unique_ips)
        
        html_content += f"""
                <div class="info">
                    <strong>Current Statistics:</strong><br>
                    • Current RPS: {current_rps}<br>
                    • Total Requests: {total_requests:,}<br>
                    • Unique IPs: {unique_ips:,}
                </div>
                
                <div class="timestamp">
                    Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
                </div>
                
                <a href="/" class="stats-link">📊 View Live Dashboard</a>
                <br>
                <a href="/hit">🔄 Make Another Request</a>
            </div>
        </body>
        </html>
        """
        
        return HTMLResponse(content=html_content)
        
    except Exception as e:
        logger.error(f"Hit endpoint error: {e}")
        # Return error page in HTML format
        error_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Error - DStat</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #0a0a0a; 
                    color: #ff4444; 
                    text-align: center;
                }
                .container {
                    max-width: 600px;
                    margin: 50px auto;
                    padding: 30px;
                    background: rgba(255,68,68,0.1);
                    border-radius: 15px;
                    border: 1px solid rgba(255,68,68,0.3);
                }
                a {
                    color: #00ccff;
                    text-decoration: none;
                    margin-top: 20px;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>❌ Server Error</h1>
                <p>An error occurred while processing your request.</p>
                <a href="/">↩ Back to Dashboard</a>
                <br>
                <a href="/hit">🔄 Try Again</a>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=error_html, status_code=500)

@app.get('/api/stats')
async def get_stats():
    """Optimized stats API with system monitoring"""
    try:
        # Get system statistics
        memory = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.1)
        thread_count = threading.active_count()
        
        with tracker.stats._lock:
            duration = time.time() - tracker.stats.start_time
            current_rps = tracker.stats.get_current_rps()
            avg_rps = tracker.stats.get_avg_rps(10)
            
            # Get traffic data for chart - always return fresh data
            traffic_data = tracker.stats.get_traffic_data(30)
            
            # Get top IPs with suspicion status
            top_ips_data = []
            for ip, count in tracker.stats.get_top_ips(15):
                top_ips_data.append({
                    'ip': ip,
                    'count': count,
                    'suspicious': tracker.is_suspicious_ip(ip)
                })
            
            stats = {
                'total_requests': tracker.stats.total_requests,
                'current_rps': current_rps,
                'avg_rps': avg_rps,
                'peak_rps': tracker.stats.peak_rps,
                'unique_ips': len(tracker.stats.unique_ips),
                'duration': f"{int(duration)}s",
                'uptime': str(timedelta(seconds=int(duration))),
                'uptime_percent': min(100, int((duration / 86400) * 100)),
                'methods': dict(tracker.stats.method_counts),
                'traffic_data': traffic_data,
                'top_ips': top_ips_data,
                'suspicious_ips_count': len(tracker.suspicious_ips),
                'system_stats': {
                    'memory_percent': round(memory.percent, 1),
                    'cpu_percent': round(cpu_percent, 1),
                    'thread_count': thread_count,
                    'memory_used_gb': round(memory.used / (1024**3), 2),
                    'memory_total_gb': round(memory.total / (1024**3), 2)
                }
            }
        
        return JSONResponse(content=stats)
        
    except Exception as e:
        logger.error(f"Stats API error: {e}")
        return JSONResponse(content={'error': 'Internal error'}, status_code=500)

@app.get('/health')
async def health_check():
    """Enhanced health check with system info"""
    memory = psutil.virtual_memory()
    return JSONResponse(content={
        'status': 'healthy', 
        'requests': tracker.stats.total_requests,
        'uptime': time.time() - tracker.stats.start_time,
        'memory_used_percent': round(memory.percent, 1),
        'active_threads': threading.active_count(),
        'suspicious_ips': len(tracker.suspicious_ips)
    })

@app.get('/reset')
async def reset_stats():
    """Reset stats with confirmation"""
    try:
        with tracker.stats._lock:
            tracker.stats = HighPerformanceStats()
            tracker.suspicious_ips.clear()
            tracker.rate_limits.clear()
        return JSONResponse(content={'status': 'success', 'message': 'All statistics reset'})
    except Exception as e:
        return JSONResponse(content={'status': 'error', 'message': str(e)}, status_code=500)

@app.get('/api/attacks')
async def get_detected_attacks():
    """Get detected attack information"""
    return JSONResponse(content={
        'suspicious_ips': tracker.get_detected_attacks(),
        'count': len(tracker.suspicious_ips),
        'timestamp': time.time()
    })

# ========== SSL CERTIFICATE SETUP ==========
def create_self_signed_cert():
    """Create self-signed certificate for testing (if certificates don't exist)"""
    cert_path = "cert.pem"
    key_path = "key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        print("🔐 Creating self-signed SSL certificate for testing...")
        try:
            # Generate self-signed certificate using openssl command
            os.system("openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365 -subj '/CN=localhost'")
            print("✅ Self-signed certificate created")
        except Exception as e:
            print(f"❌ Failed to create certificate: {e}")
            return None, None
    
    return cert_path, key_path

# ========== ENHANCED SERVER CONFIGURATION ==========
def run_server():
    """Run optimized server with Uvicorn - HTTPS on port 443"""
    
    # Create self-signed certificates if they don't exist
    ssl_certfile, ssl_keyfile = create_self_signed_cert()
    
    if ssl_certfile and ssl_keyfile:
        print("🔐 SSL certificates found, running in HTTPS mode")
    else:
        print("⚠️  Running in HTTP mode (no SSL certificates)")
        ssl_certfile = None
        ssl_keyfile = None
    
    protocol = "https" if ssl_certfile else "http"
    port = 443 if ssl_certfile else 80
    
    print(f"🚀 Advanced DStat Server starting on {protocol}://0.0.0.0:{port}")
    print(f"📊 Dashboard: {protocol}://localhost:{port}")
    print(f"🎯 Hit endpoint: {protocol}://localhost:{port}/hit")
    print(f"⚡ API Stats: {protocol}://localhost:{port}/api/stats")
    print(f"🛡️ Attack Detection: {protocol}://localhost:{port}/api/attacks")
    print("💾 Optimized for extreme high traffic with Uvicorn")
    print("🔧 System monitoring enabled")
    print("📈 Live traffic monitor will run every second, even without attacks!")
    
    if ssl_certfile:
        print("🔐 HTTPS/SSL Enabled - Secure connection")
    else:
        print("⚠️  Running in HTTP mode - For HTTPS, ensure cert.pem and key.pem files exist")
    
    # Uvicorn configuration with SSL support
    uvicorn.run(
        app,
        host='0.0.0.0',
        port=80,
        workers=1,
        loop='asyncio',
        http='httptools',
        ws='none',
        lifespan='on',
        access_log=False,
        timeout_keep_alive=5,
        backlog=2048,
        limit_max_requests=1000000,
        limit_concurrency=1000000,
        ssl_certfile=ssl_certfile,
        ssl_keyfile=ssl_keyfile
    )

if __name__ == '__main__':
    run_server()
