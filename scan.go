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

// ============================================================
// Configuration (can be changed before build)
// ============================================================
const (
	defaultConnectTimeout = 3 * time.Second
	defaultRetry          = 1
	defaultRate           = 10000 // max connects per second (0 = unlimited)
	defaultPortsFile      = "ports.txt"
)

// Hardcoded default ports (used if ports.txt does not exist)
var defaultPorts = []int{80, 81, 88, 3128, 8000, 8008, 8080, 8081, 8888, 9999}

// ============================================================
// Data structures (unchanged from original checker)
// ============================================================

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
	// Global state for checker results
	validProxies []string
	validInfos   []ProxyInfo
	mu           sync.Mutex

	realIP string

	// Blacklist entries (unchanged)
	blacklistedISPs = []string{
		"amazon",
		"aws",
		"amazon technologies",
		"amazon.com",
		"amazon data services",
		"amazon web services",
		"ec2",
	}
	blacklistedASNs = []string{
		"as16509",
		"as14618",
	}

	// WaitGroup for checker workers (used in pipeline)
	checkerWg sync.WaitGroup
)

// ============================================================
// Original checker functions (fully preserved)
// ============================================================

func isBlacklisted(ipInfo IPInfo) bool {
	lowerISP := strings.ToLower(ipInfo.ISP)
	lowerOrg := strings.ToLower(ipInfo.Org)
	lowerASN := strings.ToLower(ipInfo.ASN)

	for _, blacklisted := range blacklistedISPs {
		if strings.Contains(lowerISP, blacklisted) || strings.Contains(lowerOrg, blacklisted) {
			return true
		}
	}
	for _, blacklistedASN := range blacklistedASNs {
		if strings.Contains(lowerASN, blacklistedASN) {
			return true
		}
	}
	return false
}

func readProxyList(filename string) ([]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var proxies []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		proxy := strings.TrimSpace(scanner.Text())
		if proxy != "" && !strings.HasPrefix(proxy, "#") {
			proxies = append(proxies, proxy)
		}
	}
	return proxies, scanner.Err()
}

func checkProxy(proxy string) *ProxyInfo {
	parts := strings.Split(proxy, ":")
	if len(parts) != 2 {
		return nil
	}

	ip := parts[0]
	port := parts[1]

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

	client := &http.Client{
		Transport: transport,
		Timeout:   3 * time.Second,
	}

	resp, err := client.Get("http://httpbin.org/ip")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}

	var ipResponse struct {
		Origin string `json:"origin"`
	}
	if err := json.Unmarshal(body, &ipResponse); err != nil {
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
	anonymity := determineAnonymity(realIP, ipResponse.Origin, client)

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
		ProxyIP:      ipResponse.Origin,
		UserAgent:    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
		LastChecked:  time.Now().Format("2006-01-02 15:04:05"),
		HTTPSSupport: httpsSupport,
		GoogleAccess: googleAccess,
	}
}

