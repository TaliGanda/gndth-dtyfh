package main

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

// -------------------------------------------------------------------
// Konstanta & Variabel Global
// -------------------------------------------------------------------

const (
	defaultConnectTimeout = 3 * time.Second
	defaultRetry          = 1
	defaultRate           = 10000 // koneksi/detik
	defaultPortsFile      = "ports.txt"
	progressInterval      = 10 * time.Second
)

var defaultPorts = []int{80, 81, 88, 3128, 8000, 8008, 8080, 8081, 8888, 9999}

type ProxyInfo struct {
	Proxy        string `json:"proxy"`
	Country      string `json:"country"`
	Region       string `json:"region"`
	City         string `json:"city"`
	ISP          string `json:"isp"`
	Speed        int64  `json:"speed_ms"`
	Anonymity    string `json:"anonymity"`
	Protocol     string `json:"protocol"`
	Status       string `json:"status"`
	RealIP       string `json:"real_ip"`
	ProxyIP      string `json:"proxy_ip"`
	UserAgent    string `json:"user_agent"`
	LastChecked  string `json:"last_checked"`
	HTTPSSupport bool   `json:"https_support"`
	GoogleAccess bool   `json:"google_access"`
}

type IPInfo struct {
	IP       string `json:"ip"`
	Country  string `json:"country"`
	Region   string `json:"region"`
	City     string `json:"city"`
	ISP      string `json:"isp"`
	Org      string `json:"org"`
	Timezone string `json:"timezone"`
	ASN      string `json:"asn"`
}

