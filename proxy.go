package main

import (
	"bufio"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type ProxyInfo struct {
	Proxy       string  `json:"proxy"`
	Country     string  `json:"country"`
	Region      string  `json:"region"`
	City        string  `json:"city"`
	ISP         string  `json:"isp"`
	Speed       int64   `json:"speed_ms"`
	Anonymity   string  `json:"anonymity"`
	Protocol    string  `json:"protocol"`
	Status      string  `json:"status"`
	RealIP      string  `json:"real_ip"`
	ProxyIP     string  `json:"proxy_ip"`
	UserAgent   string  `json:"user_agent"`
	LastChecked string  `json:"last_checked"`
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
	IP           string `json:"ip"`
	Country      string `json:"country"`
	CountryCode  string `json:"country_code"`
	City         string `json:"city"`
	Continent    string `json:"continent"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Timezone     string `json:"time_zone"`
	PostalCode   string `json:"postal_code"`
	Subdivision  string `json:"subdivision"`
	CurrencyCode string `json:"currency_code"`
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
		IsAbuser       bool `json:"is_abuser"`
		IsAnonymous    bool `json:"is_anonymous"`
		IsBogon        bool `json:"is_bogon"`
		IsHosting      bool `json:"is_hosting"`
		IsIcloudRelay  bool `json:"is_icloud_relay"`
		IsProxy        bool `json:"is_proxy"`
		IsTor          bool `json:"is_tor"`
		IsVPN          bool `json:"is_vpn"`
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
	mutex        sync.Mutex
	wg           sync.WaitGroup
	realIP       string
	
	// Daftar blacklist untuk ISP, organisasi, dan ASN yang diblokir
	blacklistedISPs = []string{
		"amazon", "aws", "amazon technologies", "amazon.com", 
		"amazon data services", "amazon web services", "ec2",
		"google cloud", "gcp", "google llc", "microsoft", "azure",
		"digitalocean", "linode", "vultr", "ovh", "alibaba", "oracle cloud",
		"hetzner", "rackspace", "godaddy", "bluehost", "hostgator", "siteground",
		"dreamhost", "ionos", "1and1", "cloudflare", "akamai", "fastly",
		"incapsula", "imperva", "sucuri", "stackpath", "keycdn", "bunnycdn",
	}
	
	blacklistedASNs = []string{
		"as16509", "as14618", "as15169", "as8075", "as32934", "as14061",
		"as16276", "as396982", "as13335", "as20940", "as7497", "as714",
		"as7922", "as54574", "as12876", "as20473", "as30633", "as14061",
	}
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: go run script.go proxy.txt threads")
		fmt.Println("Example: go run script.go proxy.txt 100")
		return
	}

	proxyFile := os.Args[1]
	threads, err := strconv.Atoi(os.Args[2])
	if err != nil {
		fmt.Println("Invalid threads number:", os.Args[2])
		return
	}

	fmt.Println("=== PROXY CHECKER MULTI-THREADED ===")
	fmt.Println("Getting real IP...")
	realIP = getRealIP()
	fmt.Printf("Real IP: %s\n", realIP)

	proxies, err := readProxyList(proxyFile)
	if err != nil {
		fmt.Printf("Error reading proxy file: %v\n", err)
		return
	}

	fmt.Printf("Loaded %d proxies\n", len(proxies))
	fmt.Printf("Using %d threads\n", threads)
	fmt.Println("Starting comprehensive proxy check...")
	fmt.Println("Testing: Connection, HTTP, HTTPS, Anonymity, Speed, Geolocation")
	fmt.Println("BLOCKING: Amazon/AWS and other cloud providers")
	fmt.Println(strings.Repeat("=", 60))

	proxyQueue := make(chan string, len(proxies))
	for _, proxy := range proxies {
		proxyQueue <- proxy
	}
	close(proxyQueue)

	startTime := time.Now()
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go worker(proxyQueue, i+1)
	}

	wg.Wait()
	elapsed := time.Since(startTime)

	fmt.Println(strings.Repeat("=", 60))
	fmt.Printf("Check completed in %v\n", elapsed)
	fmt.Printf("Found %d valid proxies out of %d total\n", len(validProxies), len(proxies))

	saveResults()
}

// Fungsi untuk memeriksa apakah ISP/organisasi termasuk dalam blacklist
func isBlacklisted(ipInfo IPInfo) bool {
	lowerISP := strings.ToLower(ipInfo.ISP)
	lowerOrg := strings.ToLower(ipInfo.Org)
	lowerASN := strings.ToLower(ipInfo.ASN)
	
	// Cek ISP dan organisasi
	for _, blacklisted := range blacklistedISPs {
		if strings.Contains(lowerISP, blacklisted) || strings.Contains(lowerOrg, blacklisted) {
			return true
		}
	}
	
	// Cek ASN
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

func worker(proxyQueue <-chan string, workerID int) {
	defer wg.Done()

	for proxy := range proxyQueue {
		result := checkProxy(proxy)
		if result != nil {
			mutex.Lock()
			validProxies = append(validProxies, proxy)
			validInfos = append(validInfos, *result)

			httpsStatus := "❌"
			if result.HTTPSSupport {
				httpsStatus = "✅"
			}

			googleStatus := "❌"
			if result.GoogleAccess {
				googleStatus = "✅"
			}

			fmt.Printf("[W%02d] ✅ %s | %s-%s | %dms | %s | HTTPS:%s | Google:%s\n",
				workerID, proxy, result.Country, result.City, result.Speed,
				result.Anonymity, httpsStatus, googleStatus)
			mutex.Unlock()
		} else {
			fmt.Printf("[W%02d] ❌ %s | Failed\n", workerID, proxy)
		}
	}
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

	// Dapatkan info IP dan periksa blacklist sebelum melanjutkan
	ipInfo := getIPInfo(ipResponse.Origin)
	if isBlacklisted(ipInfo) {
		fmt.Printf("🚫 BLOCKED: %s | ISP: %s | Org: %s\n", proxy, ipInfo.ISP, ipInfo.Org)
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
			// Special handling for dyndns format
			bodyStr := string(body)
			if idx := strings.Index(bodyStr, ":"); idx != -1 {
				if idx2 := strings.Index(bodyStr, "</body>"); idx2 != -1 {
					ip := strings.TrimSpace(bodyStr[idx+1:idx2])
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

		// If we found a service that works and no proxy headers, return elite
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

		// Try iplocate.io format first (prioritize this new service)
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

		// Try ip-api.com format
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

		// Try ipapi.co format
		var info2 struct {
			Country      string `json:"country_name"`
			Region       string `json:"region"`
			City         string `json:"city"`
			ISP          string `json:"org"`
			ASN          string `json:"asn"`
			Timezone     string `json:"timezone"`
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

		// Try ipwhois.app format
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

func saveResults() {
	if len(validProxies) == 0 {
		fmt.Println("No valid proxies found to save")
		return
	}

	existingProxies := readExistingProxies("valid_http.txt")

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

	file, err := os.OpenFile("valid_http.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Error opening valid_http.txt: %v\n", err)
		return
	}
	defer file.Close()

	for _, proxy := range newProxies {
		file.WriteString(proxy + "\n")
	}

	appendToJSONFile("valid_http.json", newInfos)

	totalExisting := len(existingProxies)
	totalNew := len(newProxies)
	totalDuplicates := len(validProxies) - totalNew

	fmt.Println("\n=== SAVE RESULTS ===")
	fmt.Printf("✅ valid_http.txt: %d new proxies appended\n", totalNew)
	fmt.Printf("✅ valid_http.json: %d new entries appended\n", totalNew)
	fmt.Printf("📊 Total existing: %d proxies\n", totalExisting)
	fmt.Printf("📊 Total now: %d proxies\n", totalExisting+totalNew)
	if totalDuplicates > 0 {
		fmt.Printf("🔄 Duplicates skipped: %d\n", totalDuplicates)
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

	fmt.Printf("🔒 Anonymity: Elite=%d, Anonymous=%d, Transparent=%d\n", elite, anonymous, transparent)
	fmt.Printf("⚡ Speed: Fast=%d, Medium=%d, Slow=%d\n", fast, medium, slow)
	fmt.Printf("🔗 HTTPS Support: %d/%d (%.1f%%)\n", httpsSupport, len(infos), float64(httpsSupport)/float64(len(infos))*100)
	fmt.Printf("🌐 Google Access: %d/%d (%.1f%%)\n", googleAccess, len(infos), float64(googleAccess)/float64(len(infos))*100)

	fmt.Printf("🌍 Top Countries: ")
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