func testHTTPS(client *http.Client) bool {
	httpsServices := []string{
		"https://httpbin.org/ip",
		"https://api.ipify.org",
		"https://icanhazip.com",
		"https://www.cloudflare.com",
		"https://www.github.com",
		"https://www.stackoverflow.com",
		"https://httpbin.org/get",
		"https://jsonplaceholder.typicode.com/posts/1",
		"https://www.apple.com",
		"https://www.microsoft.com",
		"https://www.amazon.com",
		"https://www.facebook.com",
		"https://www.instagram.com",
		"https://www.twitter.com",
		"https://www.reddit.com",
		"https://www.linkedin.com",
		"https://www.netflix.com",
		"https://www.youtube.com",
		"https://www.wikipedia.org",
		"https://www.ubuntu.com",
	}

	for _, service := range httpsServices {
		resp, err := client.Get(service)
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
	googleServices := []string{
		"https://www.google.com",
		"https://www.google.com/favicon.ico",
		"https://www.google.com/robots.txt",
		"https://clients1.google.com/generate_204",
		"https://www.gstatic.com/generate_204",
		"https://google.com/generate_204",
		"https://accounts.google.com/generate_204",
		"https://drive.google.com",
		"https://docs.google.com",
		"https://mail.google.com",
		"https://maps.google.com",
		"https://play.google.com",
		"https://news.google.com",
		"https://photos.google.com",
		"https://meet.google.com",
		"https://calendar.google.com",
		"https://contacts.google.com",
		"https://classroom.google.com",
		"https://myaccount.google.com",
		"https://scholar.google.com",
	}

	for _, service := range googleServices {
		resp, err := client.Get(service)
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
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	services := []string{
		"https://api.ipify.org",
		"http://httpbin.org/ip",
		"https://icanhazip.com",
		"https://checkip.amazonaws.com",
		"https://ifconfig.me/ip",
		"https://ident.me",
		"https://myip.dnsomatic.com",
		"https://ipecho.net/plain",
		"https://wtfismyip.com/text",
		"https://ip.seeip.org",
		"https://ipv4.seeip.org",
		"https://api.myip.com",
		"https://ipaddr.site",
		"https://ip.42.pl/raw",
		"https://l2.io/ip",
		"https://www.trackip.net/ip",
		"http://ipinfo.io/ip",
		"http://whatismyip.akamai.com",
		"http://tnx.nl/ip",
		"http://myexternalip.com/raw",
		"http://curlmyip.net",
		"http://checkip.dyndns.org",
		"https://myip.is/",
		"https://myip.com/",
		"https://ip.sb/",
		"https://ipinfo.io/ip",
		"https://api64.ipify.org",
		"https://ip.anysrc.net/",
		"https://myip.wtf/",
		"https://formyip.com/",
	}

	for _, service := range services {
		resp, err := client.Get(service)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}

		if strings.Contains(service, "httpbin") {
			var ipResponse struct {
				Origin string `json:"origin"`
			}
			if err := json.Unmarshal(body, &ipResponse); err == nil {
				return strings.TrimSpace(ipResponse.Origin)
			}
		} else if strings.Contains(service, "checkip.dyndns.org") {
			bodyStr := string(body)
			if idx := strings.Index(bodyStr, ":"); idx != -1 {
				if idx2 := strings.Index(bodyStr, "</body>"); idx2 != -1 {
					ip := strings.TrimSpace(bodyStr[idx+1 : idx2])
					if net.ParseIP(ip) != nil {
						return ip
					}
				}
			}
		} else {
			ip := strings.TrimSpace(string(body))
			if ip != "" && net.ParseIP(ip) != nil {
				return ip
			}
		}
	}

	return "unknown"
}

func determineAnonymity(realIP, proxyIP string, client *http.Client) string {
	anonymityServices := []string{
		"http://httpbin.org/headers",
		"https://httpbin.org/headers",
		"http://httpbin.org/ip",
		"https://httpbin.org/ip",
	}

	for _, service := range anonymityServices {
		resp, err := client.Get(service)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}

		bodyStr := string(body)

		if strings.Contains(bodyStr, realIP) {
			return "transparent"
		}

		proxyHeaders := []string{
			"X-Forwarded-For",
			"X-Real-IP",
			"Via",
			"X-Proxy-Connection",
			"Proxy-Connection",
			"X-Forwarded-Proto",
			"X-Forwarded-Host",
			"Forwarded",
			"X-Forwarded-Server",
			"X-Forwarded-By",
			"X-Custom-IP-Authorization",
		}

		for _, header := range proxyHeaders {
			if strings.Contains(bodyStr, header) {
				return "anonymous"
			}
		}

		return "elite"
	}

	return "unknown"
}