// Struct lain (IPlocateResponse) dipertahankan seperti aslinya
type IPlocateResponse struct {
	IP           string  `json:"ip"`
	Country      string  `json:"country"`
	CountryCode  string  `json:"country_code"`
	City         string  `json:"city"`
	Continent    string  `json:"continent"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Timezone     string  `json:"time_zone"`
	PostalCode   string  `json:"postal_code"`
	Subdivision  string  `json:"subdivision"`
	CurrencyCode string  `json:"currency_code"`
	ASN          struct {
		ASN         string `json:"asn"`
		Route       string `json:"route"`
		Netname     string `json:"netname"`
		Name        string `json:"name"`
		CountryCode string `json:"country_code"`
		Domain      string `json:"domain"`
		Type        string `json:"type"`
		RIR         string `json:"rir"`
	} `json:"asn"`
	Privacy struct {
		IsAbuser      bool `json:"is_abuser"`
		IsAnonymous   bool `json:"is_anonymous"`
		IsBogon       bool `json:"is_bogon"`
		IsHosting     bool `json:"is_hosting"`
		IsIcloudRelay bool `json:"is_icloud_relay"`
		IsProxy       bool `json:"is_proxy"`
		IsTor         bool `json:"is_tor"`
		IsVPN         bool `json:"is_vpn"`
	} `json:"privacy"`
	Hosting struct {
		Provider string `json:"provider"`
		Domain   string `json:"domain"`
		Network  string `json:"network"`
	} `json:"hosting"`
	Company struct {
		Name        string `json:"name"`
		Domain      string `json:"domain"`
		CountryCode string `json:"country_code"`
		Type        string `json:"type"`
	} `json:"company"`
	Abuse struct {
		Address     string `json:"address"`
		CountryCode string `json:"country_code"`
		Email       string `json:"email"`
		Name        string `json:"name"`
		Network     string `json:"network"`
		Phone       string `json:"phone"`
	} `json:"abuse"`
}

var (
	validProxies []string
	validInfos   []ProxyInfo
	mu           sync.Mutex

	realIP string

	blacklistedISPs = []string{
		"amazon", "aws", "amazon technologies", "amazon.com",
		"amazon data services", "amazon web services", "ec2",
	}
	blacklistedASNs = []string{
		"as16509", "as14618",
	}

	checkerWg sync.WaitGroup
)

// -------------------------------------------------------------------
// Fungsi Checker (100% sama dengan kode asli Anda)
// -------------------------------------------------------------------

func isBlacklisted(ipInfo IPInfo) bool {
	lowerISP := strings.ToLower(ipInfo.ISP)
	lowerOrg := strings.ToLower(ipInfo.Org)
	lowerASN := strings.ToLower(ipInfo.ASN)
	for _, b := range blacklistedISPs {
		if strings.Contains(lowerISP, b) || strings.Contains(lowerOrg, b) {
			return true
		}
	}
	for _, b := range blacklistedASNs {
		if strings.Contains(lowerASN, b) {
			return true
		}
	}
	return false
}

func readProxyList(filename string) ([]string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var proxies []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		p := strings.TrimSpace(sc.Text())
		if p != "" && !strings.HasPrefix(p, "#") {
			proxies = append(proxies, p)
		}
	}
	return proxies, sc.Err()
}

func checkProxy(proxy string) *ProxyInfo {
	parts := strings.Split(proxy, ":")
	if len(parts) != 2 {
		return nil
	}
	ip, port := parts[0], parts[1]
	start := time.Now()

	proxyURL, err := url.Parse(fmt.Sprintf("http://%s:%s", ip, port))
	if err != nil {
		return nil
	}
	transport := &http.Transport{
		Proxy: http.ProxyURL(proxyURL),
		DialContext: (&net.Dialer{
			Timeout: 3 * time.Second,
		}).DialContext,
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}
	client := &http.Client{Transport: transport, Timeout: 3 * time.Second}

	resp, err := client.Get("http://httpbin.org/ip")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	var ipResp struct {
		Origin string `json:"origin"`
	}
	if err := json.Unmarshal(body, &ipResp); err != nil {
		return nil
	}
	speed := time.Since(start).Milliseconds()
	ipInfo := getIPInfo(ip)
	if isBlacklisted(ipInfo) {
		fmt.Printf("[BLOCKED] %s | ISP: %s | Org: %s\n", proxy, ipInfo.ISP, ipInfo.Org)
		return nil
	}
	httpsSupport := testHTTPS(client)
	googleAccess := testGoogleAccess(client)
	anonymity := determineAnonymity(realIP, ipResp.Origin, client)

	return &ProxyInfo{
		Proxy:        proxy,
		Country:      ipInfo.Country,
		Region:       ipInfo.Region,
		City:         ipInfo.City,
		ISP:          ipInfo.ISP,
		Speed:        speed,
		Anonymity:    anonymity,
		Protocol:     "HTTP",
		Status:       "Valid",
		RealIP:       realIP,
		ProxyIP:      ipResp.Origin,
		UserAgent:    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		LastChecked:  time.Now().Format("2006-01-02 15:04:05"),
		HTTPSSupport: httpsSupport,
		GoogleAccess: googleAccess,
	}
}

func testHTTPS(client *http.Client) bool {
	services := []string{
		"https://httpbin.org/ip", "https://api.ipify.org", "https://icanhazip.com",
		"https://www.cloudflare.com", "https://www.github.com",
	}
	for _, s := range services {
		resp, err := client.Get(s)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return true
			}
		}
	}
	return false
}

func testGoogleAccess(client *http.Client) bool {
	services := []string{
		"https://www.google.com/robots.txt",
		"https://www.google.com/favicon.ico",
	}
	for _, s := range services {
		resp, err := client.Get(s)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == 200 {
				return true
			}
		}
	}
	return false
}

func getRealIP() string {
	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
	}
	resp, err := client.Get("https://api.ipify.org")
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()
	ip, _ := io.ReadAll(resp.Body)
	return strings.TrimSpace(string(ip))
}

func determineAnonymity(realIP, proxyIP string, client *http.Client) string {
	resp, err := client.Get("http://httpbin.org/headers")
	if err != nil {
		return "unknown"
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	bodyStr := string(body)
	if strings.Contains(bodyStr, realIP) {
		return "transparent"
	}
	for _, h := range []string{"X-Forwarded-For", "X-Real-IP", "Via", "Proxy-Connection"} {
		if strings.Contains(bodyStr, h) {
			return "anonymous"
		}
	}
	return "elite"
}

func getIPInfo(ip string) IPInfo {
	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	resp, err := client.Get(fmt.Sprintf("http://ip-api.com/json/%s?fields=status,country,regionName,city,isp,org,timezone,as", ip))
	if err != nil {
		return IPInfo{IP: ip, Country: "Unknown", ISP: "Unknown"}
	}
	defer resp.Body.Close()
	var info struct {
		Status   string `json:"status"`
		Country  string `json:"country"`
		Region   string `json:"regionName"`
		City     string `json:"city"`
		ISP      string `json:"isp"`
		Org      string `json:"org"`
		Timezone string `json:"timezone"`
		AS       string `json:"as"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil || info.Status != "success" {
		return IPInfo{IP: ip, Country: "Unknown", ISP: "Unknown"}
	}
	return IPInfo{
		IP: ip, Country: info.Country, Region: info.Region, City: info.City,
		ISP: info.ISP, Org: info.Org, Timezone: info.Timezone, ASN: info.AS,
	}
}

// -------------------------------------------------------------------
// Output (dengan prefix)
// -------------------------------------------------------------------