func getIPInfo(ip string) IPInfo {
	client := &http.Client{
		Timeout: 8 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}

	geoIPServices := []string{
		"http://ip-api.com/json/%s",
		"https://ipapi.co/%s/json/",
		"https://ipwhois.app/json/%s",
		"https://freeipapi.com/api/json/%s",
		"http://ipinfo.io/%s/json",
		"https://api.ipgeolocation.io/ipgeo?ip=%s",
		"https://json.geoiplookup.io/%s",
		"https://iplocate.io/api/lookup/%s",
	}

	for _, service := range geoIPServices {
		url := fmt.Sprintf(service, ip)
		resp, err := client.Get(url)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}

		if strings.Contains(service, "iplocate.io") {
			var iplocateResp IPlocateResponse
			if err := json.Unmarshal(body, &iplocateResp); err == nil && iplocateResp.Country != "" {
				isp := iplocateResp.Company.Name
				if isp == "" {
					isp = iplocateResp.ASN.Name
				}

				return IPInfo{
					IP:       ip,
					Country:  iplocateResp.Country,
					Region:   iplocateResp.Subdivision,
					City:     iplocateResp.City,
					ISP:      isp,
					Org:      iplocateResp.ASN.Netname,
					Timezone: iplocateResp.Timezone,
					ASN:      iplocateResp.ASN.ASN,
				}
			}
		}

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
		if err := json.Unmarshal(body, &info); err == nil && info.Status == "success" {
			return IPInfo{
				IP:       ip,
				Country:  info.Country,
				Region:   info.Region,
				City:     info.City,
				ISP:      info.ISP,
				Org:      info.Org,
				Timezone: info.Timezone,
				ASN:      info.AS,
			}
		}

		var info2 struct {
			Country  string `json:"country_name"`
			Region   string `json:"region"`
			City     string `json:"city"`
			ISP      string `json:"org"`
			ASN      string `json:"asn"`
			Timezone string `json:"timezone"`
		}
		if err := json.Unmarshal(body, &info2); err == nil && info2.Country != "" {
			return IPInfo{
				IP:       ip,
				Country:  info2.Country,
				Region:   info2.Region,
				City:     info2.City,
				ISP:      info2.ISP,
				Org:      info2.ASN,
				Timezone: info2.Timezone,
				ASN:      info2.ASN,
			}
		}

		var info3 struct {
			Country  string `json:"country"`
			Region   string `json:"region"`
			City     string `json:"city"`
			ISP      string `json:"isp"`
			Org      string `json:"org"`
			Timezone string `json:"timezone"`
			ASN      string `json:"asn"`
		}
		if err := json.Unmarshal(body, &info3); err == nil && info3.Country != "" {
			return IPInfo{
				IP:       ip,
				Country:  info3.Country,
				Region:   info3.Region,
				City:     info3.City,
				ISP:      info3.ISP,
				Org:      info3.Org,
				Timezone: info3.Timezone,
				ASN:      info3.ASN,
			}
		}
	}

	return IPInfo{IP: ip, Country: "Unknown", ISP: "Unknown", ASN: "Unknown"}
}

// ============================================================
// Output functions (slightly modified to accept output prefix)
// ============================================================

func saveResults(outputPrefix string) {
	if len(validProxies) == 0 {
		fmt.Println("No valid proxies found to save")
		return
	}

	txtFilename := outputPrefix + ".txt"
	jsonFilename := outputPrefix + ".json"

	existingProxies := readExistingProxies(txtFilename)

	var newProxies []string
	var newInfos []ProxyInfo

	for i, proxy := range validProxies {
		if !contains(existingProxies, proxy) {
			newProxies = append(newProxies, proxy)
			newInfos = append(newInfos, validInfos[i])
		}
	}

	if len(newProxies) == 0 {
		fmt.Println("No new proxies to save (all duplicates)")
		return
	}

	file, err := os.OpenFile(txtFilename, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", txtFilename, err)
		return
	}
	defer file.Close()

	for _, proxy := range newProxies {
		file.WriteString(proxy + "\n")
	}

	appendToJSONFile(jsonFilename, newInfos)

	totalExisting := len(existingProxies)
	totalNew := len(newProxies)
	totalDuplicates := len(validProxies) - totalNew

	fmt.Println("\n=== SAVE RESULTS ===")
	fmt.Printf("[+] %s: %d new proxies appended\n", txtFilename, totalNew)
	fmt.Printf("[+] %s: %d new entries appended\n", jsonFilename, totalNew)
	fmt.Printf("[i] Total existing: %d proxies\n", totalExisting)
	fmt.Printf("[i] Total now: %d proxies\n", totalExisting+totalNew)
	if totalDuplicates > 0 {
		fmt.Printf("[!] Duplicates skipped: %d\n", totalDuplicates)
	}

	showProxyStats(newInfos)
}

func showProxyStats(infos []ProxyInfo) {
	if len(infos) == 0 {
		return
	}

	fmt.Println("\n=== PROXY QUALITY STATS ===")

	transparent := 0
	anonymous := 0
	elite := 0

	fast := 0
	medium := 0
	slow := 0

	httpsSupport := 0
	googleAccess := 0

	countries := make(map[string]int)

	for _, info := range infos {
		switch info.Anonymity {
		case "transparent":
			transparent++
		case "anonymous":
			anonymous++
		case "elite":
			elite++
		}

		if info.Speed < 1000 {
			fast++
		} else if info.Speed < 3000 {
			medium++
		} else {
			slow++
		}

		if info.HTTPSSupport {
			httpsSupport++
		}
		if info.GoogleAccess {
			googleAccess++
		}

		countries[info.Country]++
	}

	fmt.Printf("[LOCK] Anonymity: Elite=%d, Anonymous=%d, Transparent=%d\n", elite, anonymous, transparent)
	fmt.Printf("[PERF] Speed: Fast=%d, Medium=%d, Slow=%d\n", fast, medium, slow)
	fmt.Printf("[WEB]  HTTPS Support: %d/%d (%.1f%%)\n", httpsSupport, len(infos), float64(httpsSupport)/float64(len(infos))*100)
	fmt.Printf("[GOOG] Google Access: %d/%d (%.1f%%)\n", googleAccess, len(infos), float64(googleAccess)/float64(len(infos))*100)

	fmt.Printf("[GEO]  Top Countries: ")
	count := 0
	for country, num := range countries {
		if count < 3 {
			fmt.Printf("%s(%d) ", country, num)
			count++
		}
	}
	fmt.Println()
}

func readExistingProxies(filename string) []string {
	var proxies []string

	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return proxies
	}

	file, err := os.Open(filename)
	if err != nil {
		return proxies
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		proxy := strings.TrimSpace(scanner.Text())
		if proxy != "" {
			proxies = append(proxies, proxy)
		}
	}

	return proxies
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func appendToJSONFile(filename string, newData []ProxyInfo) {
	var existingData []ProxyInfo

	if _, err := os.Stat(filename); err == nil {
		existingFile, err := os.Open(filename)
		if err != nil {
			fmt.Printf("Error opening existing JSON file: %v\n", err)
			return
		}
		defer existingFile.Close()

		decoder := json.NewDecoder(existingFile)
		if err := decoder.Decode(&existingData); err != nil {
			existingData = []ProxyInfo{}
		}
	}

	allData := append(existingData, newData...)

	jsonData, err := json.MarshalIndent(allData, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		return
	}

	jsonFile, err := os.Create(filename)
	if err != nil {
		fmt.Printf("Error creating JSON file: %v\n", err)
		return
	}
	defer jsonFile.Close()

	jsonFile.Write(jsonData)
}

// ============================================================
// CIDR streaming expansion
// ============================================================