func saveResults(prefix string) {
	if len(validProxies) == 0 {
		fmt.Println("No valid proxies found to save")
		return
	}
	txtName := prefix + ".txt"
	jsonName := prefix + ".json"
	existing := readExistingProxies(txtName)
	var newProxies []string
	var newInfos []ProxyInfo
	for i, p := range validProxies {
		if !contains(existing, p) {
			newProxies = append(newProxies, p)
			newInfos = append(newInfos, validInfos[i])
		}
	}
	if len(newProxies) == 0 {
		fmt.Println("No new proxies (all duplicates)")
		return
	}
	f, err := os.OpenFile(txtName, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", txtName, err)
		return
	}
	defer f.Close()
	for _, p := range newProxies {
		f.WriteString(p + "\n")
	}
	appendToJSONFile(jsonName, newInfos)
	fmt.Println("\n=== SAVE RESULTS ===")
	fmt.Printf("[+] %s: %d new proxies appended\n", txtName, len(newProxies))
	fmt.Printf("[+] %s: %d new entries appended\n", jsonName, len(newProxies))
}

func appendToJSONFile(filename string, newData []ProxyInfo) {
	var existing []ProxyInfo
	if _, err := os.Stat(filename); err == nil {
		f, _ := os.Open(filename)
		defer f.Close()
		json.NewDecoder(f).Decode(&existing)
	}
	allData := append(existing, newData...)
	f, _ := os.Create(filename)
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	enc.Encode(allData)
}

func readExistingProxies(filename string) []string {
	var proxies []string
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return proxies
	}
	f, _ := os.Open(filename)
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		proxies = append(proxies, strings.TrimSpace(sc.Text()))
	}
	return proxies
}

func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

// -------------------------------------------------------------------
// CIDR streaming (optimasi dengan buffer)
// -------------------------------------------------------------------