func generateIPs(ctx context.Context, cidrs []string) <-chan string {
	ipCh := make(chan string, 1024)
	go func() {
		defer close(ipCh)
		for _, cidr := range cidrs {
			if ctx.Err() != nil {
				return
			}
			_, ipNet, err := net.ParseCIDR(strings.TrimSpace(cidr))
			if err != nil {
				fmt.Printf("[WARN] Invalid CIDR %q: %v\n", cidr, err)
				continue
			}
			ip4 := ipNet.IP.To4()
			if ip4 == nil {
				continue
			}
			mask := ipNet.Mask
			start := ip4.Mask(mask)
			ones, _ := mask.Size()
			total := 1 << (32 - ones)
			// Iterate over all addresses except network and broadcast
			for i := 1; i < total-1; i++ {
				if ctx.Err() != nil {
					return
				}
				ip := make(net.IP, 4)
				copy(ip, start)
				// Add offset i to IP
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
				case ipCh <- ip.String():
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	return ipCh
}

// ============================================================
// Scanner: TCP connect + CONNECT validation
// ============================================================

func validateConnectProxy(ctx context.Context, ip string, port int, timeout time.Duration, retries int) bool {
	addr := net.JoinHostPort(ip, strconv.Itoa(port))
	for r := 0; r <= retries; r++ {
		if ctx.Err() != nil {
			return false
		}
		conn, err := net.DialTimeout("tcp", addr, timeout)
		if err != nil {
			if r < retries {
				time.Sleep(100 * time.Millisecond)
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
			strings.Contains(resp, " 200 ")
	}
	return false
}

// ============================================================
// Rate limiter
// ============================================================

type rateLimiter struct {
	tokens chan struct{}
}

func newRateLimiter(ratePerSec int) *rateLimiter {
	if ratePerSec <= 0 {
		return &rateLimiter{tokens: nil}
	}
	rl := &rateLimiter{
		tokens: make(chan struct{}, ratePerSec),
	}
	go func() {
		interval := time.Second / time.Duration(ratePerSec)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
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

// ============================================================
// Job structure for scanner
// ============================================================

type scanJob struct {
	ip   string
	port int
}

// ============================================================
// Scanner worker
// ============================================================

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

// ============================================================
// Checker worker (wraps original checkProxy)
// ============================================================

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
			httpsStatus := "[X]"
			if info.HTTPSSupport {
				httpsStatus = "[OK]"
			}
			googleStatus := "[X]"
			if info.GoogleAccess {
				googleStatus = "[OK]"
			}
			fmt.Printf("[LIVE] %s | %s-%s | %dms | %s | HTTPS:%s | Google:%s\n",
				proxy, info.Country, info.City, info.Speed,
				info.Anonymity, httpsStatus, googleStatus)
			mu.Unlock()
		}
	}
}

// ============================================================
// Main entry point
// ============================================================

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run scanner.go <cidrfile> <threads> [output_prefix]")
		fmt.Println("Example: go run scanner.go cidr.txt 200")
		fmt.Println("         go run scanner.go cidr.txt 200 my_proxies")
		return
	}

	cidrFile := os.Args[1]
	threads, err := strconv.Atoi(os.Args[2])
	if err != nil || threads <= 0 {
		fmt.Println("Invalid threads number:", os.Args[2])
		return
	}

	outputPrefix := "valid_http"
	if len(os.Args) >= 4 {
		outputPrefix = os.Args[3]
	}

	// Load CIDR list
	cidrs, err := readLines(cidrFile)
	if err != nil {
		log.Fatalf("Cannot read CIDR file: %v", err)
	}

	// Load ports (from file or default)
	ports := loadPorts()

	fmt.Println("=== PROXY SCANNER + CHECKER ===")
	fmt.Println("Getting real IP...")
	realIP = getRealIP()
	fmt.Printf("Real IP: %s\n", realIP)
	fmt.Printf("Loaded %d CIDR ranges\n", len(cidrs))
	fmt.Printf("Target ports: %v\n", ports)
	fmt.Printf("Concurrency: %d workers\n", threads)
	fmt.Printf("Output prefix: %s\n", outputPrefix)
	fmt.Println("Starting scanner pipeline...")

	// Context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("\n[!] Shutting down gracefully...")
		cancel()
	}()

	// Pipeline channels
	ipCh := generateIPs(ctx, cidrs)
	jobs := make(chan scanJob, threads*2)
	validated := make(chan string, threads*2)

	// Rate limiter
	rl := newRateLimiter(defaultRate)

	// Start scanner workers
	var scanWg sync.WaitGroup
	scanWg.Add(threads)
	for i := 0; i < threads; i++ {
		go scannerWorker(ctx, jobs, validated, rl, &scanWg)
	}

	// Start checker workers (same count as threads)
	checkerWg.Add(threads)
	for i := 0; i < threads; i++ {
		go checkerWorker(ctx, validated)
	}

	// Producer: combine IPs with ports and feed jobs
	var producedCount int64
	go func() {
		defer close(jobs)
		for ip := range ipCh {
			if ctx.Err() != nil {
				return
			}
			for _, port := range ports {
				select {
				case jobs <- scanJob{ip: ip, port: port}:
					atomic.AddInt64(&producedCount, 1)
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	// Wait for scanner workers to finish after producer closes jobs
	go func() {
		scanWg.Wait()
		close(validated)
	}()

	// Wait for checker workers to finish
	checkerWg.Wait()

	// Show some stats
	prod := atomic.LoadInt64(&producedCount)
	fmt.Printf("\nScanning finished. %d IP:port combinations attempted.\n", prod)

	// Save results using the original checker's output functions (with prefix)
	saveResults(outputPrefix)
}

// ============================================================
// Helper: read lines from file (non-empty, no comments)
// ============================================================

func readLines(filename string) ([]string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			lines = append(lines, line)
		}
	}
	return lines, sc.Err()
}

// ============================================================
// Port loading: from ports.txt if present, else default list
// ============================================================

func loadPorts() []int {
	if _, err := os.Stat(defaultPortsFile); err == nil {
		lines, err := readLines(defaultPortsFile)
		if err == nil && len(lines) > 0 {
			var ports []int
			for _, line := range lines {
				if p, err := strconv.Atoi(line); err == nil && p > 0 && p < 65536 {
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