func generateIPs(ctx context.Context, cidrs []string) <-chan string {
	ch := make(chan string, 5000) // buffer lebih besar
	go func() {
		defer close(ch)
		for _, cidr := range cidrs {
			if ctx.Err() != nil {
				return
			}
			_, ipnet, err := net.ParseCIDR(strings.TrimSpace(cidr))
			if err != nil {
				fmt.Printf("[WARN] Invalid CIDR %q\n", cidr)
				continue
			}
			ip4 := ipnet.IP.To4()
			if ip4 == nil {
				continue
			}
			mask := ipnet.Mask
			ones, _ := mask.Size()
			total := 1 << (32 - ones)
			start := ip4.Mask(mask)
			for i := 1; i < total-1; i++ {
				if ctx.Err() != nil {
					return
				}
				ip := make(net.IP, 4)
				copy(ip, start)
				carry := i
				for j := 3; j >= 0; j-- {
					v := int(ip[j]) + (carry & 0xFF)
					ip[j] = byte(v & 0xFF)
					carry = (carry >> 8) + (v >> 8)
					if carry == 0 {
						break
					}
				}
				select {
				case ch <- ip.String():
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return ch
}

// -------------------------------------------------------------------
// Scanner: TCP CONNECT validation
// -------------------------------------------------------------------

func validateConnectProxy(ctx context.Context, ip string, port int, timeout time.Duration, retries int) bool {
	addr := net.JoinHostPort(ip, strconv.Itoa(port))
	for r := 0; r <= retries; r++ {
		if ctx.Err() != nil {
			return false
		}
		conn, err := net.DialTimeout("tcp", addr, timeout)
		if err != nil {
			if r < retries {
				time.Sleep(80 * time.Millisecond)
				continue
			}
			return false
		}
		conn.SetDeadline(time.Now().Add(timeout))
		req := "CONNECT www.google.com:443 HTTP/1.1\r\nHost: www.google.com:443\r\n\r\n"
		if _, err := io.WriteString(conn, req); err != nil {
			conn.Close()
			return false
		}
		var buf [128]byte
		n, err := conn.Read(buf[:])
		conn.Close()
		if err != nil {
			return false
		}
		resp := string(buf[:n])
		return strings.HasPrefix(resp, "HTTP/1.1 200") || strings.HasPrefix(resp, "HTTP/1.0 200") ||
			strings.Contains(resp, " 200 Connection Established")
	}
	return false
}

// -------------------------------------------------------------------
// Rate limiter
// -------------------------------------------------------------------

type rateLimiter struct {
	tokens chan struct{}
}

func newRateLimiter(r int) *rateLimiter {
	if r <= 0 {
		return &rateLimiter{}
	}
	rl := &rateLimiter{tokens: make(chan struct{}, r)}
	go func() {
		interval := time.Second / time.Duration(r)
		t := time.NewTicker(interval)
		defer t.Stop()
		for range t.C {
			select {
			case rl.tokens <- struct{}{}:
			default:
			}
		}
	}()
	return rl
}

func (rl *rateLimiter) wait() {
	if rl.tokens != nil {
		<-rl.tokens
	}
}

// -------------------------------------------------------------------
// Worker pools
// -------------------------------------------------------------------

type scanJob struct {
	ip   string
	port int
}

func scannerWorker(ctx context.Context, jobs <-chan scanJob, validated chan<- string, rl *rateLimiter, wg *sync.WaitGroup) {
	defer wg.Done()
	for job := range jobs {
		if ctx.Err() != nil {
			return
		}
		rl.wait()
		if validateConnectProxy(ctx, job.ip, job.port, defaultConnectTimeout, defaultRetry) {
			proxy := net.JoinHostPort(job.ip, strconv.Itoa(job.port))
			select {
			case validated <- proxy:
			case <-ctx.Done():
				return
			}
		}
	}
}

func checkerWorker(ctx context.Context, validated <-chan string) {
	defer checkerWg.Done()
	for proxy := range validated {
		if ctx.Err() != nil {
			return
		}
		info := checkProxy(proxy)
		if info != nil {
			mu.Lock()
			validProxies = append(validProxies, proxy)
			validInfos = append(validInfos, *info)
			https := "[X]"
			if info.HTTPSSupport {
				https = "[OK]"
			}
			google := "[X]"
			if info.GoogleAccess {
				google = "[OK]"
			}
			fmt.Printf("[LIVE] %s | %s-%s | %dms | %s | HTTPS:%s | Google:%s\n",
				proxy, info.Country, info.City, info.Speed, info.Anonymity, https, google)
			mu.Unlock()
		}
	}
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run scanner.go <cidrfile> <threads> [output_prefix]")
		fmt.Println("Example: go run scanner.go cidr.txt 200")
		return
	}
	cidrFile := os.Args[1]
	threads, err := strconv.Atoi(os.Args[2])
	if err != nil || threads <= 0 {
		fmt.Println("Invalid threads number")
		return
	}
	outputPrefix := "valid_http"
	if len(os.Args) >= 4 {
		outputPrefix = os.Args[3]
	}

	cidrs, err := readLines(cidrFile)
	if err != nil {
		log.Fatalf("Cannot read CIDR file: %v", err)
	}
	ports := loadPorts()

	fmt.Println("=== PROXY SCANNER + CHECKER ===")
	realIP = getRealIP()
	fmt.Printf("Real IP: %s\n", realIP)
	fmt.Printf("CIDR ranges: %d\n", len(cidrs))
	fmt.Printf("Ports: %v\n", ports)
	fmt.Printf("Workers: %d\n", threads)
	fmt.Printf("Rate limit: %d/s\n", defaultRate)
	fmt.Println("Building target stream...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	signalCh := make(chan os.Signal, 1)
	signal.Notify(signalCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-signalCh
		fmt.Println("\n[!] Caught signal, draining...")
		cancel()
	}()

	ipCh := generateIPs(ctx, cidrs)
	jobs := make(chan scanJob, threads*10)
	validated := make(chan string, threads*2)

	rl := newRateLimiter(defaultRate)

	// Scanner workers
	var scanWg sync.WaitGroup
	scanWg.Add(threads)
	for i := 0; i < threads; i++ {
		go scannerWorker(ctx, jobs, validated, rl, &scanWg)
	}

	// Checker workers
	checkerWg.Add(threads)
	for i := 0; i < threads; i++ {
		go checkerWorker(ctx, validated)
	}

	// Producer dengan counter
	var produced int64
	go func() {
		defer close(jobs)
		for ip := range ipCh {
			if ctx.Err() != nil {
				return
			}
			for _, port := range ports {
				select {
				case jobs <- scanJob{ip: ip, port: port}:
					atomic.AddInt64(&produced, 1)
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	// Progres reporter
	stopProgress := make(chan struct{})
	go func() {
		ticker := time.NewTicker(progressInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				p := atomic.LoadInt64(&produced)
				fmt.Printf("[*] Progress: %d IP:port combinations queued...\n", p)
			case <-stopProgress:
				return
			}
		}
	}()

	// Tunggu scanner selesai
	go func() {
		scanWg.Wait()
		close(validated)
	}()

	checkerWg.Wait()
	close(stopProgress)

	prod := atomic.LoadInt64(&produced)
	fmt.Printf("\nDone. %d probes sent.\n", prod)
	saveResults(outputPrefix)
}

// -------------------------------------------------------------------
// Helper: load ports
// -------------------------------------------------------------------

func loadPorts() []int {
	if _, err := os.Stat(defaultPortsFile); err == nil {
		lines, err := readLines(defaultPortsFile)
		if err == nil && len(lines) > 0 {
			var ports []int
			for _, l := range lines {
				if p, err := strconv.Atoi(l); err == nil && p > 0 && p < 65536 {
					ports = append(ports, p)
				}
			}
			if len(ports) > 0 {
				return ports
			}
		}
	}
	return defaultPorts
}

func readLines(filename string) ([]string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		l := strings.TrimSpace(sc.Text())
		if l != "" && !strings.HasPrefix(l, "#") {
			lines = append(lines, l)
		}
	}
	return lines, sc.Err()
}
